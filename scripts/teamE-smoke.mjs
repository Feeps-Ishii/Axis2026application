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

await step("日報新規作成→一覧が2件以上", async () => {
  await page.goto(`${BASE}/dailyreport.html`);
  await page.waitForSelector("#form");
  await page.fill('[name="projectNumber"]', "B-2048");
  await page.fill('[name="workDetails"]', "鉄筋組立");
  page.once("dialog", (d) => d.accept());
  await page.click('.btn-area button[type="submit"]');
  await page.waitForURL("**/dailylist.html");
  await page.waitForSelector("#reportBody tr");
  const n = await page.locator("#reportBody tr").count();
  if (n < 2) throw new Error(`rows=${n}`);
});

check("JSエラーなし", errors.length === 0, errors.slice(0, 4).join(" | "));

console.log("\n==== teamE スモークテスト ====");
results.forEach((r) => console.log(r));
console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"}`);

await browser.close();
process.exit(failed === 0 ? 0 : 1);
