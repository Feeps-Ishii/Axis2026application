import { chromium } from "playwright";

const BASE = "http://localhost:3010/team-apps/teamG";
const results = [];
let failed = 0;

const browser = await chromium.launch();
const page = await browser.newPage();
let errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

async function step(name, fn) {
  try { await fn(); results.push("✅ " + name); }
  catch (e) { failed++; results.push(`❌ ${name} — ${e.message.split("\n")[0]} @ ${page.url()}`); try { await page.screenshot({ path: `/tmp/teamG-fail-${results.length}.png` }); } catch {} }
}

async function loginAs(loginId) {
  await page.goto(`${BASE}/login.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => TeamG.resetData());
  await page.goto(`${BASE}/login.html`, { waitUntil: "networkidle" });
  await page.fill("#loginId", loginId);
  await page.fill("#password", "password");
  await page.click("#loginForm button[type=submit]");
  await page.waitForLoadState("networkidle");
}

// ---- ログイン3ロール ----
await step("管理者ログイン admin001 → admin_dashboard", async () => {
  await loginAs("admin001"); await page.waitForURL("**/admin_dashboard.html", { timeout: 5000 });
});
await step("ヘルパーログイン staff001 → helper_dashboard", async () => {
  await loginAs("staff001"); await page.waitForURL("**/helper_dashboard.html", { timeout: 5000 });
});
await step("家族ログイン family001 → careuser_dashboard", async () => {
  await loginAs("family001"); await page.waitForURL("**/careuser_dashboard.html", { timeout: 5000 });
});

async function sweep(label, pages) {
  for (const p of pages) {
    await step(`起動[${label}]: ${p}`, async () => {
      errors = [];
      await page.goto(`${BASE}/${p}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(150);
      const defined = await page.evaluate(() => typeof window.TeamG !== "undefined");
      if (!defined) throw new Error("TeamG undefined");
      const len = await page.evaluate(() => (document.body.innerText || "").trim().length);
      if (len < 15) throw new Error("本文未描画(len=" + len + ")");
      if (errors.length) throw new Error("JSエラー: " + errors.slice(0, 2).join(" | "));
    });
  }
}

await loginAs("admin001");
await sweep("admin", [
  "admin_dashboard.html",
  "careuser_list.html", "careuser_detail.html?careUserId=1", "careuser_edit.html?careUserId=1", "careuser_register.html",
  "staff_list.html", "staff_detail.html?staffId=1", "staff_edit.html?staffId=1", "staff_register.html",
  "plan_list.html", "plan_detail.html?planId=1", "plan_edit.html?planId=1", "plan_register.html",
  "billing.html", "billing.html?startDate=2026-06-01&endDate=2026-06-30",
  "visitreport_list.html", "visitreport_detail.html?visitRecordId=1",
  "familyreport_list.html", "familyreport_detail.html?familyReportId=3",
  "unapproval_report_list.html", "approval.html?familyReportId=1",
  "handover_list.html", "handover_detail.html?handoverNoteId=1",
  "familycontact_list.html", "familycontact_detail.html?contactId=1",
  "complete.html?title=テスト&message=テスト完了",
]);

await loginAs("staff001");
await sweep("helper", [
  "helper_dashboard.html",
  "visitreport_list.html", "visitreport_detail.html?visitRecordId=1",
  "report_register.html", "report_confirm.html",
  "familyreport_list.html", "familyreport_detail.html?familyReportId=1",
  "handover_list.html", "handover_detail.html?handoverNoteId=1",
  "familycontact_list.html", "familycontact_detail.html?contactId=1",
]);

await loginAs("family001");
await sweep("family", [
  "careuser_dashboard.html", "familyreport_list.html",
]);

// ---- データ層アサーション（ブラウザコンテキストで TeamG を直接検証） ----
await step("データ層: マスタ件数", async () => {
  await loginAs("admin001");
  const r = await page.evaluate(() => ({
    careUsers: TeamG.careUsers().length, staff: TeamG.staffList().length, plans: TeamG.plans().length,
    visits: TeamG.visitRecords().length, reports: TeamG.familyReports().length,
    activePlans: TeamG.searchActivePlans("").length,
  }));
  if (r.careUsers !== 2 || r.staff !== 3 || r.plans !== 2 || r.visits !== 4 || r.activePlans !== 2)
    throw new Error("件数不一致: " + JSON.stringify(r));
});

await step("データ層: ダッシュボード集計", async () => {
  const r = await page.evaluate(() => ({
    unapproved: TeamG.countUnapprovedReports(),
    billing: TeamG.billingList("2026-06-01", "2026-06-30").length,
    userCharge: TeamG.userCharge(2780), insurance: TeamG.insuranceCharge(2780),
  }));
  // visitRecords approvalStatus=1 → 2件 (records 1,2)
  if (r.unapproved !== 2) throw new Error("未承認件数=2 期待, 実=" + r.unapproved);
  // 承認済み(2)は record3 のみ → billing 1件
  if (r.billing !== 1) throw new Error("請求件数=1 期待, 実=" + r.billing);
  if (r.userCharge !== 278 || r.insurance !== 2502) throw new Error("請求計算: " + JSON.stringify(r));
});

await step("データ層: 役割別フィルタ(家族報告)", async () => {
  const r = await page.evaluate(() => ({
    adminList: TeamG.familyReportListByRole(null, 1, null, null).length,
    helperList: TeamG.familyReportListByRole(null, 2, 1, null).length, // staff1 assigned cu1（公開済みなし）
    familyList: TeamG.familyReportListByRole(null, 3, null, 1).length, // cu1（公開済みなし）
  }));
  // 公開済み&承認済みは report3(cu2) のみ → admin 1件, staff1(cu1担当) 0件, family cu1 0件
  if (r.adminList !== 1) throw new Error("admin家族報告一覧=1 期待, 実=" + r.adminList);
});

// ---- フロー: 利用者登録 ----
await step("フロー: 利用者登録(careUserRegister)", async () => {
  const before = await page.evaluate(() => TeamG.careUsers().length);
  const after = await page.evaluate(() => {
    TeamG.careUserRegister({ careUserName: "検証 太郎", birthDate: "1950-01-01", age: 75, gender: 1, postalCode: "1000001", address: "東京都テスト1-1", phoneNumber: "0312340000", loginId: "verifyuser1", password: "verifypass1" });
    return TeamG.careUsers().length;
  });
  if (after !== before + 1) throw new Error("利用者が増えない");
  const exists = await page.evaluate(() => TeamG.loginIdExists("verifyuser1"));
  if (!exists) throw new Error("loginId未登録");
});

// ---- フロー: プラン登録 + 停止 ----
await step("フロー: プラン登録→停止", async () => {
  const r = await page.evaluate(() => {
    TeamG.planRegister({ planName: "検証プラン", serviceContent: "テスト", feeAmount: 3000 });
    const all = TeamG.plans();
    const p = all.find((x) => x.planName === "検証プラン");
    TeamG.planSetActive(p.planId, false);
    return { active: TeamG.searchActivePlans("").some((x) => x.planName === "検証プラン"), stopped: TeamG.searchStoppedPlans("").some((x) => x.planName === "検証プラン") };
  });
  if (r.active || !r.stopped) throw new Error("停止反映されず: " + JSON.stringify(r));
});

// ---- フロー: 全報告登録（ヘルパー draft → registerAllReport） ----
await step("フロー: 全報告登録(registerAllReport)", async () => {
  const r = await page.evaluate(() => {
    const before = TeamG.visitRecords().length;
    const draft = { visitRecord: { careUserId: 1, planId: 1, visitDate: "2026-06-09", startTime: "09:00", endTime: "10:00", bodyTemperature: 36.5, bloodPressureHigh: 120, bloodPressureLow: 80, pulse: 70, spo2: 98, mealAmount: 8, waterAmount: 500, sleepStatus: "7", stoolCount: 0, urineCount: 0 }, familyReport: { reportContent: "検証報告" }, handoverNote: { nextStaffNote: "検証申し送り" } };
    const id = TeamG.registerAllReport(draft, 1);
    return { delta: TeamG.visitRecords().length - before, status: TeamG.visitRecord(id).approvalStatus };
  });
  if (r.delta !== 1 || r.status !== 1) throw new Error("全報告登録が反映されない: " + JSON.stringify(r));
});

// ---- フロー: 承認（差戻し → 承認） ----
await step("フロー: 家族報告 承認(approveReport)", async () => {
  const r = await page.evaluate(() => {
    TeamG.approveReport(1, 3); // familyReport1 (visit1) を承認
    const f = TeamG.familyReport(1); const v = TeamG.visitRecord(f.visitRecordId);
    return { published: f.isPublished, status: v.approvalStatus };
  });
  if (r.published !== true || r.status !== 2) throw new Error("承認が反映されない: " + JSON.stringify(r));
});

await step("フロー: 家族報告 差戻し(rejectReport)", async () => {
  const r = await page.evaluate(() => {
    TeamG.rejectReport(2, "内容を具体的に", 3);
    const f = TeamG.familyReport(2); const v = TeamG.visitRecord(f.visitRecordId);
    const detail = TeamG.familyReportDetailByRole(2, 1, null, null);
    return { published: f.isPublished, status: v.approvalStatus, reason: detail.rejectReason };
  });
  if (r.published !== false || r.status !== 3 || r.reason !== "内容を具体的に") throw new Error("差戻しが反映されない: " + JSON.stringify(r));
});

// ---- フロー: 申し送り詳細で確認済み ----
await step("フロー: 申し送り詳細で確認済み化", async () => {
  const r = await page.evaluate(() => {
    const before = TeamG.handoverNote(1).confirmStatus;
    TeamG.handoverDetailByRole(1, 1, null);
    return { before, after: TeamG.handoverNote(1).confirmStatus };
  });
  if (r.after !== "confirmed") throw new Error("確認済みにならない: " + JSON.stringify(r));
});

// ---- フロー: 家族連絡詳細で確認済み（staff1=contact1受信者） ----
await step("フロー: 家族連絡詳細で確認済み化", async () => {
  const r = await page.evaluate(() => {
    TeamG.familyContactDetail(1, 1);
    return TeamG.familyContact(1).confirmStatus;
  });
  if (r !== true) throw new Error("確認済みにならない: " + r);
});

// ---- フロー: 連絡事項送信（家族→ヘルパー） ----
await step("フロー: 家族連絡送信(sendFamilyContact)", async () => {
  const r = await page.evaluate(() => {
    const before = TeamG.familyContacts().length;
    TeamG.sendFamilyContact(1, { receiverValue: "HELPER:1", contactCategory: "相談", importance: "high", contactContent: "検証連絡" });
    return TeamG.familyContacts().length - before;
  });
  if (r !== 1) throw new Error("連絡が増えない");
});

// ---- 役割ガード ----
await step("役割ガード: 家族が admin_dashboard → login へ", async () => {
  await loginAs("family001");
  await page.goto(`${BASE}/admin_dashboard.html`, { waitUntil: "networkidle" });
  await page.waitForTimeout(150);
  if (!page.url().includes("login.html")) throw new Error("家族が管理者画面に入れる");
});

console.log("\n==== teamG smoke ====");
results.forEach((r) => console.log(r));
console.log(`\n${results.length - failed}/${results.length} passed, ${failed} failed`);
await browser.close();
process.exit(failed ? 1 : 0);
