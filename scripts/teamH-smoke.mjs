import { chromium } from "playwright";

const BASE = "http://localhost:3010/team-apps/teamH";
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
    try { await page.screenshot({ path: `/tmp/teamH-fail-${results.length}.png` }); } catch {}
  }
}

async function loginAs(loginId) {
  await page.goto(`${BASE}/login.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => TeamH.resetData());
  await page.goto(`${BASE}/login.html`, { waitUntil: "networkidle" });
  await page.fill('input[name="login_id"]', loginId);
  await page.fill('input[name="password"]', "password");
  await page.click('#loginForm button[type="submit"]');
  await page.waitForLoadState("networkidle");
}

// ---- ログイン（3ロール） ----
await step("管理者ログイン admin001 → admin_dashboard", async () => {
  await loginAs("admin001");
  await page.waitForURL("**/admin_dashboard.html", { timeout: 5000 });
});
await step("職人ログイン craftsman001 → todo", async () => {
  await loginAs("craftsman001");
  await page.waitForURL("**/todo.html", { timeout: 5000 });
});
await step("営業ログイン sales001 → progress_list", async () => {
  await loginAs("sales001");
  await page.waitForURL("**/progress_list.html", { timeout: 5000 });
});

// ---- 全画面 クリーン起動スイープ（JSエラー0 + TeamH定義 + 本文描画） ----
async function sweep(label, pages) {
  for (const path of pages) {
    await step(`起動[${label}]: ${path}`, async () => {
      errors = [];
      await page.goto(`${BASE}/${path}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      const defined = await page.evaluate(() => typeof window.TeamH !== "undefined");
      if (!defined) throw new Error("TeamH undefined");
      const len = await page.evaluate(() => (document.body.innerText || "").trim().length);
      if (len < 20) throw new Error("本文未描画(len=" + len + ")");
      if (errors.length) throw new Error("JSエラー: " + errors.slice(0, 2).join(" | "));
    });
  }
}

await loginAs("admin001");
await sweep("admin", [
  "admin_dashboard.html",
  "admin_dashboard.html?flowWorkOrderId=3",
  "progress_list.html",
  "progress_detail.html?id=1",
  "progress_update.html?admin=1&workOrderProcessId=2",
  "progress_report_edit.html?reportId=1",
  "progress_report_edit.html?reportId=1&processId=2",
  "work_orders.html",
  "work_orders.html?status=active",
  "work_order_form.html",
  "work_orders_edit.html?id=1",
  "work_orders_delete.html?id=2",
  "work_instruction_detail.html?workOrderId=1",
  "knowledge_list.html",
  "knowledge_detail.html?id=1",
  "knowledge_file.html?id=2",
  "knowledge_form.html",
  "knowledge_edit.html?id=1",
  "knowledge_delete.html?id=1",
  "knowledge_delete_confirm.html?id=1",
  "regist_user.html",
  "complete.html?type=create",
  "no_permission.html?message=test",
]);

await loginAs("craftsman001");
await sweep("craftsman", [
  "todo.html",
  "progress_list.html",
  "progress_detail.html?id=1",
  "progress_update.html?workOrderProcessId=2",
  "worker_navigation.html?workOrderProcessId=2",
  "work_instruction_detail.html?workOrderProcessId=2",
  "knowledge_list.html",
  "knowledge_detail.html?id=2",
]);

// ---- データ結線の確認 ----
await step("管理者ダッシュボード: 稼働率/サマリー/グループ描画", async () => {
  await loginAs("admin001");
  await page.goto(`${BASE}/admin_dashboard.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  const rate = await page.textContent("#opRate");
  if (!/^\d+$/.test(rate.trim())) throw new Error("稼働率未描画: " + rate);
  const total = (await page.textContent("#opTotal")).trim();
  if (total !== "15") throw new Error("総台数=15 期待, 実=" + total);
  const groups = await page.$$eval("#groupsBody tr", (r) => r.length);
  if (groups < 2) throw new Error("本日の作業グループ未描画");
});

await step("進捗一覧: グループ展開で工程行が出る", async () => {
  await page.goto(`${BASE}/progress_list.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const rows = await page.$$eval("#groupsBody tr", (r) => r.length);
  if (rows < 2) throw new Error("進捗グループ未描画");
});

await step("進捗詳細: 進捗管理書シート描画", async () => {
  await page.goto(`${BASE}/progress_detail.html?id=1`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const txt = await page.textContent(".sheet");
  if (!txt.includes("進捗管理書")) throw new Error("シート未描画");
  if (!txt.includes("医療機器用シャフト")) throw new Error("受注データ未結線");
});

await step("作業指示書一覧: 受注5件描画", async () => {
  await page.goto(`${BASE}/work_orders.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const rows = await page.$$eval("tbody tr", (r) => r.length);
  if (rows < 5) throw new Error("作業指示書 行数=" + rows);
});

await step("技能継承一覧: カード描画(工程グループ)", async () => {
  await page.goto(`${BASE}/knowledge_list.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const cards = await page.$$eval(".knowledge-card", (r) => r.length);
  if (cards < 3) throw new Error("ナレッジカード数=" + cards);
});

// ---- フロー: 技能継承 登録（form → confirm → complete → 一覧反映） ----
await step("技能継承 登録フロー", async () => {
  await page.goto(`${BASE}/knowledge_form.html`, { waitUntil: "networkidle" });
  await page.fill('[name="title"]', "テスト技能");
  await page.fill('[name="targetPart"]', "テスト部品");
  await page.fill('[name="description"]', "概要テスト");
  await page.fill('[name="workContent"]', "作業内容テスト");
  await page.fill('[name="notes"]', "注意事項テスト");
  await page.fill('[name="registeredByName"]', "検証者");
  await page.click('button[type="submit"].primary, .btn.primary[type="submit"], button.btn.primary');
  await page.waitForURL("**/knowledge_create_confirm.html", { timeout: 5000 });
  await page.click("#submitBtn");
  await page.waitForURL("**/complete.html**", { timeout: 5000 });
  // 一覧に反映
  await page.goto(`${BASE}/knowledge_list.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const body = await page.textContent("main");
  if (!body.includes("テスト技能")) throw new Error("登録した技能が一覧に出ない");
});

// ---- フロー: ユーザー登録（regist → confirm → complete → ログイン可能） ----
await step("ユーザー登録フロー + 新規ユーザーでログイン", async () => {
  await page.goto(`${BASE}/regist_user.html`, { waitUntil: "networkidle" });
  await page.fill('[name="name"]', "検証 太郎");
  await page.fill('[name="loginId"]', "verify001");
  await page.fill('[name="password"]', "verifypass");
  await page.selectOption('[name="role"]', "craftsman");
  await page.click("form button[type=submit]");
  await page.waitForURL("**/regist_user_confirm.html", { timeout: 5000 });
  await page.click("#confirmBtn");
  await page.waitForURL("**/complete.html**", { timeout: 5000 });
  const ok = await page.evaluate(() => TeamH.loginIdExists("verify001"));
  if (!ok) throw new Error("ユーザーが追加されていない");
});

// ---- フロー: 職人 進捗 開始（startProgress 永続化） ----
await step("職人: 工程開始(startProgress)で状態が変わる", async () => {
  await loginAs("craftsman001");
  // craftsman001 = userId 2。未着手の担当工程 wopId=4 (J-202606-002 マシニング加工)
  await page.goto(`${BASE}/progress_update.html?workOrderProcessId=4`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => TeamH.workOrderProcess(4).currentStatus);
  await page.evaluate(() => TeamH.startProgress(4));
  const after = await page.evaluate(() => TeamH.workOrderProcess(4).currentStatus);
  if (before !== "not_started" || after === "not_started") throw new Error(`開始が反映されない before=${before} after=${after}`);
});

// ---- フロー: 進捗管理書編集（edit → confirm → 確定 → 反映） ----
await step("管理者: 進捗管理書編集フロー", async () => {
  await loginAs("admin001");
  await page.goto(`${BASE}/progress_report_edit.html?reportId=1&processId=2`, { waitUntil: "networkidle" });
  await page.waitForTimeout(200);
  // 更新フォームのコメントを書き換えて送信
  const hasForm = await page.$("#update-form, form");
  if (!hasForm) throw new Error("編集フォーム未表示");
  await page.fill('textarea[name="comment"]', "検証コメント更新");
  await page.click("form button[type=submit], .button-area button[type=submit], button.btn.primary");
  await page.waitForURL("**/progress_report_edit_confirm.html**", { timeout: 5000 });
  await page.click("#confirmBtn");
  await page.waitForURL("**/complete.html**", { timeout: 5000 });
  const c = await page.evaluate(() => TeamH.prpById(2).comment);
  if (c !== "検証コメント更新") throw new Error("コメント更新が反映されない: " + c);
});

// ---- フロー: 作業指示書 削除 ----
await step("管理者: 作業指示書削除フロー", async () => {
  await page.goto(`${BASE}/work_orders_delete.html?id=2`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  await page.check("#delete-checkbox");
  await page.click("#delete-btn");
  await page.waitForURL("**/complete.html**", { timeout: 5000 });
  const gone = await page.evaluate(() => TeamH.workOrder(2) === null);
  if (!gone) throw new Error("作業指示書2が削除されていない");
});

// ---- 役割ガード ----
await step("役割ガード: 営業が admin_dashboard → login へ", async () => {
  await loginAs("sales001");
  await page.goto(`${BASE}/admin_dashboard.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  if (!page.url().includes("login.html")) throw new Error("営業がダッシュボードに入れてしまう");
});

console.log("\n==== teamH smoke ====");
results.forEach((r) => console.log(r));
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);

await browser.close();
process.exit(failed ? 1 : 0);
