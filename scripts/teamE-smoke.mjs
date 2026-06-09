import { chromium } from "playwright";

const BASE = "http://localhost:3010/team-apps/teamE";
const results = [];
let failed = 0;

function check(name, cond, extra = "") {
  results.push(`${cond ? "✅" : "❌"} ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failed++;
}

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

async function step(name, fn) {
  try {
    await fn();
    results.push("✅ " + name);
  } catch (e) {
    failed++;
    results.push(`❌ ${name} — ${e.message.split("\n")[0]} @ ${page.url()}`);
    try { await page.screenshot({ path: `/tmp/teamE-fail-${results.length}.png` }); } catch {}
  }
}

await step("本社ログイン→本社ホーム遷移", async () => {
  await page.goto(`${BASE}/login.html`);
  await page.fill("#userid", "1");
  await page.fill("#password", "pass1234");
  await page.click(".login-btn");
  await page.waitForURL("**/list.html", { timeout: 5000 });
});

await step("本社ホームに現場カード(19+)表示", async () => {
  await page.waitForSelector(".site-card");
  const n = await page.locator(".site-card").count();
  if (n < 19) throw new Error(`cards=${n}`);
});
await step("優先度中に新宿(priority2)が1件分類", async () => {
  const n = await page.locator("#section-medium .site-card").count();
  if (n !== 1) throw new Error(`medium=${n}`);
});
await step("トラブル通知が表示", async () => {
  const n = await page.locator("#notification-container .notification").count();
  if (n < 1) throw new Error(`notif=${n}`);
});

await step("現場ポータルへ遷移し現場名表示", async () => {
  await page.click("#section-medium .site-name");
  await page.waitForURL("**/portal.html?siteId=2");
  await page.waitForSelector("#siteName");
  const t = await page.textContent("#siteName");
  if (!(t || "").includes("新宿")) throw new Error(t);
});

await step("ポータル→トラブル一覧に行表示", async () => {
  await page.click("#subTrouble");
  await page.waitForURL("**/troublelist.html?siteId=2");
  await page.waitForSelector(".issue-table tbody tr");
  const n = await page.locator(".issue-table tbody tr").count();
  if (n < 1) throw new Error(`rows=${n}`);
});
await step("トラブル詳細に概要「設備故障」/種別「事故」表示", async () => {
  await page.click(".issue-table tbody tr .detail-btn");
  await page.waitForURL("**/troubledetail.html**");
  await page.waitForSelector(".container .section");
  const t = await page.textContent(".container");
  if (!t.includes("設備故障") || !t.includes("事故")) throw new Error("missing text");
});
await step("本社で確認完了→ボタンが「対応完了」に変化", async () => {
  await page.click("#adv");
  await page.waitForLoadState("networkidle");
  const t = await page.textContent(".btn-area");
  if (!t.includes("対応完了")) throw new Error(t.trim());
});

await step("現場担当ログイン→現場ホーム+担当現場名", async () => {
  await page.goto(`${BASE}/login.html`);
  await page.fill("#userid", "2");
  await page.fill("#password", "pass2345");
  await page.click(".login-btn");
  await page.waitForURL("**/home.html", { timeout: 5000 });
  const t = await page.textContent("#siteName");
  if (!(t || "").includes("新宿")) throw new Error(t);
});
await step("チャット送信でメッセージ追加", async () => {
  const before = await page.locator("#chatMessages .message-row").count();
  await page.fill("#messageInput", "テスト送信メッセージ");
  await page.click(".chat-input button");
  await page.waitForTimeout(300);
  const after = await page.locator("#chatMessages .message-row").count();
  if (after !== before + 1) throw new Error(`${before}->${after}`);
});

await step("日報一覧→詳細に作業内容/天候/出面表示", async () => {
  await page.click('a[href="./dailylist.html"]');
  await page.waitForURL("**/dailylist.html");
  await page.waitForSelector("#reportBody tr");
  await page.click("#reportBody .detail-btn");
  await page.waitForURL("**/dailyreportdetail.html**");
  const dr = await page.textContent(".container");
  if (!dr.includes("型枠工事") || !dr.includes("晴れ") || !dr.includes("A協力会社"))
    throw new Error("missing text");
});

// ---- 日報: 新規作成フロー（作成→確認→完了） ----
await step("日報 作成→確認画面に内容引継ぎ", async () => {
  await page.goto(`${BASE}/dailyreport.html`);
  await page.waitForSelector("#form");
  await page.fill('[name="projectNumber"]', "B-2048");
  await page.fill('[name="workDetails"]', "鉄筋組立");
  await page.click('.btn-area button[type="submit"]');
  await page.waitForURL("**/dailyreportcheck.html");
  const t = await page.textContent(".container");
  if (!t.includes("鉄筋組立") || !t.includes("B-2048")) throw new Error("引継ぎ欠落");
});
await step("日報 確認→登録→完了画面", async () => {
  await page.click("#submitBtn");
  await page.waitForURL("**/complete.html**");
  if (!page.url().includes("type=report")) throw new Error(page.url());
});
await step("日報 一覧が2件以上に増加", async () => {
  await page.goto(`${BASE}/dailylist.html`);
  await page.waitForSelector("#reportBody tr");
  const n = await page.locator("#reportBody tr").count();
  if (n < 2) throw new Error(`rows=${n}`);
});

// ---- 日報: 編集フロー（詳細→編集→確認→完了→反映確認） ----
let editedReportUrl;
await step("日報 詳細→編集画面へ遷移", async () => {
  await page.click("#reportBody .detail-btn");
  await page.waitForURL("**/dailyreportdetail.html**");
  await page.click('a[href^="./dailyedit.html"]');
  await page.waitForURL("**/dailyedit.html?id=**");
  editedReportUrl = page.url();
  await page.waitForSelector('[name="workDetails"]');
});
await step("日報 編集→確認→更新→完了", async () => {
  await page.fill('[name="workDetails"]', "鉄筋組立(修正済)");
  await page.click('.btn-area button[type="submit"]');
  await page.waitForURL("**/dailyeditcheck.html");
  const t = await page.textContent(".container");
  if (!t.includes("鉄筋組立(修正済)")) throw new Error("編集内容欠落");
  await page.click("#updateBtn");
  await page.waitForURL("**/complete.html**");
  if (!page.url().includes("mode=edit")) throw new Error(page.url());
});
await step("日報 編集が詳細に反映", async () => {
  const detailUrl = editedReportUrl.replace("dailyedit.html", "dailyreportdetail.html");
  await page.goto(detailUrl);
  await page.waitForSelector(".container .section");
  const t = await page.textContent(".container");
  if (!t.includes("鉄筋組立(修正済)")) throw new Error("反映なし");
});

// ---- 安全点検: 作成→確認→完了 ----
await step("安全点検 作成→確認→登録→完了", async () => {
  await page.goto(`${BASE}/safetycheck.html`);
  await page.waitForSelector("#form select[name]");
  await page.$$eval("#form select[name]", (els) => els.forEach((e) => (e.value = "0")));
  await page.click('.btn-area button[type="submit"]');
  await page.waitForURL("**/safetycheckcheck.html");
  await page.click("#confirmBtn");
  await page.waitForURL("**/complete.html**");
  if (!page.url().includes("type=safety")) throw new Error(page.url());
});
await step("安全点検 一覧に反映→編集→確認→完了", async () => {
  await page.goto(`${BASE}/safetylist.html`);
  await page.waitForSelector("a.detail-btn[href^='./safetycheckdetail.html']", { timeout: 5000 });
  await page.click("a.detail-btn[href^='./safetycheckdetail.html']");
  await page.waitForURL("**/safetycheckdetail.html**");
  await page.click("a[href^='./safetyedit.html']");
  await page.waitForURL("**/safetyedit.html?id=**");
  await page.click('.btn-area button[type="submit"]');
  await page.waitForURL("**/safetyeditcheck.html");
  await page.click("#confirmBtn");
  await page.waitForURL("**/complete.html**");
  if (!page.url().includes("type=safety") || !page.url().includes("mode=edit")) throw new Error(page.url());
});

// ---- トラブル: 作成→確認→完了（現場担当） ----
await step("トラブル 作成→確認→登録→完了", async () => {
  await page.goto(`${BASE}/trouble.html`);
  await page.waitForSelector('[name="overview"]');
  await page.fill('[name="occurredAt"]', "2026-06-08T09:30");
  await page.fill('[name="overview"]', "クレーン点検遅延");
  await page.fill('[name="detail"]', "点検待ちで作業開始が遅れた");
  await page.click('.btn-area button[type="submit"]');
  await page.waitForURL("**/troublecheck.html");
  const t = await page.textContent(".container");
  if (!t.includes("クレーン点検遅延")) throw new Error("引継ぎ欠落");
  await page.click("#registerBtn");
  await page.waitForURL("**/complete.html**");
  if (!page.url().includes("type=trouble")) throw new Error(page.url());
});

check("JSエラーなし", errors.length === 0, errors.slice(0, 4).join(" | "));

console.log("\n==== teamE スモークテスト ====");
results.forEach((r) => console.log(r));
console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"}`);

await browser.close();
process.exit(failed === 0 ? 0 : 1);
