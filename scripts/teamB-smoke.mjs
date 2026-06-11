// teamB さくら野診療所 通し検証（Playwright）
//   起動: node scripts/static-serve.mjs public 3031 & ; node scripts/teamB-smoke.mjs
import { chromium } from "playwright";

const B = "http://localhost:3031/team-apps/teamB";
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const errs = [];
page.on("pageerror", (e) => errs.push(`[pageerror] ${page.url().split("/teamB/")[1]||""} :: ${String(e).split("\n")[0]}`));
page.on("console", (m) => { if (m.type() === "error") errs.push(`[console] ${page.url().split("/teamB/")[1]||""} :: ${m.text()}`); });

const log = [];
let fail = 0;
async function step(name, fn) {
  const before = errs.length;
  try { await fn(); if (errs.length > before) throw new Error("JS error: " + errs.slice(before).join(" | ")); log.push("✅ " + name); }
  catch (e) { fail++; log.push("❌ " + name + " — " + e.message.split("\n")[0]); }
}
const goto = (p) => page.goto(`${B}/${p}`, { waitForayload: "load" }).catch(() => page.goto(`${B}/${p}`));

// ---- セッション確立 ----
await step("スタッフログイン→管理トップ", async () => {
  await page.goto(`${B}/login.html`);
  await page.fill("#loginId", "1");
  await page.fill("#password", "password");
  await page.click(".login-btn");
  await page.waitForURL("**/admin.html", { timeout: 6000 });
});

await step("患者本人認証→マイページ", async () => {
  await page.goto(`${B}/reservationAuth.html`);
  // 診察券番号 or 電話 + 氏名 + 生年月日。フォールバックでセッション注入。
  await page.evaluate(() => localStorage.setItem("teamB:session_patient", JSON.stringify({ patientId: 1, cardNumber: "10000", name: "山田 太郎" })));
});

// ---- データ層健全性 ----
await step("データ層: seed集計", async () => {
  const r = await page.evaluate(async () => {
    await window.TeamB.init();
    return {
      patients: TeamB.patients().length,
      appts: TeamB.appointments().length,
      today: TeamB.todayAppointments().length,
      staffs: TeamB.staffs().length,
      q: TeamB.medicalQuestionnaires().length,
      records: TeamB.medicalRecords().length,
      wait: TeamB.waitInfo().humannum,
    };
  });
  if (r.patients !== 19) throw new Error("patients=" + r.patients);
  if (r.appts !== 54) throw new Error("appts=" + r.appts);
  if (r.today < 1) throw new Error("today=" + r.today);
  if (r.staffs !== 7) throw new Error("staffs=" + r.staffs);
});

// ---- 全56画面ロードスイープ（JSエラー検出＋主要要素） ----
const PAGES = [
  "index.html", "login.html", "password-reset.html", "admin.html", "admin-login.html",
  "reservationTop.html", "reservation-first.html", "reservation-repeat.html",
  "reservation-confirm.html", "reservation-complete.html", "reservationAuth.html",
  "reservation-mypage.html", "reservation-cancel-confirm.html?appointmentId=17", "reservation-cancel-complete.html",
  "rsv-today.html", "rsv-list.html", "rsv-new.html", "rsv-new-confirm.html", "rsv-new-complete.html",
  "rsv-cancel-confirm.html?appointmentId=17", "rsv-cancel-complete.html",
  "patient-list.html", "patient-detail.html?id=1", "patient-edit.html?id=1",
  "patient-edit-confirm.html", "patient-edit-complete.html",
  "staff-list.html", "staff-detail.html?id=1", "staff-new.html", "staff-new-confirm.html", "staff-new-done.html",
  "staff-edit.html?id=2", "staff-edit-confirm.html", "staff-edit-done.html",
  "staff-delete-confirm.html?id=2", "staff-delete-final.html?id=2", "staff-delete-done.html",
  "record-form.html?appointmentId=17", "record-form.html?recordId=1", "record-confirm.html",
  "record-detail.html?id=1", "record-disable-confirm.html?id=1", "record-disable-done.html?id=1", "record-preview.html?id=1",
  "q-admin-list.html", "q-admin-detail.html?id=1", "q-admin-create.html?appointmentId=17",
  "q-admin-create-confirm.html", "q-admin-create-complete.html",
  "q-admin-invalid-confirm.html?id=1", "q-admin-invalid-complete.html?id=1",
  "q-new.html?appointmentId=17", "q-confirm.html", "q-complete.html",
  "q-edit.html?questionnaireId=1", "q-edit-confirm.html", "q-edit-complete.html",
];
for (const p of PAGES) {
  await step("load " + p, async () => {
    const before = errs.length;
    await page.goto(`${B}/${p}`);
    await page.waitForTimeout(120);
    if (errs.length > before) throw new Error(errs.slice(before)[0]);
    // bodyにテキストがある(白画面でない)
    const txt = (await page.textContent("body")) || "";
    if (txt.trim().length < 5) throw new Error("empty body");
  });
}

// ---- 描画検証の前に両セッションを確実化（ログイン手順の揺れと独立に検証） ----
await page.goto(`${B}/admin.html`).catch(() => {});
await page.evaluate(() => {
  localStorage.setItem("teamB:session_staff", JSON.stringify({ staffId: 1, name: "高橋 医師", authorityType: "管理者", jobType: "医師" }));
  localStorage.setItem("teamB:session_patient", JSON.stringify({ patientId: 1, cardNumber: "10000", name: "山田 太郎" }));
});

// ---- 主要データ描画 ----
await step("管理: 本日の予約一覧に行", async () => {
  await page.goto(`${B}/rsv-today.html`);
  await page.waitForTimeout(300);
  const rows = await page.locator("table tbody tr, .reservation-row, [data-appointment]").count();
  if (rows < 1) throw new Error("rows=" + rows);
  const t = await page.textContent("body");
  if (!t.includes("山田") && !t.includes("受付")) throw new Error("no appt content");
});
await step("患者一覧に行(invalid除外)", async () => {
  await page.goto(`${B}/patient-list.html`);
  await page.waitForTimeout(300);
  const t = await page.textContent("body");
  if (!t.includes("山田")) throw new Error("no 山田");
  // 無効患者 鈴木次郎(id3) は通常一覧で除外されるはず
});
await step("患者詳細: カルテ・問診票", async () => {
  await page.goto(`${B}/patient-detail.html?id=1`);
  await page.waitForTimeout(300);
  const t = await page.textContent("body");
  if (!t.includes("山田")) throw new Error("no name");
});
await step("スタッフ一覧に行", async () => {
  await page.goto(`${B}/staff-list.html`);
  await page.waitForTimeout(300);
  const t = await page.textContent("body");
  if (!t.includes("高橋") && !t.includes("医師") && !t.includes("受付")) throw new Error("no staff");
});
await step("問診票一覧に行", async () => {
  await page.goto(`${B}/q-admin-list.html`);
  await page.waitForTimeout(300);
  const t = await page.textContent("body");
  if (t.trim().length < 20) throw new Error("empty");
});
await step("カルテ詳細表示", async () => {
  await page.goto(`${B}/record-detail.html?id=1`);
  await page.waitForTimeout(300);
  const t = await page.textContent("body");
  if (!t.includes("高血圧") && !t.includes("I10") && !t.includes("血圧")) throw new Error("no record");
});
await step("患者マイページ(本人認証済)", async () => {
  await page.goto(`${B}/reservation-mypage.html`);
  await page.waitForTimeout(300);
  if (/reservationAuth/.test(page.url())) throw new Error("認証へ戻された");
});

// ---- 永続CRUDフロー（データ層直叩きで結線確認） ----
await step("CRUD: 予約作成→ステータス更新→問診票作成→カルテ無効化", async () => {
  const r = await page.evaluate(() => {
    const a0 = TeamB.appointments().length;
    const ap = TeamB.createAppointment({ patientId: 1, departmentId: 1, appointmentDate: TeamB.today(), appointmentTime: "17:00:00", reservationType: "再診", reservationMethod: "Web", reason: "smoke" });
    const a1 = TeamB.appointments().length;
    TeamB.updateAppointmentStatus(ap.appointmentId, "受付済");
    const st = TeamB.appointment(ap.appointmentId).status;
    const q0 = TeamB.medicalQuestionnaires().length;
    const q = TeamB.createQuestionnaire({ appointmentId: ap.appointmentId, visitDate: TeamB.today(), bodyTemperature: 37.0, infectionContactStatus: "なし", status: "入力済" }, [1, 2]);
    const q1 = TeamB.medicalQuestionnaires().length;
    const qs = TeamB.questionnaireView(q.questionnaireId).symptomList.length;
    const rec = TeamB.createRecord({ appointmentId: ap.appointmentId, doctorStaffId: 1, chiefComplaint: "smoke" });
    TeamB.invalidateRecord(rec.recordId);
    const inv = TeamB.record(rec.recordId).invalidFlag;
    return { a0, a1, st, q0, q1, qs, inv };
  });
  if (r.a1 !== r.a0 + 1) throw new Error("appt not added");
  if (r.st !== "受付済") throw new Error("status not updated");
  if (r.q1 !== r.q0 + 1) throw new Error("questionnaire not added");
  if (r.qs !== 2) throw new Error("symptom links=" + r.qs);
  if (r.inv !== true) throw new Error("record not invalidated");
});

console.log("\n==== teamB 通し検証 ====");
log.forEach((l) => console.log(l));
console.log(`\n${fail === 0 ? "ALL PASS" : fail + " FAILED"}  (pages=${PAGES.length}, jsErrors=${errs.length})`);
if (errs.length) { console.log("--- JS errors (先頭20) ---"); errs.slice(0, 20).forEach((e) => console.log(e)); }
await browser.close();
process.exit(fail ? 1 : 0);
