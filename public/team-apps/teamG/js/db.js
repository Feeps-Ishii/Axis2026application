/*
 * TeamG —「ひだまり支援センター 事務作業管理システム」(訪問介護) 擬似データ層。
 * Spring Boot + JPA/MySQL を localStorage で再現。seed.json 投入 + 参照/検索/集計/更新 + 擬似セッション。
 * roleType: 1=管理者(admin) 2=スタッフ/ヘルパー(helper) 3=利用者/家族(family)。
 * 名前空間 "teamG:"。ステータス・並び順・ロール別フィルタは元 Repository/Service に準拠。
 */
(function () {
  const NS = "teamG:";
  const SEED_FLAG = NS + "seeded:v1";
  const SESSION_KEY = NS + "session";
  const K = {
    userAccounts: NS + "userAccounts",
    staff: NS + "staff",
    careUsers: NS + "careUsers",
    helperAssignments: NS + "helperAssignments",
    servicePlans: NS + "servicePlans",
    visitRecords: NS + "visitRecords",
    familyReports: NS + "familyReports",
    handoverNotes: NS + "handoverNotes",
    familyContacts: NS + "familyContacts",
    approvals: NS + "approvals",
    billingSupports: NS + "billingSupports",
    notifications: NS + "notifications",
  };
  const TODAY = new Date("2026-06-09T09:00:00");

  function read(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } }
  function write(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  async function init() {
    if (localStorage.getItem(SEED_FLAG)) return;
    const seed = await (await fetch("./data/seed.json")).json();
    Object.keys(K).forEach((key) => write(K[key], seed[key] || []));
    localStorage.setItem(SEED_FLAG, "1");
  }
  function resetData() { Object.values(K).forEach((k) => localStorage.removeItem(k)); localStorage.removeItem(SEED_FLAG); localStorage.removeItem(SESSION_KEY); }

  function nextId(rows, f) { return rows.reduce((mx, r) => Math.max(mx, Number(r[f]) || 0), 0) + 1; }

  // ---- 表示ヘルパ ----
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const d = new Date(String(v).trim().replace(" ", "T"));
    return isNaN(d.getTime()) ? null : d;
  }
  const pad = (n) => String(n).padStart(2, "0");
  function fmtDate(v, sep) { const d = parseDate(v); if (!d) return ""; sep = sep || "/"; return `${d.getFullYear()}${sep}${pad(d.getMonth() + 1)}${sep}${pad(d.getDate())}`; }
  function fmtDateTime(v) { const d = parseDate(v); if (!d) return ""; return `${fmtDate(v)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function fmtTime(v) { const d = parseDate(v); if (!d) return ""; return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function toDateInput(v) { return fmtDate(v, "-"); }
  function toTimeInput(v) { return fmtTime(v); }
  function toLocalInput(v) { const d = parseDate(v); if (!d) return ""; return `${fmtDate(v, "-")}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }
  function nowStr() { return `${fmtDate(TODAY, "-")} ${pad(TODAY.getHours())}:${pad(TODAY.getMinutes())}:00`; }

  // ---- ラベル ----
  const ROLE_LABEL = { 1: "管理者", 2: "ヘルパー", 3: "利用者・家族" };
  function approvalLabel(s) { return s === 2 ? "承認済み" : (s === 3 ? "差し戻し" : "未承認"); }
  function importanceLabel(s) {
    if (s === "high") return "高";
    if (s === "low" || s === "row") return "低";
    if (s === "normal" || s === "middle") return "中";
    return "未設定";
  }
  function confirmLabel(b) { return b === true ? "確認済み" : (b === false ? "未確認" : "未設定"); }

  // ---- マスタ ----
  const accounts = () => read(K.userAccounts);
  const account = (id) => accounts().find((a) => Number(a.accountId) === Number(id)) || null;
  const accountByLogin = (lid) => accounts().find((a) => a.loginId === lid && !a.deleteFlag) || null;
  const staffList = () => read(K.staff).filter((s) => !s.deleteFlag);
  const staff = (id) => read(K.staff).find((s) => Number(s.staffId) === Number(id)) || null;
  const staffByAccount = (accId) => read(K.staff).find((s) => Number(s.accountId) === Number(accId) && !s.deleteFlag) || null;
  const staffName = (id) => (staff(id) ? staff(id).staffName : "");
  const careUsers = () => read(K.careUsers).filter((c) => !c.deleteFlag);
  const careUser = (id) => read(K.careUsers).find((c) => Number(c.careUserId) === Number(id)) || null;
  const careUserByAccount = (accId) => read(K.careUsers).find((c) => Number(c.accountId) === Number(accId) && !c.deleteFlag) || null;
  const careUserName = (id) => (careUser(id) ? careUser(id).careUserName : "");
  const plans = () => read(K.servicePlans).filter((p) => !p.deleteFlag);
  const plan = (id) => read(K.servicePlans).find((p) => Number(p.planId) === Number(id)) || null;
  const planName = (id) => (plan(id) ? plan(id).planName : "");
  const assignments = () => read(K.helperAssignments).filter((h) => !h.deleteFlag);
  const visitRecords = () => read(K.visitRecords).filter((v) => !v.deleteFlag);
  const visitRecord = (id) => read(K.visitRecords).find((v) => Number(v.visitRecordId) === Number(id)) || null;
  const familyReports = () => read(K.familyReports).filter((f) => !f.deleteFlag);
  const familyReport = (id) => read(K.familyReports).find((f) => Number(f.familyReportId) === Number(id)) || null;
  const familyReportByVisit = (vid) => familyReports().find((f) => Number(f.visitRecordId) === Number(vid)) || null;
  const handoverNotes = () => read(K.handoverNotes).filter((h) => !h.deleteFlag);
  const handoverNote = (id) => read(K.handoverNotes).find((h) => Number(h.handoverNoteId) === Number(id)) || null;
  const familyContacts = () => read(K.familyContacts).filter((c) => !c.deleteFlag);
  const familyContact = (id) => read(K.familyContacts).find((c) => Number(c.contactId) === Number(id)) || null;
  const approvals = () => read(K.approvals).filter((a) => !a.deleteFlag);
  const billingSupports = () => read(K.billingSupports).filter((b) => !b.deleteFlag);

  // 担当判定
  function isAssigned(staffId, careUserId) {
    return assignments().some((h) => Number(h.helperStaffId) === Number(staffId) && Number(h.careUserId) === Number(careUserId));
  }
  function assignedCareUserIds(staffId) {
    return assignments().filter((h) => Number(h.helperStaffId) === Number(staffId)).map((h) => Number(h.careUserId));
  }
  // このスタッフが担当する有効な利用者
  function assignedCareUsers(staffId) {
    const ids = assignedCareUserIds(staffId);
    return careUsers().filter((c) => c.isActive && ids.includes(Number(c.careUserId)));
  }
  function unassignedCareUsers(staffId) {
    return careUsers().filter((c) => c.isActive && !isAssigned(staffId, c.careUserId));
  }
  // 利用者の担当ヘルパー一覧（main順）
  function assignedHelpers(careUserId) {
    return assignments().filter((h) => Number(h.careUserId) === Number(careUserId))
      .map((h) => ({ assignment: h, staff: staff(h.helperStaffId) }))
      .filter((x) => x.staff && !x.staff.deleteFlag)
      .sort((a, b) => (b.assignment.isMainHelper ? 1 : 0) - (a.assignment.isMainHelper ? 1 : 0) || a.staff.staffId - b.staff.staffId);
  }
  function assignedHelperStaff(careUserId) { return assignedHelpers(careUserId).map((x) => x.staff); }

  // ========== セッション ==========
  function session() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch (e) { return null; } }
  function login(loginId, password) {
    const a = accountByLogin(loginId);
    if (!a || !a.isActive) return null;
    if (a.password !== password) return null;
    let staffId = null, careUserId = null, name = "";
    if (a.roleType === 1 || a.roleType === 2) { const s = staffByAccount(a.accountId); if (s) { staffId = s.staffId; name = s.staffName; } }
    else if (a.roleType === 3) { const c = careUserByAccount(a.accountId); if (c) { careUserId = c.careUserId; name = c.careUserName; } }
    const sess = { accountId: a.accountId, roleType: a.roleType, staffId, careUserId, loginUserName: name };
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
    return sess;
  }
  function logout() { localStorage.removeItem(SESSION_KEY); location.href = "./login.html"; }
  function requireLogin() { const s = session(); if (!s || !s.accountId) { location.href = "./login.html"; return null; } return s; }
  function homeUrl(roleType) { return roleType === 1 ? "./admin_dashboard.html" : (roleType === 2 ? "./helper_dashboard.html" : (roleType === 3 ? "./careuser_dashboard.html" : "./login.html")); }
  // 権限不足 → login.html へ（元実装は redirect:/login）
  function requireRole(sess, roles) {
    if (!sess) return false;
    if (!roles.includes(sess.roleType)) { location.href = "./login.html"; return false; }
    if (sess.roleType === 2 && sess.staffId == null) { location.href = "./login.html"; return false; }
    if (sess.roleType === 3 && sess.careUserId == null) { location.href = "./login.html"; return false; }
    return true;
  }

  // ========== 管理者ダッシュボード ==========
  function countUnapprovedReports() { return visitRecords().filter((v) => v.approvalStatus === 1).length; }
  function countUnconfirmedContactsForStaff(staffId) {
    return familyContacts().filter((c) => Number(c.receiverStaffId) === Number(staffId) && c.confirmStatus === false).length;
  }
  // 未承認報告一覧(LIMIT5) → [visitRecordId, visitDate, careUserName, staffName]（テンプレ report[0],[1],[4],[5]）
  function unapprovedReportListForDashboard() {
    return visitRecords().filter((v) => v.approvalStatus === 1)
      .sort((a, b) => (parseDate(b.visitDate) - parseDate(a.visitDate)) || (parseDate(b.startTime) - parseDate(a.startTime)))
      .slice(0, 5)
      .map((v) => ({ visitRecordId: v.visitRecordId, visitDate: fmtDate(v.visitDate, "-"), careUserName: careUserName(v.careUserId), staffName: staffName(v.helperStaffId) }));
  }
  function unconfirmedContactListForDashboard(staffId) {
    return familyContacts().filter((c) => Number(c.receiverStaffId) === Number(staffId) && c.confirmStatus === false)
      .sort((a, b) => parseDate(b.sentAt) - parseDate(a.sentAt))
      .map((c) => ({ contactId: c.contactId, sentAt: fmtDateTime(c.sentAt), careUserName: careUserName(c.careUserId), importance: c.importance, confirmStatus: c.confirmStatus }));
  }

  // ========== ヘルパーダッシュボード ==========
  function unreadFamilyContactsForHelper(staffId) {
    return familyContacts().filter((c) => Number(c.receiverStaffId) === Number(staffId) && c.confirmStatus === false)
      .sort((a, b) => parseDate(b.sentAt) - parseDate(a.sentAt))
      .map((c) => ({ contactId: c.contactId, sentAt: c.sentAt, careUserName: careUserName(c.careUserId), importance: c.importance, confirmStatus: c.confirmStatus }));
  }
  // 差し戻された家族報告書（このヘルパー担当, 最新差戻し）
  function rejectedFamilyReportsForHelper(staffId) {
    return familyReports().filter((f) => {
      const v = visitRecord(f.visitRecordId);
      if (!v || Number(v.helperStaffId) !== Number(staffId) || v.approvalStatus !== 3) return false;
      return approvals().some((a) => Number(a.familyReportId) === Number(f.familyReportId) && a.approvalStatus === 3);
    }).map((f) => {
      const v = visitRecord(f.visitRecordId);
      return { familyReportId: f.familyReportId, visitDate: v ? v.visitDate : null, careUserName: careUserName(v.careUserId) };
    });
  }

  // ========== 家族ダッシュボード ==========
  function latestFamilyReportForCareUser(careUserId) {
    const list = familyReports().filter((f) => {
      const v = visitRecord(f.visitRecordId);
      return v && Number(v.careUserId) === Number(careUserId) && f.isPublished && v.approvalStatus === 2;
    }).sort((a, b) => {
      const va = visitRecord(a.visitRecordId), vb = visitRecord(b.visitRecordId);
      return (parseDate(vb.visitDate) - parseDate(va.visitDate)) || (parseDate(vb.startTime) - parseDate(va.startTime));
    });
    return list[0] || null;
  }
  function sendFamilyContact(senderCareUserId, form) {
    // receiverValue = "ADMIN" or "HELPER:{staffId}"
    let receiverStaffId;
    if (form.receiverValue === "ADMIN") {
      const admin = staffList().find((s) => { const a = account(s.accountId); return a && a.roleType === 1; });
      receiverStaffId = admin ? admin.staffId : staffList()[0].staffId;
    } else if (String(form.receiverValue).startsWith("HELPER:")) {
      receiverStaffId = Number(String(form.receiverValue).split(":")[1]);
    } else { receiverStaffId = null; }
    const all = read(K.familyContacts);
    all.push({
      contactId: nextId(all, "contactId"), careUserId: senderCareUserId, senderCareUserId: senderCareUserId,
      receiverStaffId: receiverStaffId, contactCategory: form.contactCategory || "家族連絡",
      importance: form.importance || "normal", contactContent: form.contactContent,
      confirmStatus: false, sentAt: nowStr(), confirmedAt: null, deleteFlag: false, updatedAt: nowStr(),
    });
    write(K.familyContacts, all);
  }

  // ========== 訪問報告 ==========
  // role 1:全件 / 2:担当利用者のみ。行 = {visitRecordId,visitDate,startTime,endTime,careUserName,staffName,approvalStatus}
  function searchVisitReports(roleType, staffId, f) {
    f = f || {};
    let rows = visitRecords();
    if (roleType === 2) { const ids = assignedCareUserIds(staffId); rows = rows.filter((v) => ids.includes(Number(v.careUserId))); }
    if (f.careUserName) rows = rows.filter((v) => careUserName(v.careUserId).includes(f.careUserName));
    if (f.visitDate) rows = rows.filter((v) => fmtDate(v.visitDate, "-") === f.visitDate);
    if (f.helperName) rows = rows.filter((v) => staffName(v.helperStaffId).includes(f.helperName));
    rows.sort((a, b) => (parseDate(b.visitDate) - parseDate(a.visitDate)) || (parseDate(b.startTime) - parseDate(a.startTime)));
    return rows.map((v) => ({
      visitRecordId: v.visitRecordId, visitDate: v.visitDate, startTime: v.startTime, endTime: v.endTime,
      careUserName: careUserName(v.careUserId), staffName: staffName(v.helperStaffId), approvalStatus: v.approvalStatus,
    }));
  }
  // 訪問報告詳細（フル）。role 2 は担当チェック。null=権限なし/不在
  function visitReportDetail(visitRecordId, roleType, staffId) {
    const v = visitRecord(visitRecordId);
    if (!v) return null;
    if (roleType === 2 && !isAssigned(staffId, v.careUserId)) return null;
    if (roleType !== 1 && roleType !== 2) return null;
    return Object.assign({}, v, { careUserName: careUserName(v.careUserId), staffName: staffName(v.helperStaffId), planName: planName(v.planId), serviceContent: (plan(v.planId) || {}).serviceContent });
  }

  // ========== 全報告登録（ヘルパー） ==========
  function registerAllReport(draft, staffId) {
    const vr = draft.visitRecord || {};
    const fr = draft.familyReport || {};
    const hn = draft.handoverNote || {};
    const visits = read(K.visitRecords);
    const visitDate = vr.visitDate;
    const v = {
      visitRecordId: nextId(visits, "visitRecordId"),
      careUserId: Number(vr.careUserId), helperStaffId: Number(staffId), planId: Number(vr.planId),
      visitDate: visitDate,
      startTime: visitDate && vr.startTime ? visitDate + " " + vr.startTime + ":00" : null,
      endTime: visitDate && vr.endTime ? visitDate + " " + vr.endTime + ":00" : null,
      bodyTemperature: vr.bodyTemperature, bloodPressureHigh: vr.bloodPressureHigh, bloodPressureLow: vr.bloodPressureLow,
      pulse: vr.pulse, spo2: vr.spo2, mealAmount: vr.mealAmount, waterAmount: vr.waterAmount,
      stoolCount: vr.stoolCount || 0, stoolCondition: vr.stoolCondition, urineCount: vr.urineCount || 0, urineColor: vr.urineColor,
      sleepStatus: vr.sleepStatus, bathCare: !!vr.bathCare, clothesChangeCare: !!vr.clothesChangeCare, medicationCare: !!vr.medicationCare,
      cookingCare: !!vr.cookingCare, cleaningCare: !!vr.cleaningCare, laundryCare: !!vr.laundryCare, shoppingCare: !!vr.shoppingCare,
      otherCare: vr.otherCare, noticedPoint: vr.noticedPoint, skinCondition: vr.skinCondition, dementiaChange: vr.dementiaChange, accidentRisk: vr.accidentRisk,
      recordStatus: "registered", approvalStatus: 1, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr(),
    };
    visits.push(v); write(K.visitRecords, visits);

    const freps = read(K.familyReports);
    freps.push({
      familyReportId: nextId(freps, "familyReportId"), visitRecordId: v.visitRecordId,
      reportContent: fr.reportContent, familyComment: fr.familyComment || null, photoPath: fr.photoPath || null,
      photoConsent: !!fr.photoConsent, nextVisitDate: fr.nextVisitDate || null, specialNote: fr.specialNote || null,
      isPublished: false, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr(),
    });
    write(K.familyReports, freps);

    if (hn && (hn.nextStaffNote || hn.healthChange)) {
      const hns = read(K.handoverNotes);
      hns.push({
        handoverNoteId: nextId(hns, "handoverNoteId"), visitRecordId: v.visitRecordId, careUserId: v.careUserId, createdStaffId: Number(staffId),
        healthChange: hn.healthChange || null, dementiaSymptomChange: hn.dementiaSymptomChange || null, fallOrAccidentRisk: hn.fallOrAccidentRisk || null,
        familySituation: hn.familySituation || null, medicalChange: hn.medicalChange || null, medicationChange: hn.medicationChange || null,
        nextStaffNote: hn.nextStaffNote || "", importance: hn.importance || "normal", confirmStatus: "unconfirmed",
        deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr(),
      });
      write(K.handoverNotes, hns);
    }
    return v.visitRecordId;
  }

  // ========== 請求 ==========
  function userCharge(fee) { return fee == null ? 0 : Math.round(fee * 0.1); }
  function insuranceCharge(fee) { return fee == null ? 0 : Math.round(fee * 0.9); }
  // 承認済み(2)の訪問を期間で。fee/利用者負担/保険請求つき
  function billingList(startDate, endDate) {
    const s = parseDate(startDate), e = parseDate(endDate);
    return visitRecords().filter((v) => {
      if (v.approvalStatus !== 2) return false;
      const d = parseDate(v.visitDate);
      return d && d >= s && d <= e;
    }).sort((a, b) => (parseDate(a.visitDate) - parseDate(b.visitDate)) || (a.careUserId - b.careUserId))
      .map((v) => {
        const p = plan(v.planId) || {};
        return {
          visitRecordId: v.visitRecordId, visitDate: v.visitDate, startTime: v.startTime, endTime: v.endTime,
          careUserName: careUserName(v.careUserId), helperName: staffName(v.helperStaffId),
          planName: p.planName, serviceContent: p.serviceContent, feeAmount: p.feeAmount,
          userChargeAmount: userCharge(p.feeAmount), insuranceChargeAmount: insuranceCharge(p.feeAmount),
        };
      });
  }

  // ========== 家族報告 ==========
  function familyReportView(f) {
    const v = visitRecord(f.visitRecordId) || {};
    const p = plan(v.planId) || {};
    let rejectReason = null;
    const rej = approvals().filter((a) => Number(a.familyReportId) === Number(f.familyReportId) && a.approvalStatus === 3)
      .sort((a, b) => parseDate(b.approvedAt) - parseDate(a.approvedAt))[0];
    if (rej) rejectReason = rej.rejectReason;
    return Object.assign({}, f, {
      careUserId: v.careUserId, careUserName: careUserName(v.careUserId), helperStaffId: v.helperStaffId, staffName: staffName(v.helperStaffId),
      planId: v.planId, planName: p.planName, serviceContent: p.serviceContent,
      visitDate: v.visitDate, startTime: v.startTime, endTime: v.endTime, approvalStatus: v.approvalStatus,
      bathCare: v.bathCare, clothesChangeCare: v.clothesChangeCare, medicationCare: v.medicationCare, cookingCare: v.cookingCare,
      cleaningCare: v.cleaningCare, laundryCare: v.laundryCare, shoppingCare: v.shoppingCare, otherCare: v.otherCare,
      mealAmount: v.mealAmount, stoolCount: v.stoolCount, stoolCondition: v.stoolCondition, urineCount: v.urineCount, urineColor: v.urineColor,
      rejectReason: rejectReason,
    });
  }
  // 公開済み(isPublished + approvalStatus=2) 一覧。role別フィルタ
  function familyReportListByRole(careUserNameKw, roleType, staffId, careUserId) {
    let rows = familyReports().filter((f) => {
      const v = visitRecord(f.visitRecordId);
      if (!v) return false;
      if (!f.isPublished || v.approvalStatus !== 2) return false;
      if (careUserNameKw && !careUserName(v.careUserId).includes(careUserNameKw)) return false;
      if (roleType === 1) return true;
      if (roleType === 2) return isAssigned(staffId, v.careUserId);
      if (roleType === 3) return Number(v.careUserId) === Number(careUserId);
      return false;
    }).map(familyReportView);
    rows.sort((a, b) => (parseDate(b.visitDate) - parseDate(a.visitDate)) || (parseDate(b.startTime) - parseDate(a.startTime)));
    return rows;
  }
  function familyReportDetailByRole(familyReportId, roleType, staffId, careUserId) {
    const f = familyReport(familyReportId);
    if (!f) return null;
    const v = visitRecord(f.visitRecordId);
    if (!v) return null;
    if (roleType === 1) { /* ok */ }
    else if (roleType === 2) { if (!isAssigned(staffId, v.careUserId)) return null; }
    else if (roleType === 3) { if (Number(v.careUserId) !== Number(careUserId) || !f.isPublished) return null; }
    else return null;
    return familyReportView(f);
  }
  // 未承認報告一覧（approvalStatus=1）
  function unapprovalReportList(careUserNameKw, visitDate, serviceContentKw) {
    return visitRecords().filter((v) => v.approvalStatus === 1).filter((v) => {
      const fr = familyReportByVisit(v.visitRecordId); if (!fr) return false;
      if (careUserNameKw && !careUserName(v.careUserId).includes(careUserNameKw)) return false;
      if (visitDate && fmtDate(v.visitDate, "-") !== visitDate) return false;
      if (serviceContentKw) { const p = plan(v.planId); if (!p || !(p.serviceContent || "").includes(serviceContentKw)) return false; }
      return true;
    }).map((v) => familyReportView(familyReportByVisit(v.visitRecordId)))
      .sort((a, b) => (parseDate(b.visitDate) - parseDate(a.visitDate)) || (parseDate(b.startTime) - parseDate(a.startTime)));
  }
  function approveReport(familyReportId, approvedStaffId) {
    const f = familyReport(familyReportId); if (!f) return false;
    _setVisitApproval(f.visitRecordId, 2);
    _saveFamilyReport(Object.assign(f, { isPublished: true, updatedAt: nowStr() }));
    _addApproval(familyReportId, approvedStaffId, 2, null);
    return true;
  }
  function rejectReport(familyReportId, rejectReason, approvedStaffId) {
    const f = familyReport(familyReportId); if (!f) return false;
    _setVisitApproval(f.visitRecordId, 3);
    _saveFamilyReport(Object.assign(f, { isPublished: false, updatedAt: nowStr() }));
    _addApproval(familyReportId, approvedStaffId, 3, (rejectReason || "").trim());
    return true;
  }
  // 差戻し報告の再提出（ヘルパー）→ approvalStatus=1 に戻す
  function resubmitFamilyReport(familyReportId, form, staffId) {
    const f = familyReport(familyReportId); if (!f) return false;
    Object.assign(f, {
      reportContent: form.reportContent, familyComment: form.familyComment || null, specialNote: form.specialNote || null,
      nextVisitDate: form.nextVisitDate || f.nextVisitDate, photoConsent: form.photoConsent != null ? !!form.photoConsent : f.photoConsent,
      isPublished: false, updatedAt: nowStr(),
    });
    _saveFamilyReport(f);
    _setVisitApproval(f.visitRecordId, 1);
    _addApproval(familyReportId, staffId, 1, null);
    return true;
  }
  function _setVisitApproval(visitRecordId, status) {
    const all = read(K.visitRecords);
    const v = all.find((x) => Number(x.visitRecordId) === Number(visitRecordId));
    if (v) { v.approvalStatus = status; v.updatedAt = nowStr(); write(K.visitRecords, all); }
  }
  function _saveFamilyReport(f) {
    const all = read(K.familyReports);
    const i = all.findIndex((x) => Number(x.familyReportId) === Number(f.familyReportId));
    if (i >= 0) { all[i] = f; write(K.familyReports, all); }
  }
  function _addApproval(familyReportId, staffId, status, reason) {
    const all = read(K.approvals);
    all.push({ approvalId: nextId(all, "approvalId"), familyReportId: familyReportId, approvedStaffId: staffId, approvalStatus: status, rejectReason: reason, approvedAt: nowStr(), deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() });
    write(K.approvals, all);
  }

  // ========== 申し送り ==========
  function handoverView(h) {
    return Object.assign({}, h, { careUserName: careUserName(h.careUserId), staffName: staffName(h.createdStaffId) });
  }
  function handoverListByRole(careUserNameKw, importance, roleType, staffId) {
    return handoverNotes().filter((h) => {
      if (careUserNameKw && !careUserName(h.careUserId).includes(careUserNameKw)) return false;
      if (importance && h.importance !== importance) return false;
      if (roleType === 1) return true;
      if (roleType === 2) return isAssigned(staffId, h.careUserId);
      return false;
    }).map(handoverView).sort((a, b) => parseDate(b.createdAt) - parseDate(a.createdAt));
  }
  function handoverDetailByRole(handoverNoteId, roleType, staffId) {
    const h = handoverNote(handoverNoteId); if (!h) return null;
    if (roleType === 2 && !isAssigned(staffId, h.careUserId)) return null;
    if (roleType !== 1 && roleType !== 2) return null;
    // 詳細表示で確認済みに更新
    if (h.confirmStatus !== "confirmed") {
      const all = read(K.handoverNotes);
      const t = all.find((x) => Number(x.handoverNoteId) === Number(handoverNoteId));
      if (t) { t.confirmStatus = "confirmed"; write(K.handoverNotes, all); }
    }
    return handoverView(Object.assign({}, h, { confirmStatus: "confirmed" }));
  }

  // ========== 家族連絡 ==========
  function familyContactsForHelper(staffId) {
    return familyContacts().filter((c) => Number(c.receiverStaffId) === Number(staffId))
      .sort((a, b) => parseDate(b.sentAt) - parseDate(a.sentAt))
      .map((c) => ({ contactId: c.contactId, sentAt: c.sentAt, careUserName: careUserName(c.careUserId), importance: c.importance, contactContent: c.contactContent, confirmStatus: c.confirmStatus, contactCategory: c.contactCategory }));
  }
  function familyContactDetail(contactId, staffId) {
    const c = familyContact(contactId);
    if (!c || Number(c.receiverStaffId) !== Number(staffId)) return null;
    // 詳細表示で確認済みに更新
    if (c.confirmStatus !== true) {
      const all = read(K.familyContacts);
      const t = all.find((x) => Number(x.contactId) === Number(contactId));
      if (t) { t.confirmStatus = true; t.confirmedAt = nowStr(); write(K.familyContacts, all); }
    }
    return {
      contactId: c.contactId, sentAt: c.sentAt, careUserName: careUserName(c.careUserId),
      senderCareUserName: careUserName(c.senderCareUserId), receiverStaffName: staffName(c.receiverStaffId),
      contactCategory: c.contactCategory, importance: c.importance, confirmStatus: true,
      contactContent: c.contactContent, confirmedAt: c.confirmedAt || nowStr(),
    };
  }

  // ========== サービスプラン ==========
  // seed の servicePlan は isActive 列を持たない（DEFAULT TRUE）。未定義は有効として扱う。
  function searchActivePlans(planNameKw) {
    return plans().filter((p) => p.isActive !== false && (!planNameKw || (p.planName || "").includes(planNameKw))).sort((a, b) => a.planId - b.planId);
  }
  function searchStoppedPlans(planNameKw) {
    return plans().filter((p) => p.isActive === false && (!planNameKw || (p.planName || "").includes(planNameKw))).sort((a, b) => a.planId - b.planId);
  }
  function planRegister(form) {
    const all = read(K.servicePlans);
    all.push({ planId: nextId(all, "planId"), planCode: form.planCode || null, planName: form.planName, serviceContent: form.serviceContent, feeAmount: Number(form.feeAmount), isActive: true, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() });
    write(K.servicePlans, all);
  }
  function planUpdate(form) {
    const all = read(K.servicePlans);
    const p = all.find((x) => Number(x.planId) === Number(form.planId));
    if (p) { p.planName = form.planName; p.serviceContent = form.serviceContent; p.feeAmount = Number(form.feeAmount); p.updatedAt = nowStr(); write(K.servicePlans, all); }
  }
  function planSetActive(planId, active) { const all = read(K.servicePlans); const p = all.find((x) => Number(x.planId) === Number(planId)); if (p) { p.isActive = active; p.updatedAt = nowStr(); write(K.servicePlans, all); } }
  function planDelete(planId) { const all = read(K.servicePlans); const p = all.find((x) => Number(x.planId) === Number(planId)); if (p) { p.deleteFlag = true; p.updatedAt = nowStr(); write(K.servicePlans, all); } }
  function planVisitCount(planId) { return visitRecords().filter((v) => Number(v.planId) === Number(planId)).length; }

  // ========== 利用者 CRUD ==========
  function searchCareUsers(careUserNameKw, isActive) {
    return careUsers().filter((c) => (!careUserNameKw || c.careUserName.includes(careUserNameKw)) && (isActive == null || c.isActive === isActive)).sort((a, b) => a.careUserId - b.careUserId);
  }
  const GENDER_MAP = { 1: "男性", 2: "女性", 3: "その他" };
  function loginIdExists(loginId) { return accounts().some((a) => a.loginId === loginId); }
  function careUserRegister(form) {
    const accs = read(K.userAccounts);
    const acc = { accountId: nextId(accs, "accountId"), loginId: form.loginId, password: form.password, roleType: 3, isActive: true, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() };
    accs.push(acc); write(K.userAccounts, accs);
    const all = read(K.careUsers);
    all.push({ careUserId: nextId(all, "careUserId"), accountId: acc.accountId, careUserName: form.careUserName, birthDate: form.birthDate, age: form.age, gender: GENDER_MAP[Number(form.gender)] || form.gender, postalCode: form.postalCode, address: form.address, phoneNumber: form.phoneNumber, publicSetting: true, isActive: true, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() });
    write(K.careUsers, all);
  }
  function careUserUpdate(careUserObj, userObj) {
    const all = read(K.careUsers);
    const c = all.find((x) => Number(x.careUserId) === Number(careUserObj.careUserId));
    if (c) { Object.assign(c, careUserObj, { gender: GENDER_MAP[Number(careUserObj.gender)] || careUserObj.gender, updatedAt: nowStr() }); write(K.careUsers, all); }
    if (userObj && userObj.accountId) {
      const accs = read(K.userAccounts);
      const a = accs.find((x) => Number(x.accountId) === Number(userObj.accountId));
      if (a) { if (userObj.loginId) a.loginId = userObj.loginId; if (userObj.password) a.password = userObj.password; a.updatedAt = nowStr(); write(K.userAccounts, accs); }
    }
  }
  function careUserStop(careUserId) { const all = read(K.careUsers); const c = all.find((x) => Number(x.careUserId) === Number(careUserId)); if (c) { c.isActive = false; c.updatedAt = nowStr(); write(K.careUsers, all); } }
  function careUserDelete(careUserId) { const all = read(K.careUsers); const c = all.find((x) => Number(x.careUserId) === Number(careUserId)); if (c) { c.deleteFlag = true; c.isActive = false; c.updatedAt = nowStr(); write(K.careUsers, all); } }

  // ========== スタッフ CRUD ==========
  function searchStaff(staffNameKw, roleType, isActive) {
    return read(K.staff).filter((s) => !s.deleteFlag).filter((s) => {
      const a = account(s.accountId);
      if (!a || a.deleteFlag) return false;
      if (staffNameKw && !s.staffName.includes(staffNameKw)) return false;
      if (roleType != null && a.roleType !== roleType) return false;
      if (isActive != null && s.isActive !== isActive) return false;
      return true;
    }).sort((a, b) => a.staffId - b.staffId);
  }
  function staffRole(staffObj) { const a = account(staffObj.accountId); return a ? a.roleType : null; }
  function loginStaffName(accountId) { const s = staffByAccount(accountId); return s ? s.staffName : "ゲスト"; }
  function staffRegister(form) {
    const accs = read(K.userAccounts);
    const acc = { accountId: nextId(accs, "accountId"), loginId: form.loginId, password: form.password, roleType: Number(form.roleType), isActive: true, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() };
    accs.push(acc); write(K.userAccounts, accs);
    const all = read(K.staff);
    all.push({ staffId: nextId(all, "staffId"), accountId: acc.accountId, staffName: form.staffName, birthDate: form.birthDate, gender: GENDER_MAP[Number(form.gender)] || form.gender, postalCode: form.postalCode, address: form.address, phoneNumber: form.phoneNumber, email: form.email, isActive: true, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() });
    write(K.staff, all);
  }
  function staffUpdate(staffObj, userObj, assignedCareUserIdsCsv, mainHelperCareUserIdsCsv) {
    const all = read(K.staff);
    const s = all.find((x) => Number(x.staffId) === Number(staffObj.staffId));
    if (s) { Object.assign(s, staffObj, { gender: GENDER_MAP[Number(staffObj.gender)] || staffObj.gender, updatedAt: nowStr() }); write(K.staff, all); }
    if (userObj && userObj.accountId) {
      const accs = read(K.userAccounts); const a = accs.find((x) => Number(x.accountId) === Number(userObj.accountId));
      if (a) { if (userObj.loginId) a.loginId = userObj.loginId; if (userObj.password) a.password = userObj.password; a.updatedAt = nowStr(); write(K.userAccounts, accs); }
    }
    // 担当割り当て更新（ヘルパーのみ）
    if (assignedCareUserIdsCsv != null) {
      const wanted = String(assignedCareUserIdsCsv).split(",").map((x) => x.trim()).filter(Boolean).map(Number);
      const mains = String(mainHelperCareUserIdsCsv || "").split(",").map((x) => x.trim()).filter(Boolean).map(Number);
      const all2 = read(K.helperAssignments);
      // 既存をいったん論理削除
      all2.forEach((h) => { if (Number(h.helperStaffId) === Number(staffObj.staffId) && !h.deleteFlag && !wanted.includes(Number(h.careUserId))) { h.deleteFlag = true; h.updatedAt = nowStr(); } });
      wanted.forEach((cuId) => {
        let h = all2.find((x) => Number(x.helperStaffId) === Number(staffObj.staffId) && Number(x.careUserId) === cuId);
        if (h) { h.deleteFlag = false; h.endDate = null; h.isMainHelper = mains.includes(cuId); h.updatedAt = nowStr(); }
        else { all2.push({ assignmentId: nextId(all2, "assignmentId"), careUserId: cuId, helperStaffId: Number(staffObj.staffId), isMainHelper: mains.includes(cuId), visitHomeInfo: null, startDate: fmtDate(TODAY, "-"), endDate: null, deleteFlag: false, createdAt: nowStr(), updatedAt: nowStr() }); }
      });
      write(K.helperAssignments, all2);
    }
  }
  function staffDelete(staffId) {
    const all = read(K.staff); const s = all.find((x) => Number(x.staffId) === Number(staffId));
    if (s) { s.deleteFlag = true; s.isActive = false; s.updatedAt = nowStr(); write(K.staff, all); }
    const all2 = read(K.helperAssignments); all2.forEach((h) => { if (Number(h.helperStaffId) === Number(staffId) && !h.deleteFlag) { h.deleteFlag = true; h.updatedAt = nowStr(); } }); write(K.helperAssignments, all2);
  }

  // 下書き
  function setDraft(key, obj) { sessionStorage.setItem(NS + "draft:" + key, JSON.stringify(obj)); }
  function getDraft(key) { try { return JSON.parse(sessionStorage.getItem(NS + "draft:" + key) || "null"); } catch (e) { return null; } }
  function clearDraft(key) { sessionStorage.removeItem(NS + "draft:" + key); }

  window.TeamG = {
    init, resetData,
    esc, fmtDate, fmtDateTime, fmtTime, toDateInput, toTimeInput, toLocalInput, parseDate, nowStr, TODAY,
    ROLE_LABEL, approvalLabel, importanceLabel, confirmLabel, GENDER_MAP,
    session, login, logout, requireLogin, requireRole, homeUrl,
    accounts, account, accountByLogin, staffList, staff, staffByAccount, staffName,
    careUsers, careUser, careUserByAccount, careUserName, plans, plan, planName,
    assignments, isAssigned, assignedCareUserIds, assignedCareUsers, unassignedCareUsers, assignedHelpers, assignedHelperStaff,
    visitRecords, visitRecord, familyReports, familyReport, familyReportByVisit, familyReportView,
    handoverNotes, handoverNote, familyContacts, familyContact, approvals, billingSupports,
    // dashboards
    countUnapprovedReports, countUnconfirmedContactsForStaff, unapprovedReportListForDashboard, unconfirmedContactListForDashboard,
    unreadFamilyContactsForHelper, rejectedFamilyReportsForHelper, latestFamilyReportForCareUser, sendFamilyContact,
    // visit reports
    searchVisitReports, visitReportDetail, registerAllReport,
    // billing
    userCharge, insuranceCharge, billingList,
    // family reports
    familyReportListByRole, familyReportDetailByRole, unapprovalReportList, approveReport, rejectReport, resubmitFamilyReport,
    // handover
    handoverListByRole, handoverDetailByRole,
    // family contact
    familyContactsForHelper, familyContactDetail,
    // plans
    searchActivePlans, searchStoppedPlans, planRegister, planUpdate, planSetActive, planDelete, planVisitCount,
    // care users
    searchCareUsers, loginIdExists, careUserRegister, careUserUpdate, careUserStop, careUserDelete,
    // staff
    searchStaff, staffRole, loginStaffName, staffRegister, staffUpdate, staffDelete,
    // draft
    setDraft, getDraft, clearDraft,
  };
})();
