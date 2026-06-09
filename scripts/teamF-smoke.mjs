import { chromium } from "playwright";

const BASE = "http://localhost:3010/team-apps/teamF";
const results = [];
let failed = 0;

const browser = await chromium.launch();
const page = await browser.newPage();
let errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

async function step(name, fn) {
  try {
    await fn();
    results.push("✅ " + name);
  } catch (e) {
    failed++;
    results.push(`❌ ${name} — ${e.message.split("\n")[0]} @ ${page.url()}`);
    try { await page.screenshot({ path: `/tmp/teamF-fail-${results.length}.png` }); } catch {}
  }
}

// ---- ログイン ----
await step("従業員ログイン(staff001/1111)→topmenu", async () => {
  await page.goto(`${BASE}/login.html`);
  await page.fill("#loginId", "staff001");
  await page.fill("#password", "1111");
  await page.click("#loginForm button[type=submit]");
  await page.waitForURL("**/topmenu.html", { timeout: 5000 });
});

// ---- 全ページ クリーン起動スイープ（db.js契約の実行時エラー検出） ----
// pending非依存で直接到達できるページ。各ページで JSエラー0 + TeamF定義 + 本文描画 を検証。
const sweep = [
  "topmenu.html",
  "list.html",
  "detail.html?id=1",
  "update.html?id=1",
  "cancel.html?id=1",
  "complete.html?mode=cancel&id=1",
  "room.html",
  "record.html",
  "record_detail.html?id=1",
  "record_edit.html?id=1",
  "record_delete.html?id=1",
  "record_edit_complete.html?id=1",
  "record_delete_complete.html?name=%E3%83%86%E3%82%B9%E3%83%88",
  "okami_bot.html?customerId=1",
  "customer_top.html",
  "regist_customer.html",
  "upcus_search.html",
  "cancus_search.html",
  "upcus_complete.html?id=1",
  "cancus_complete.html?id=1",
  "regcus_complete.html?id=1",
];
for (const path of sweep) {
  await step(`起動: ${path}`, async () => {
    errors = [];
    await page.goto(`${BASE}/${path}`, { waitUntil: "networkidle" });
    const defined = await page.evaluate(() => typeof window.TeamF !== "undefined");
    if (!defined) throw new Error("TeamF undefined");
    const len = await page.evaluate(() => (document.body.innerText || "").trim().length);
    if (len < 30) throw new Error("本文が描画されていない(len=" + len + ")");
    if (errors.length) throw new Error("JSエラー: " + errors.slice(0, 2).join(" | "));
  });
}

// ---- データ結線の確認 ----
await step("予約一覧に顧客名(鈴木太郎)が描画", async () => {
  await page.goto(`${BASE}/list.html`, { waitUntil: "networkidle" });
  const t = await page.textContent("body");
  if (!t.includes("鈴木太郎")) throw new Error("顧客名なし");
});
await step("予約詳細(id=1)にプラン/客室結合表示", async () => {
  await page.goto(`${BASE}/detail.html?id=1`, { waitUntil: "networkidle" });
  const t = await page.textContent("body");
  // 予約1: 鈴木太郎 / プランID2(花あかり懐石) / 客室「桜」
  if (!t.includes("鈴木太郎") || !t.includes("桜")) throw new Error("結合表示欠落");
});
await step("顧客カルテ一覧に10名表示", async () => {
  await page.goto(`${BASE}/record.html`, { waitUntil: "networkidle" });
  const names = await page.evaluate(() => window.TeamF.activeCustomers().length);
  if (names < 10) throw new Error("customers=" + names);
  const t = await page.textContent("body");
  if (!t.includes("田中幸子")) throw new Error("一覧に顧客名なし");
});

// ---- 女将ボット: 送信で応答が返る ----
await step("女将bot 送信→bot応答が履歴に追加", async () => {
  await page.goto(`${BASE}/okami_bot.html?customerId=1`, { waitUntil: "networkidle" });
  await page.fill("#messageInput", "記念日のおもてなしのおすすめは？");
  await page.click("#sendButton");
  await page.waitForFunction(
    () => window.TeamF.okamiHistory().some((m) => m.role === "bot"),
    { timeout: 5000 }
  );
  const t = await page.textContent("#chatMsgs");
  if (!t || t.trim().length < 5) throw new Error("応答が描画されない");
});

// ---- 予約キャンセル フロー（cancel→confirm→complete、ステータス永続化） ----
await step("予約キャンセル: 入力→確認", async () => {
  await page.goto(`${BASE}/cancel.html?id=1`, { waitUntil: "networkidle" });
  await page.fill("#cancelReason", "スモークテストによるキャンセル");
  await page.click("#cancelForm button[type=submit]");
  await page.waitForURL("**/cancel_confirm.html", { timeout: 5000 });
  const t = await page.textContent("body");
  if (!t.includes("スモークテストによるキャンセル")) throw new Error("理由引継ぎ欠落");
});
await step("予約キャンセル: 確定→完了→ステータス=キャンセル永続化", async () => {
  await page.click("#confirmBtn");
  await page.waitForURL("**/complete.html**", { timeout: 5000 });
  if (!page.url().includes("mode=cancel")) throw new Error(page.url());
  const status = await page.evaluate(() => window.TeamF.reservation(1).status);
  if (status !== "キャンセル") throw new Error("status=" + status);
});

console.log("\n==== teamF スモークテスト ====");
results.forEach((r) => console.log(r));
console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"}`);

await browser.close();
process.exit(failed === 0 ? 0 : 1);
