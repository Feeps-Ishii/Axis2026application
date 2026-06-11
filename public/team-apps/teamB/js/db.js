/* =====================================================================
 * teamB さくら野診療所 クリニック管理システム — 擬似データ層 (window.TeamB)
 * ---------------------------------------------------------------------
 * seed.json を localStorage("teamB:*") に投入し、参照/検索/結合/CRUD/
 * 擬似セッションを提供する。各画面HTMLは <script src="./js/db.js"> 後に
 * TeamB.init().then(...) で起動する。
 *
 * ■ デモ基準日: TeamB.today() === "2026-06-11"（seed生成と一致）
 *
 * ■ ログイン
 *   スタッフ: TeamB.staffLogin(loginId, password)  password は全員 "password"
 *             loginId は数値=staffId / 文字列=email。invalid_flag=true は不可。
 *   患者本人: TeamB.patientAuth({cardNumber|phoneNumber, patientName, birthday})
 *   セッション: staffSession()/setStaffSession()/requireStaff()/logout()
 *               patientSession()/setPatientSession()/requirePatient()/patientLogout()
 *
 * ■ 主要ビュー
 *   appointmentView(id) / todayAppointments() / pastAppointments() / searchAppointments(f)
 *   patientList(f) / patientDetail(id)
 *   questionnaireView(id) / questionnaireList(f)
 *   recordView(id) / staffList(f)
 *   waitInfo() => {humannum, estimatedTime}
 *
 * ■ CRUD（localStorage永続）
 *   createPatient / updatePatient
 *   createAppointment / cancelAppointment / updateAppointmentStatus
 *   createStaff / updateStaff / invalidateStaff
 *   createRecord / updateRecord / invalidateRecord
 *   createQuestionnaire / updateQuestionnaire / invalidateQuestionnaire
 *
 * ■ 低レベル: table(name) / saveTable(name,rows) / nextId(name,pk)
 * ■ 下書き(sessionStorage): setDraft(kind,obj)/getDraft(kind)/clearDraft(kind)
 * ■ ユーティリティ: esc / fmtDate / fmtDateTime / age / cardOf / labelStatusClass
 * ===================================================================== */
(function () {
  "use strict";

  const NS = "teamB:";
  const SEED_FLAG = NS + "__seeded_v1";
  const SESS_STAFF = NS + "session_staff";
  const SESS_PATIENT = NS + "session_patient";
  const TODAY = "2026-06-11";

  // 各コレクションのPK
  const PK = {
    patients: "patientId",
    patientCardNumberSeq: "id",
    departments: "departmentId",
    staffs: "staffId",
    appointments: "appointmentId",
    medicalQuestionnaires: "questionnaireId",
    symptoms: "symptomId",
    questionnaireSymptoms: "questionnaireSymptomId",
    medicalHistories: "medicalHistoryId",
    questionnaireMedicalHistories: "questionnaireMedicalHistoryId",
    questionnaireAllergies: "allergyId",
    questionnaireMedications: "medicationId",
    belongingItems: "itemId",
    questionnaireBelongings: "questionnaireBelongingId",
    medicalRecords: "recordId",
    operationLogs: "logId",
  };

  let SEED = null;

  // ---------- 初期化 ----------
  async function init() {
    if (!localStorage.getItem(SEED_FLAG)) {
      const res = await fetch("./data/seed.json");
      SEED = await res.json();
      for (const key of Object.keys(SEED)) {
        if (key.startsWith("__")) continue;
        localStorage.setItem(NS + key, JSON.stringify(SEED[key]));
      }
      localStorage.setItem(SEED_FLAG, "1");
    }
    return TeamB;
  }

  // ---------- 低レベル ----------
  function table(name) {
    const raw = localStorage.getItem(NS + name);
    return raw ? JSON.parse(raw) : [];
  }
  function saveTable(name, rows) {
    localStorage.setItem(NS + name, JSON.stringify(rows));
  }
  function nextId(name, pk) {
    const rows = table(name);
    const key = pk || PK[name];
    return rows.reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0) + 1;
  }

  // ---------- ユーティリティ ----------
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmtDate(v) {
    if (!v) return "";
    const s = String(v).slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[1]}年${Number(m[2])}月${Number(m[3])}日` : s;
  }
  function fmtDateSlash(v) {
    if (!v) return "";
    return String(v).slice(0, 10).replace(/-/g, "/");
  }
  function fmtDateTime(v) {
    if (!v) return "";
    return String(v).replace("T", " ").slice(0, 16);
  }
  function age(birthday) {
    if (!birthday) return "";
    const b = new Date(String(birthday).slice(0, 10));
    const t = new Date(TODAY);
    let a = t.getFullYear() - b.getFullYear();
    const md = t.getMonth() - b.getMonth() || t.getDate() - b.getDate();
    if (md < 0) a -= 1;
    return a;
  }
  // appointments.status → CSSクラス用キー
  function labelStatusClass(status) {
    return {
      "未受付": "unaccepted",
      "受付済": "received",
      "案内済": "guided",
      "不在": "absent",
      "キャンセル": "cancel",
    }[status] || "unaccepted";
  }

  // ---------- 参照 ----------
  const all = (n) => table(n);
  const find = (n, id) => table(n).find((r) => Number(r[PK[n]]) === Number(id)) || null;

  const patients = () => table("patients");
  const patient = (id) => find("patients", id);
  const departments = () => table("departments");
  const department = (id) => find("departments", id);
  const activeDepartments = () => departments().filter((d) => d.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder);
  const staffs = () => table("staffs");
  const staff = (id) => find("staffs", id);
  const activeStaffs = () => staffs().filter((s) => s.invalidFlag !== true);
  const appointments = () => table("appointments");
  const appointment = (id) => find("appointments", id);
  const medicalQuestionnaires = () => table("medicalQuestionnaires");
  const questionnaire = (id) => find("medicalQuestionnaires", id);
  const symptoms = () => table("symptoms");
  const activeSymptoms = () => symptoms().filter((s) => s.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder);
  const medicalHistories = () => table("medicalHistories");
  const activeHistories = () => medicalHistories().filter((h) => h.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder);
  const belongingItems = () => table("belongingItems");
  const activeBelongings = () => belongingItems().filter((b) => b.isActive !== false).sort((a, b) => a.displayOrder - b.displayOrder);
  const medicalRecords = () => table("medicalRecords");
  const record = (id) => find("medicalRecords", id);

  const departmentName = (id) => (department(id) || {}).departmentName || "";
  const patientName = (id) => { const p = patient(id); return p ? `${p.lastName} ${p.firstName}` : ""; };
  const cardOf = (id) => (patient(id) || {}).cardNumber || "";
  const staffName = (id) => (staff(id) || {}).name || "";

  // ---------- 結合ビュー ----------
  function appointmentView(id) {
    const a = appointment(id);
    if (!a) return null;
    const p = patient(a.patientId) || {};
    const q = medicalQuestionnaires().find((x) => Number(x.appointmentId) === Number(id) && x.invalidFlag !== true) || null;
    const r = medicalRecords().find((x) => Number(x.appointmentId) === Number(id) && x.invalidFlag !== true) || null;
    return {
      ...a,
      patient: p,
      patientName: `${p.lastName || ""} ${p.firstName || ""}`.trim(),
      cardNumber: p.cardNumber || "",
      departmentName: departmentName(a.departmentId),
      questionnaire: q,
      record: r,
    };
  }

  function todayAppointments() {
    return appointments()
      .filter((a) => String(a.appointmentDate).slice(0, 10) === TODAY)
      .map((a) => appointmentView(a.appointmentId))
      .sort((a, b) => (a.dailyQueueNumber || 0) - (b.dailyQueueNumber || 0));
  }

  // filters: {patientName, cardNo, departmentName, status, visitDate}
  function pastAppointments(f) {
    f = f || {};
    return appointments()
      .filter((a) => String(a.appointmentDate).slice(0, 10) !== TODAY)
      .map((a) => appointmentView(a.appointmentId))
      .filter((v) => matchAppt(v, f))
      .sort((a, b) => String(b.appointmentDate).localeCompare(String(a.appointmentDate)));
  }
  function searchAppointments(f) {
    f = f || {};
    return appointments()
      .map((a) => appointmentView(a.appointmentId))
      .filter((v) => matchAppt(v, f))
      .sort((a, b) => String(b.appointmentDate).localeCompare(String(a.appointmentDate)));
  }
  function matchAppt(v, f) {
    if (f.patientName && !`${v.patient.lastName}${v.patient.firstName}${v.patient.lastNameKana}${v.patient.firstNameKana}`.includes(f.patientName)) return false;
    if (f.cardNo && !String(v.cardNumber).includes(f.cardNo)) return false;
    if (f.departmentName && v.departmentName !== f.departmentName) return false;
    if (f.status && v.status !== f.status) return false;
    if (f.visitDate && String(v.appointmentDate).slice(0, 10) !== f.visitDate) return false;
    return true;
  }

  // ---------- 患者一覧/詳細 ----------
  // filters: {keyword(氏名/カナ/診察券), gender, includeInvalid}
  function patientList(f) {
    f = f || {};
    return patients()
      .filter((p) => f.includeInvalid ? true : p.invalidFlag !== true)
      .filter((p) => {
        if (f.keyword) {
          const k = f.keyword;
          const hay = `${p.lastName}${p.firstName}${p.lastNameKana}${p.firstNameKana}${p.cardNumber}${p.phoneNumber}`;
          if (!hay.includes(k)) return false;
        }
        if (f.gender && p.gender !== f.gender) return false;
        return true;
      })
      .map((p) => ({ ...p, age: age(p.birthday) }))
      .sort((a, b) => a.patientId - b.patientId);
  }
  function patientDetail(id) {
    const p = patient(id);
    if (!p) return null;
    const appts = appointments().filter((a) => Number(a.patientId) === Number(id)).map((a) => a.appointmentId);
    const recordList = medicalRecords()
      .filter((r) => appts.includes(r.appointmentId))
      .map((r) => ({ ...r, appointment: appointment(r.appointmentId) }))
      .sort((a, b) => String((b.appointment || {}).appointmentDate).localeCompare(String((a.appointment || {}).appointmentDate)));
    const questionnaireList = medicalQuestionnaires()
      .filter((q) => appts.includes(q.appointmentId))
      .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
    const bloodPressureList = recordList
      .filter((r) => r.systolicBp != null)
      .map((r) => ({ date: (r.appointment || {}).appointmentDate, systolic: r.systolicBp, diastolic: r.diastolicBp, pulse: r.pulse }));
    return { patient: { ...p, age: age(p.birthday) }, recordList, questionnaireList, bloodPressureList };
  }

  // ---------- 問診票ビュー/一覧 ----------
  function questionnaireView(id) {
    const q = questionnaire(id);
    if (!q) return null;
    const a = appointment(q.appointmentId) || {};
    const p = patient(a.patientId) || {};
    const symIds = questionnaireSymptomsOf(id);
    const symptomList = symIds.map((qs) => {
      const s = symptoms().find((x) => Number(x.symptomId) === Number(qs.symptomId)) || {};
      return { ...qs, symptomName: s.symptomName || "" };
    });
    const histories = table("questionnaireMedicalHistories")
      .filter((h) => Number(h.questionnaireId) === Number(id))
      .map((h) => {
        const mh = medicalHistories().find((x) => Number(x.medicalHistoryId) === Number(h.medicalHistoryId)) || {};
        return { ...h, historyName: mh.historyName || "" };
      });
    const allergy = table("questionnaireAllergies").find((x) => Number(x.questionnaireId) === Number(id)) || null;
    const medication = table("questionnaireMedications").find((x) => Number(x.questionnaireId) === Number(id)) || null;
    const belongings = table("questionnaireBelongings")
      .filter((x) => Number(x.questionnaireId) === Number(id))
      .map((b) => {
        const it = belongingItems().find((x) => Number(x.itemId) === Number(b.itemId)) || {};
        return { ...b, itemName: it.itemName || "" };
      });
    return {
      ...q,
      appointment: a,
      patient: p,
      patientName: `${p.lastName || ""} ${p.firstName || ""}`.trim(),
      cardNumber: p.cardNumber || "",
      departmentName: departmentName(a.departmentId),
      symptomList, histories, allergy, medication, belongings,
    };
  }
  const questionnaireSymptomsOf = (qid) =>
    table("questionnaireSymptoms").filter((x) => Number(x.questionnaireId) === Number(qid));

  // filters: {patientName, cardNumber, visitDate, status(有効/無効/すべて)}
  function questionnaireList(f) {
    f = f || {};
    return medicalQuestionnaires()
      .map((q) => questionnaireView(q.questionnaireId))
      .filter((v) => {
        if (f.patientName && !`${v.patient.lastName}${v.patient.firstName}${v.patient.lastNameKana}${v.patient.firstNameKana}`.includes(f.patientName)) return false;
        if (f.cardNumber && !String(v.cardNumber).includes(f.cardNumber)) return false;
        if (f.visitDate && String(v.visitDate).slice(0, 10) !== f.visitDate) return false;
        if (f.status === "有効" && v.invalidFlag === true) return false;
        if (f.status === "無効" && v.invalidFlag !== true) return false;
        return true;
      })
      .sort((a, b) => String(b.visitDate).localeCompare(String(a.visitDate)));
  }

  // ---------- カルテビュー ----------
  function recordView(id) {
    const r = record(id);
    if (!r) return null;
    const a = appointment(r.appointmentId) || {};
    const p = patient(a.patientId) || {};
    return {
      ...r,
      appointment: a,
      patient: p,
      patientName: `${p.lastName || ""} ${p.firstName || ""}`.trim(),
      cardNumber: p.cardNumber || "",
      departmentName: departmentName(a.departmentId),
      doctorName: staffName(r.doctorStaffId),
    };
  }

  // ---------- スタッフ一覧 ----------
  // filters: {staffName, jobType, authorityType, status(在籍/無効/すべて)}
  function staffList(f) {
    f = f || {};
    return staffs()
      .filter((s) => {
        if (f.staffName && !String(s.name).includes(f.staffName)) return false;
        if (f.jobType && s.jobType !== f.jobType) return false;
        if (f.authorityType && s.authorityType !== f.authorityType) return false;
        if (f.status === "在籍" && s.invalidFlag === true) return false;
        if (f.status === "無効" && s.invalidFlag !== true) return false;
        return true;
      })
      .sort((a, b) => a.staffId - b.staffId);
  }

  // ---------- 待ち時間 ----------
  function waitInfo() {
    const waiting = appointments().filter(
      (a) => String(a.appointmentDate).slice(0, 10) === TODAY && (a.status === "未受付" || a.status === "受付済")
    ).length;
    // デモ用の基準時刻 9:00 + 5分/人
    const base = 9 * 60;
    const total = base + waiting * 5;
    const hh = String(Math.floor(total / 60) % 24).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return { humannum: waiting, estimatedTime: `${hh}:${mm}` };
  }

  // ---------- セッション ----------
  function staffLogin(loginId, password) {
    if (password !== "password") return null;
    const id = String(loginId || "").trim();
    const list = activeStaffs();
    let s = null;
    if (/^\d+$/.test(id)) s = list.find((x) => Number(x.staffId) === Number(id));
    else s = list.find((x) => x.email === id);
    return s || null;
  }
  function setStaffSession(s) { localStorage.setItem(SESS_STAFF, JSON.stringify({ staffId: s.staffId, name: s.name, authorityType: s.authorityType, jobType: s.jobType })); }
  function staffSession() { const r = localStorage.getItem(SESS_STAFF); return r ? JSON.parse(r) : null; }
  function logout() { localStorage.removeItem(SESS_STAFF); location.href = "./login.html"; }
  function requireStaff() {
    const s = staffSession();
    if (!s) { location.href = "./login.html"; return null; }
    return s;
  }
  const isAdmin = () => { const s = staffSession(); return !!s && s.authorityType === "管理者"; };

  function normalizePhone(p) { return String(p || "").replace(/[-\s]/g, ""); }
  function patientAuth(form) {
    form = form || {};
    const name = String(form.patientName || "").replace(/\s|　/g, "");
    const bday = String(form.birthday || "").slice(0, 10);
    return patients().find((p) => {
      if (p.invalidFlag === true) return false;
      const pname = `${p.lastName}${p.firstName}`.replace(/\s|　/g, "");
      if (name && pname !== name) return false;
      if (bday && String(p.birthday).slice(0, 10) !== bday) return false;
      if (form.cardNumber && String(p.cardNumber) !== String(form.cardNumber).trim()) return false;
      if (form.phoneNumber && normalizePhone(p.phoneNumber) !== normalizePhone(form.phoneNumber)) return false;
      if (!form.cardNumber && !form.phoneNumber) return false;
      return true;
    }) || null;
  }
  function setPatientSession(p) { localStorage.setItem(SESS_PATIENT, JSON.stringify({ patientId: p.patientId, cardNumber: p.cardNumber, name: `${p.lastName} ${p.firstName}` })); }
  function patientSession() { const r = localStorage.getItem(SESS_PATIENT); return r ? JSON.parse(r) : null; }
  function patientLogout() { localStorage.removeItem(SESS_PATIENT); location.href = "./reservationTop.html"; }
  function requirePatient() {
    const s = patientSession();
    if (!s) { location.href = "./reservationAuth.html"; return null; }
    return s;
  }

  // ---------- 下書き(sessionStorage) ----------
  const draftKey = (k) => NS + "draft_" + k;
  function setDraft(kind, obj) { sessionStorage.setItem(draftKey(kind), JSON.stringify(obj)); }
  function getDraft(kind) { const r = sessionStorage.getItem(draftKey(kind)); return r ? JSON.parse(r) : null; }
  function clearDraft(kind) { sessionStorage.removeItem(draftKey(kind)); }

  // ---------- 診察券番号採番 ----------
  function nextCardNumber() {
    const seq = table("patientCardNumberSeq");
    const cur = seq[0] ? Number(seq[0].nextCardNumber) : 10000;
    return String(cur);
  }
  function bumpCardNumber() {
    const seq = table("patientCardNumberSeq");
    if (seq[0]) { seq[0].nextCardNumber = Number(seq[0].nextCardNumber) + 1; saveTable("patientCardNumberSeq", seq); }
  }

  // ---------- CRUD ----------
  function createPatient(data) {
    const rows = patients();
    const id = nextId("patients");
    const card = data.cardNumber || nextCardNumber();
    if (!data.cardNumber) bumpCardNumber();
    const row = { patientId: id, cardNumber: card, invalidFlag: false, createdAt: TODAY + " 00:00:00", updatedAt: TODAY + " 00:00:00", ...data, patientId: id, cardNumber: card };
    rows.push(row); saveTable("patients", rows);
    return row;
  }
  function updatePatient(id, data) {
    const rows = patients();
    const i = rows.findIndex((r) => Number(r.patientId) === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...data, patientId: Number(id), updatedAt: TODAY + " 00:00:00" };
    saveTable("patients", rows);
    return rows[i];
  }

  function createAppointment(data) {
    const rows = appointments();
    const id = nextId("appointments");
    const date = data.appointmentDate || TODAY;
    const sameDay = rows.filter((a) => String(a.appointmentDate).slice(0, 10) === String(date).slice(0, 10));
    const queue = sameDay.reduce((m, a) => Math.max(m, a.dailyQueueNumber || 0), 0) + 1;
    const row = {
      appointmentId: id, daily_queue_number: undefined, dailyQueueNumber: queue,
      status: "未受付", estimatedWaitTime: 0, memo: null,
      createdAt: TODAY + " 00:00:00", updatedAt: TODAY + " 00:00:00",
      ...data, appointmentId: id, dailyQueueNumber: queue,
    };
    delete row.daily_queue_number;
    rows.push(row); saveTable("appointments", rows);
    return row;
  }
  function cancelAppointment(id) { return updateAppointmentStatus(id, "キャンセル"); }
  function updateAppointmentStatus(id, status) {
    const rows = appointments();
    const i = rows.findIndex((r) => Number(r.appointmentId) === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], status, updatedAt: TODAY + " 00:00:00" };
    saveTable("appointments", rows);
    return rows[i];
  }

  function createStaff(data) {
    const rows = staffs();
    const id = nextId("staffs");
    const row = { staffId: id, invalidFlag: false, createdAt: TODAY + " 00:00:00", updatedAt: TODAY + " 00:00:00", ...data, staffId: id };
    rows.push(row); saveTable("staffs", rows);
    return row;
  }
  function updateStaff(id, data) {
    const rows = staffs();
    const i = rows.findIndex((r) => Number(r.staffId) === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...data, staffId: Number(id), updatedAt: TODAY + " 00:00:00" };
    saveTable("staffs", rows);
    return rows[i];
  }
  function invalidateStaff(id, reason) {
    return updateStaff(id, { invalidFlag: true, memo: reason || (staff(id) || {}).memo });
  }

  function createRecord(data) {
    const rows = medicalRecords();
    const id = nextId("medicalRecords");
    const row = { recordId: id, invalidFlag: false, createdAt: TODAY + " 00:00:00", updatedAt: TODAY + " 00:00:00", ...data, recordId: id };
    rows.push(row); saveTable("medicalRecords", rows);
    return row;
  }
  function updateRecord(id, data) {
    const rows = medicalRecords();
    const i = rows.findIndex((r) => Number(r.recordId) === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...data, recordId: Number(id), updatedAt: TODAY + " 00:00:00" };
    saveTable("medicalRecords", rows);
    return rows[i];
  }
  function invalidateRecord(id) { return updateRecord(id, { invalidFlag: true }); }

  function createQuestionnaire(data, symptomIds) {
    const rows = medicalQuestionnaires();
    const id = nextId("medicalQuestionnaires");
    const row = { questionnaireId: id, invalidFlag: false, status: data.status || "入力済", createdAt: TODAY + " 00:00:00", updatedAt: TODAY + " 00:00:00", ...data, questionnaireId: id };
    rows.push(row); saveTable("medicalQuestionnaires", rows);
    if (Array.isArray(symptomIds)) setQuestionnaireSymptoms(id, symptomIds);
    return row;
  }
  function updateQuestionnaire(id, data, symptomIds) {
    const rows = medicalQuestionnaires();
    const i = rows.findIndex((r) => Number(r.questionnaireId) === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], ...data, questionnaireId: Number(id), updatedAt: TODAY + " 00:00:00" };
    saveTable("medicalQuestionnaires", rows);
    if (Array.isArray(symptomIds)) setQuestionnaireSymptoms(id, symptomIds);
    return rows[i];
  }
  function invalidateQuestionnaire(id) {
    const rows = medicalQuestionnaires();
    const i = rows.findIndex((r) => Number(r.questionnaireId) === Number(id));
    if (i < 0) return null;
    rows[i] = { ...rows[i], invalidFlag: true, updatedAt: TODAY + " 00:00:00" };
    saveTable("medicalQuestionnaires", rows);
    return rows[i];
  }
  function setQuestionnaireSymptoms(qid, symptomIds) {
    let rows = table("questionnaireSymptoms").filter((x) => Number(x.questionnaireId) !== Number(qid));
    let id = rows.reduce((m, r) => Math.max(m, r.questionnaireSymptomId || 0), 0) + 1;
    symptomIds.forEach((sid) => {
      rows.push({ questionnaireSymptomId: id++, questionnaireId: Number(qid), symptomId: Number(sid), memo: null, createdAt: TODAY + " 00:00:00" });
    });
    saveTable("questionnaireSymptoms", rows);
  }

  // 変更項目差分（確認画面のハイライト用）
  function getChangedItems(oldObj, newObj, fields) {
    const changed = {};
    fields.forEach((f) => { if (String(oldObj[f] ?? "") !== String(newObj[f] ?? "")) changed[f] = true; });
    return changed;
  }

  // ---------- リセット ----------
  function reset() {
    Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k));
  }

  const TeamB = {
    init, today: () => TODAY,
    // 低レベル
    table, saveTable, nextId, reset,
    // 参照
    all, patients, patient, departments, department, activeDepartments,
    staffs, staff, activeStaffs, appointments, appointment,
    medicalQuestionnaires, questionnaire, symptoms, activeSymptoms,
    medicalHistories, activeHistories, belongingItems, activeBelongings,
    medicalRecords, record,
    departmentName, patientName, cardOf, staffName,
    // ビュー
    appointmentView, todayAppointments, pastAppointments, searchAppointments,
    patientList, patientDetail, questionnaireView, questionnaireSymptomsOf,
    questionnaireList, recordView, staffList, waitInfo,
    // セッション
    staffLogin, setStaffSession, staffSession, logout, requireStaff, isAdmin,
    patientAuth, setPatientSession, patientSession, patientLogout, requirePatient,
    // 下書き
    setDraft, getDraft, clearDraft,
    // CRUD
    createPatient, updatePatient,
    createAppointment, cancelAppointment, updateAppointmentStatus,
    createStaff, updateStaff, invalidateStaff,
    createRecord, updateRecord, invalidateRecord,
    createQuestionnaire, updateQuestionnaire, invalidateQuestionnaire, setQuestionnaireSymptoms,
    getChangedItems,
    nextCardNumber,
    // ユーティリティ
    esc, fmtDate, fmtDateSlash, fmtDateTime, age, labelStatusClass, normalizePhone,
  };
  window.TeamB = TeamB;
})();
