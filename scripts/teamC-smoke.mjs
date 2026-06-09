import { chromium } from "playwright";

const BASE = "http://localhost:3010/team-apps/teamC";
const results = [];
let failed = 0;

const browser = await chromium.launch();
const page = await browser.newPage();
let errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

async function step(name, fn) {
  try { await fn(); results.push("✅ " + name); }
  catch (e) {
    failed++;
    results.push(`❌ ${name} — ${e.message.split("\n")[0]} @ ${page.url()}`);
    try { await page.screenshot({ path: `/tmp/teamC-fail-${results.length}.png` }); } catch {}
  }
}
async function loginAs(id) {
  await page.goto(`${BASE}/login.html`);
  await page.fill("#loginId", id);
  await page.fill("#password", "password");
  await page.click("#loginForm button[type=submit]");
}

// ---- ログイン（教室長）----
await step("教室長ログイン(manager1)→ダッシュボード", async () => {
  await loginAs("manager1");
  await page.waitForURL("**/admin_dashboard.html", { timeout: 5000 });
});

// ---- 全ページ クリーン起動スイープ（db.js契約の実行時エラー検出）----
const sweep = [
  "admin_dashboard.html",
  "teachers.html", "teacher_detail.html?teacherId=1", "teacher_register.html",
  "teacher_edit.html?teacherId=1", "teacher_delete_confirm.html?teacherId=1",
  "students.html", "student_carte.html?studentId=1", "student_register.html",
  "student_info_edit.html?studentId=1", "student_delete_confirm.html?studentId=1",
  "student_class_records.html?studentId=1", "class_record_input.html?studentId=1",
  "class_record_edit.html?studentId=1&recordId=1", "class_record_delete_confirm.html?studentId=1&recordId=1",
  "student_grades.html?studentId=1", "grade_add.html?studentId=1",
  "grade_edit.html?studentId=1&gradeId=1", "grade_delete_confirm.html?studentId=1&gradeId=1",
  "student_homework.html?studentId=1", "homework_add.html?studentId=1",
  "homework_edit.html?studentId=1&homeworkId=1", "homework_delete_confirm.html?studentId=1&homeworkId=1",
  "announce_input.html", "announce_edit.html?noticeId=1", "announce_delete_confirm.html?noticeId=1",
  "schedule_month.html", "schedule_week.html", "reservation_input.html",
  "reservation_change.html?reservationId=1", "reservation_delete_confirm.html?reservationId=1",
  "reservation_input_complete.html", "announce_complete.html",
];
for (const path of sweep) {
  await step(`起動: ${path}`, async () => {
    errors = [];
    await page.goto(`${BASE}/${path}`, { waitUntil: "networkidle" });
    if (!(await page.evaluate(() => typeof window.TeamC !== "undefined"))) throw new Error("TeamC undefined");
    const len = await page.evaluate(() => (document.body.innerText || "").trim().length);
    if (len < 20) throw new Error("本文未描画(len=" + len + ")");
    if (errors.length) throw new Error("JSエラー: " + errors.slice(0, 2).join(" | "));
  });
}

// ---- データ結線チェック ----
await step("生徒一覧に40名 + 名前描画", async () => {
  await page.goto(`${BASE}/students.html`, { waitUntil: "networkidle" });
  const n = await page.evaluate(() => window.TeamC.activeStudents().length);
  if (n !== 40) throw new Error("students=" + n);
  if (!(await page.textContent("body")).includes("佐藤 一郎")) throw new Error("名前なし");
});
await step("講師一覧に10名", async () => {
  await page.goto(`${BASE}/teachers.html`, { waitUntil: "networkidle" });
  const n = await page.evaluate(() => window.TeamC.activeTeachers().length);
  if (n !== 10) throw new Error("teachers=" + n);
});
await step("生徒カルテ/成績/記録/宿題が結合表示", async () => {
  await page.goto(`${BASE}/student_grades.html?studentId=1`, { waitUntil: "networkidle" });
  const g = await page.evaluate(() => window.TeamC.gradesByStudent(1).length);
  const r = await page.evaluate(() => window.TeamC.classRecordsByStudent(1).length);
  const h = await page.evaluate(() => window.TeamC.homeworksByStudent(1).length);
  if (!(g > 0 && r > 0 && h > 0)) throw new Error(`g=${g} r=${r} h=${h}`);
});
await step("月カレンダーに当月予約が存在", async () => {
  await page.goto(`${BASE}/schedule_month.html`, { waitUntil: "networkidle" });
  const n = await page.evaluate(() => window.TeamC.reservationsInRange("2026-06-01", "2026-06-30").length);
  if (n < 1) throw new Error("range=" + n);
});

// ---- お知らせ 作成フロー（入力→確認→完了、永続化）----
await step("お知らせ 作成→確認→登録→完了→件数増加", async () => {
  const before = await page.evaluate(() => window.TeamC.notices().length);
  await page.goto(`${BASE}/announce_input.html`, { waitUntil: "networkidle" });
  await page.fill("#title", "スモークお知らせ");
  await page.fill("#content", "スモークテスト本文");
  await page.selectOption("#targetRole", { index: 0 });
  await page.fill("#startDate", "2026-06-09");
  await page.click("#noticeForm button[type=submit]");
  await page.waitForURL("**/announce_confirm.html", { timeout: 5000 });
  await page.click("#registerBtn");
  await page.waitForURL("**/announce_complete.html", { timeout: 5000 });
  const after = await page.evaluate(() => window.TeamC.notices().length);
  if (after !== before + 1) throw new Error(`${before}->${after}`);
});

// ---- 予約 削除フロー（確認→削除→完了、永続化）----
await step("予約 削除確認→削除→完了→予約消滅", async () => {
  const before = await page.evaluate(() => window.TeamC.reservation(1) != null);
  await page.goto(`${BASE}/reservation_delete_confirm.html?reservationId=1`, { waitUntil: "networkidle" });
  await page.click("#deleteBtn");
  await page.waitForURL("**/reservation_delete_complete.html", { timeout: 5000 });
  const after = await page.evaluate(() => window.TeamC.reservation(1) != null);
  if (!(before && !after)) throw new Error(`before=${before} after=${after}`);
});

// ---- 講師ログインで予約カスケードの availability が機能（教室長は所属校舎なしのため講師で検証）----
await step("講師ログイン→予約カスケードavailabilityが返る", async () => {
  await loginAs("teacher01");
  await page.waitForURL("**/admin_dashboard.html", { timeout: 5000 });
  await page.goto(`${BASE}/reservation_input.html`, { waitUntil: "networkidle" });
  const loc = await page.evaluate(() => window.TeamC.userLocation(window.TeamC.loginUser()));
  const cls = await page.evaluate((l) => window.TeamC.availableClassrooms("個別", l).length, loc);
  if (!loc) throw new Error("location空");
  if (cls < 1) throw new Error("教室候補=" + cls + " (loc=" + loc + ")");
});

// ---- 生徒ログイン → 自分のカルテへ ----
await step("生徒ログイン(student01)→カルテ表示", async () => {
  await loginAs("student01");
  await page.waitForURL("**/student_carte.html**", { timeout: 5000 });
  const t = await page.textContent("body");
  if (!t.includes("佐藤 一郎")) throw new Error("カルテに氏名なし");
});

console.log("\n==== teamC スモークテスト ====");
results.forEach((r) => console.log(r));
console.log(`\n${failed === 0 ? "ALL PASS" : failed + " FAILED"}`);

await browser.close();
process.exit(failed === 0 ? 0 : 1);
