/*
 * TeamH —「進捗マルわかりシステム」(マルセイ精密工業) 擬似データ層。
 * Spring Boot + JPA/MySQL を localStorage で再現。db.js は seed.json を初回投入し、
 * 参照 / 検索 / 更新 / 擬似セッション を提供する。名前空間プレフィックス "teamH:"。
 * ステータス・ラベル・並び順・グルーピングは元 Service 実装に厳密準拠。
 */
(function () {
  const NS = "teamH:";
  const SEED_FLAG = NS + "seeded:v1";
  const KEYS = {
    users: NS + "users",
    machines: NS + "machines",
    workOrders: NS + "workOrders",
    workOrderProcesses: NS + "workOrderProcesses",
    progressReports: NS + "progressReports",
    progressReportProcesses: NS + "progressReportProcesses",
    handoverNotes: NS + "handoverNotes",
    skillContents: NS + "skillContents",
    skillContentsFiles: NS + "skillContentsFiles",
  };
  const SESSION_KEY = NS + "session";

  // デモ基準日（seed の created_at と一致）。残日数や遅延判定はこの「今」を基準にする。
  const TODAY = new Date("2026-06-09T09:00:00");

  // ---- 低レベル localStorage ----
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key) || "[]"); }
    catch (e) { return []; }
  }
  function write(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  async function init() {
    if (localStorage.getItem(SEED_FLAG)) return;
    const res = await fetch("./data/seed.json");
    const seed = await res.json();
    write(KEYS.users, seed.users || []);
    write(KEYS.machines, seed.machines || []);
    write(KEYS.workOrders, seed.workOrders || []);
    write(KEYS.workOrderProcesses, seed.workOrderProcesses || []);
    write(KEYS.progressReports, seed.progressReports || []);
    write(KEYS.progressReportProcesses, seed.progressReportProcesses || []);
    write(KEYS.handoverNotes, seed.handoverNotes || []);
    write(KEYS.skillContents, seed.skillContents || []);
    write(KEYS.skillContentsFiles, seed.skillContentsFiles || []);
    localStorage.setItem(SEED_FLAG, "1");
  }

  function resetData() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem(SEED_FLAG);
    localStorage.removeItem(SESSION_KEY);
  }

  // ---- ID 採番 ----
  function nextId(rows, field) {
    return rows.reduce((max, r) => Math.max(max, Number(r[field]) || 0), 0) + 1;
  }

  // ---- 表示ヘルパ ----
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function parseDate(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    // "2026-06-20 08:00:00" / "2026-06-20T08:00" / "2026-06-30"
    let s = String(v).trim().replace(" ", "T");
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const pad = (n) => String(n).padStart(2, "0");
  function fmtDate(v) {
    const d = parseDate(v); if (!d) return "";
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }
  function fmtDateTime(v) {
    const d = parseDate(v); if (!d) return "";
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function fmtTimeHM(v) {
    const d = parseDate(v); if (!d) return "";
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  // <input type="datetime-local"> 用 yyyy-MM-ddTHH:mm
  function toLocalInput(v) {
    const d = parseDate(v); if (!d) return "";
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ---- ラベル（元 Service の switch に厳密準拠）----
  // 工程ステータス（TodoService / ProgressService / WorkInstructionService 系）
  function statusLabel(status) {
    switch (status) {
      case "completed": return "完了";
      case "processing": return "加工中";
      case "inspecting": return "検査中";
      case "preparing": return "段取り中";
      case "not_started":
      default: return "未着手";
    }
  }
  // AdminDashboardService.convertStatusLabel（独自・preparing/inspecting は素通り）
  function dashboardStatusLabel(status, delayWarning) {
    if (delayWarning) return "遅延注意";
    if (status === "not_started") return "未着手";
    if (status === "setup") return "段取中";
    if (status === "processing") return "加工中";
    if (status === "inspection") return "検査中";
    if (status === "in_progress") return "作業中";
    if (status === "completed") return "完了";
    return status;
  }
  const ROLE_LABEL = { admin: "管理者", craftsman: "職人", sales: "営業" };

  // ---- マスタ参照 ----
  const users = () => read(KEYS.users);
  const user = (id) => users().find((u) => Number(u.userId) === Number(id)) || null;
  const userByLogin = (loginId) => users().find((u) => u.loginId === loginId) || null;
  const userName = (id) => (user(id) ? user(id).name : "");
  const craftsmen = () => users().filter((u) => u.role === "craftsman");
  const machines = () => read(KEYS.machines);
  const machine = (id) => machines().find((m) => Number(m.machineId) === Number(id)) || null;
  const machineByNo = (no) => machines().find((m) => m.machineNo === no) || null;
  const machineNo = (id) => (machine(id) ? machine(id).machineNo : null);

  const workOrders = () => read(KEYS.workOrders);
  const workOrder = (id) => workOrders().find((w) => Number(w.workOrderId) === Number(id)) || null;
  const workOrderProcesses = () => read(KEYS.workOrderProcesses);
  const workOrderProcess = (id) => workOrderProcesses().find((p) => Number(p.workOrderProcessId) === Number(id)) || null;
  const processesByWorkOrder = (woId) =>
    workOrderProcesses()
      .filter((p) => Number(p.workOrderId) === Number(woId))
      .sort((a, b) => a.processOrder - b.processOrder);
  const progressReports = () => read(KEYS.progressReports);
  const progressReport = (id) => progressReports().find((r) => Number(r.progressReportId) === Number(id)) || null;
  const progressReportByWorkOrder = (woId) =>
    progressReports().find((r) => Number(r.workOrderId) === Number(woId)) || null;
  const progressReportProcesses = () => read(KEYS.progressReportProcesses);
  const prpById = (id) => progressReportProcesses().find((p) => Number(p.progressReportProcessId) === Number(id)) || null;
  const prpByWorkOrderProcess = (wopId) =>
    progressReportProcesses().find((p) => Number(p.workOrderProcessId) === Number(wopId)) || null;
  const prpByReport = (reportId) =>
    progressReportProcesses()
      .filter((p) => Number(p.progressReportId) === Number(reportId))
      .sort((a, b) => {
        const oa = (workOrderProcess(a.workOrderProcessId) || {}).processOrder || 0;
        const ob = (workOrderProcess(b.workOrderProcessId) || {}).processOrder || 0;
        return oa - ob;
      });
  const handoverNotes = () => read(KEYS.handoverNotes);

  // ---- 結合 view（テンプレが参照するネスト構造を組み立てる）----
  // progress_report_process を workOrder/workOrderProcess/assignedUser/machine 付きで返す
  function prpView(p) {
    if (!p) return null;
    const wop = workOrderProcess(p.workOrderProcessId);
    const wo = workOrder(p.workOrderId);
    const au = user(p.assignedUserId);
    return Object.assign({}, p, {
      workOrder: wo,
      workOrderProcess: wop ? Object.assign({}, wop, { machine: machine(wop.machineId) }) : null,
      assignedUser: au,
      progressReport: progressReport(p.progressReportId),
    });
  }

  // ========== セッション ==========
  function session() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); }
    catch (e) { return null; }
  }
  function authenticate(loginId, password) {
    const u = userByLogin(loginId);
    if (!u) return null;
    // seed ユーザーは共通パスワード "password"。登録ユーザーは平文 password を保持。
    const ok = u.password != null ? u.password === password : password === "password";
    if (!ok) return null;
    if (u.isActive === 0) return null;
    return u;
  }
  function login(loginId, password) {
    const u = authenticate(loginId, password);
    if (!u) return null;
    localStorage.setItem(SESSION_KEY, JSON.stringify({ loginUser: u, role: u.role }));
    return u;
  }
  function logout() { localStorage.removeItem(SESSION_KEY); }
  function requireLogin() {
    const s = session();
    if (!s || !s.loginUser) { location.href = "./login.html"; return null; }
    return s;
  }
  function homeUrl(role) {
    if (role === "admin") return "./admin_dashboard.html";
    if (role === "craftsman") return "./todo.html";
    if (role === "sales") return "./progress_list.html";
    return "./login.html";
  }

  // ========== 管理者ダッシュボード ==========
  function isDelayWarning(expectedEndTime, progressStatus) {
    const d = parseDate(expectedEndTime);
    if (!d) return false;
    if (progressStatus === "completed") return false;
    const now = TODAY.getTime();
    const t = d.getTime();
    return t >= now && t <= now + 10 * 60 * 1000;
  }
  function dashboardItems() {
    const rows = progressReportProcesses().slice().sort((a, b) => {
      const da = parseDate(a.expectedEndTime), db = parseDate(b.expectedEndTime);
      if (!da && !db) return 0; if (!da) return 1; if (!db) return -1;
      return da - db;
    });
    return rows.map((p) => {
      const wop = workOrderProcess(p.workOrderProcessId);
      const wo = workOrder(p.workOrderId);
      const delay = isDelayWarning(p.expectedEndTime, p.progressStatus);
      return {
        progressReportProcessId: p.progressReportProcessId,
        workOrderProcessId: p.workOrderProcessId,
        orderNo: wo ? wo.orderNo : "",
        partName: wo ? wo.partName : "",
        processName: wop ? wop.processName : "",
        machineNo: wop ? machineNo(wop.machineId) : "",
        assignedUserName: userName(p.assignedUserId),
        statusLabel: dashboardStatusLabel(p.progressStatus, delay),
        delayWarning: delay,
        detailUrl: "./progress_update.html?admin=1&workOrderProcessId=" + p.workOrderProcessId,
      };
    });
  }
  function dashboardGroups(items) {
    const map = new Map();
    items.forEach((it) => {
      const key = it.orderNo + "___" + it.partName;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    });
    const groups = [];
    map.forEach((groupItems) => {
      const first = groupItems[0];
      const label = dashboardGroupStatus(groupItems);
      groups.push({
        orderNo: first.orderNo,
        partName: first.partName,
        statusLabel: label,
        statusClass: dashboardGroupClass(label),
        processCount: groupItems.length,
        items: groupItems,
      });
    });
    return groups;
  }
  function dashboardGroupStatus(items) {
    if (items.some((i) => i.delayWarning)) return "遅延注意";
    if (items.every((i) => i.statusLabel === "完了")) return "完了";
    if (items.some((i) => ["作業中", "加工中", "段取中", "検査中"].includes(i.statusLabel))) return "進行中";
    return "未着手";
  }
  function dashboardGroupClass(label) {
    if (label === "遅延注意") return "status-delay";
    if (label === "完了") return "status-completed";
    if (label === "進行中") return "status-working";
    return "status-default";
  }
  function countWorkingItems(items) {
    return items.filter((i) => i.statusLabel === "作業中" || i.statusLabel === "加工中").length;
  }
  function countCompletedItems(items) {
    return items.filter((i) => i.statusLabel === "完了").length;
  }
  function countWorkingMachines() {
    const set = new Set();
    progressReportProcesses().forEach((p) => {
      if (p.machineNoActual && ["preparing", "processing", "inspecting"].includes(p.progressStatus)) {
        set.add(p.machineNoActual);
      }
    });
    return set.size;
  }
  function totalMachineCount() { return machines().length; }
  function machineOperationRate() {
    const total = totalMachineCount();
    if (total === 0) return 0;
    return Math.round((countWorkingMachines() / total) * 100);
  }
  // 工程フロー（選択受注 or 納期最短の未完了受注）
  function flowTargetOrders() {
    return workOrders()
      .filter((w) => w.status !== "cancelled")
      .sort((a, b) => {
        const d = (parseDate(a.dueDate) || 0) - (parseDate(b.dueDate) || 0);
        return d !== 0 ? d : String(a.orderNo).localeCompare(b.orderNo);
      });
  }
  function priorityFlow(selectedWorkOrderId) {
    let wo;
    if (selectedWorkOrderId != null && selectedWorkOrderId !== "") {
      wo = workOrder(selectedWorkOrderId);
    } else {
      wo = workOrders()
        .filter((w) => w.status !== "completed")
        .sort((a, b) => (parseDate(a.dueDate) || 0) - (parseDate(b.dueDate) || 0))[0];
    }
    if (!wo) return [];
    const procs = processesByWorkOrder(wo.workOrderId);
    let activeFound = false;
    return procs.map((p) => {
      let flowStatus;
      if (p.currentStatus === "completed") flowStatus = "completed";
      else if (!activeFound) { flowStatus = "active"; activeFound = true; }
      else flowStatus = "waiting";
      return { processName: p.processName, flowStatus };
    });
  }

  // ========== 職人 TODO ==========
  function remainingDays(dueDate) {
    const d = parseDate(dueDate); if (!d) return null;
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const b = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
    return Math.round((a - b) / 86400000);
  }
  function todoRow(p) {
    const wo = workOrder(p.workOrderId);
    const prp = prpByWorkOrderProcess(p.workOrderProcessId);
    return {
      workOrderProcessId: p.workOrderProcessId,
      orderNo: wo ? wo.orderNo : "",
      partName: wo ? wo.partName : "",
      processOrder: p.processOrder,
      processName: p.processName,
      machineNo: machineNo(p.machineId),
      status: p.currentStatus,
      statusLabel: statusLabel(p.currentStatus),
      remainingDays: wo ? remainingDays(wo.dueDate) : null,
      handoverMessage: prp && prp.comment ? prp.comment : "申し送りはありません",
    };
  }
  function todoList(loginUserId, partName, machineNoVal, status, showCompleted) {
    let rows = workOrderProcesses().filter((p) => Number(p.assignedUserId) === Number(loginUserId));
    if (partName) rows = rows.filter((p) => { const wo = workOrder(p.workOrderId); return wo && wo.partName === partName; });
    if (machineNoVal) rows = rows.filter((p) => machineNo(p.machineId) === machineNoVal);
    if (status) rows = rows.filter((p) => p.currentStatus === status);
    if (!showCompleted) rows = rows.filter((p) => p.currentStatus !== "completed");
    rows.sort((a, b) => {
      const wa = workOrder(a.workOrderId), wb = workOrder(b.workOrderId);
      const d = (parseDate(wa && wa.dueDate) || 0) - (parseDate(wb && wb.dueDate) || 0);
      if (d !== 0) return d;
      const o = String(wa && wa.orderNo).localeCompare(String(wb && wb.orderNo));
      if (o !== 0) return o;
      return a.processOrder - b.processOrder;
    });
    return rows.map(todoRow);
  }
  function priorityWork(loginUserId) {
    const rows = workOrderProcesses()
      .filter((p) => Number(p.assignedUserId) === Number(loginUserId) && p.currentStatus !== "completed")
      .sort((a, b) => {
        const wa = workOrder(a.workOrderId), wb = workOrder(b.workOrderId);
        const d = (parseDate(wa && wa.dueDate) || 0) - (parseDate(wb && wb.dueDate) || 0);
        if (d !== 0) return d;
        if (a.processOrder !== b.processOrder) return a.processOrder - b.processOrder;
        return a.workOrderProcessId - b.workOrderProcessId;
      });
    return rows.length ? todoRow(rows[0]) : null;
  }
  function todoPartNameList(uid) {
    const set = [];
    workOrderProcesses().filter((p) => Number(p.assignedUserId) === Number(uid)).forEach((p) => {
      const wo = workOrder(p.workOrderId);
      if (wo && !set.includes(wo.partName)) set.push(wo.partName);
    });
    return set.sort();
  }
  function todoMachineNoList(uid) {
    const set = [];
    workOrderProcesses().filter((p) => Number(p.assignedUserId) === Number(uid)).forEach((p) => {
      const no = machineNo(p.machineId);
      if (no && !set.includes(no)) set.push(no);
    });
    return set.sort();
  }

  // ========== 進捗一覧 ==========
  function searchProgress(keyword, status, loginUserId) {
    let rows = progressReportProcesses().map(prpView);
    if (loginUserId != null) rows = rows.filter((p) => p.assignedUser && Number(p.assignedUser.userId) === Number(loginUserId));
    if (status) rows = rows.filter((p) => p.progressStatus === status);
    if (keyword) {
      const k = keyword;
      rows = rows.filter((p) =>
        (p.machineNoActual && p.machineNoActual.includes(k)) ||
        (p.workOrder && p.workOrder.orderNo.includes(k)) ||
        (p.workOrder && p.workOrder.partName.includes(k)) ||
        (p.assignedUser && p.assignedUser.name.includes(k)));
    }
    rows.sort((a, b) => {
      const o = String(a.workOrder && a.workOrder.orderNo).localeCompare(String(b.workOrder && b.workOrder.orderNo));
      if (o !== 0) return o;
      return (a.workOrderProcess ? a.workOrderProcess.processOrder : 0) - (b.workOrderProcess ? b.workOrderProcess.processOrder : 0);
    });
    return rows;
  }
  function progressGroups(processes) {
    const map = new Map();
    processes.forEach((p) => {
      const key = (p.workOrder ? p.workOrder.orderNo : "") + "___" + (p.workOrder ? p.workOrder.partName : "");
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    const groups = [];
    map.forEach((arr) => {
      const first = arr[0];
      const label = progressGroupStatus(arr);
      groups.push({
        orderNo: first.workOrder ? first.workOrder.orderNo : "",
        partName: first.workOrder ? first.workOrder.partName : "",
        statusLabel: label,
        statusClass: progressGroupClass(label),
        processCount: arr.length,
        processes: arr,
      });
    });
    return groups;
  }
  function progressGroupStatus(arr) {
    if (arr.every((p) => p.progressStatus === "completed")) return "完了";
    if (arr.some((p) => ["preparing", "processing", "inspecting"].includes(p.progressStatus))) return "進行中";
    return "未着手";
  }
  function progressGroupClass(label) {
    if (label === "完了") return "status-completed";
    if (label === "進行中") return "status-working";
    return "status-default";
  }

  // ========== 進捗詳細 ==========
  function progressDetail(reportId) {
    const report = progressReport(reportId);
    if (!report) return null;
    const reportView = Object.assign({}, report, { workOrder: workOrder(report.workOrderId) });
    const processes = prpByReport(reportId).map(prpView);
    const prpIds = processes.map((p) => Number(p.progressReportProcessId));
    const notes = handoverNotes()
      .filter((n) => prpIds.includes(Number(n.progressReportProcessId)))
      .sort((a, b) => (parseDate(b.createdAt) || 0) - (parseDate(a.createdAt) || 0))
      .map((n) => Object.assign({}, n, { createdBy: user(n.createdBy) }));
    return { report: reportView, processes, notes };
  }

  // ========== 進捗更新（職人/管理者） ==========
  function progressPage(workOrderProcessId, isAdmin) {
    let wopId = workOrderProcessId;
    if (wopId == null) {
      const first = workOrderProcesses().slice().sort((a, b) => {
        if (a.workOrderId !== b.workOrderId) return a.workOrderId - b.workOrderId;
        return a.processOrder - b.processOrder;
      })[0];
      if (!first) return null;
      wopId = first.workOrderProcessId;
    }
    const wop = workOrderProcess(wopId);
    if (!wop) return null;
    const wo = workOrder(wop.workOrderId);
    const prp = prpByWorkOrderProcess(wopId);
    const selectedItem = {
      workOrderProcessId: wop.workOrderProcessId,
      workOrderId: wop.workOrderId,
      orderNo: wo ? wo.orderNo : "",
      partName: wo ? wo.partName : "",
      processOrder: wop.processOrder,
      processName: wop.processName,
      machineNo: machineNo(wop.machineId),
      assignedUserId: wop.assignedUserId,
      currentStatus: wop.currentStatus,
      currentStatusLabel: statusLabel(wop.currentStatus),
      actualStart: prp ? prp.actualStart : null,
      expectedEndTime: prp ? prp.expectedEndTime : null,
      actualEnd: prp ? prp.actualEnd : null,
      handoverScheduledAt: prp ? prp.handoverScheduledAt : null,
      comment: prp ? prp.comment : null,
    };
    const procs = processesByWorkOrder(wop.workOrderId);
    let updateTargetFound = false;
    const processList = procs.map((p) => {
      let updatable;
      if (isAdmin) {
        updatable = p.currentStatus !== "completed";
      } else if (p.currentStatus === "completed") {
        updatable = false;
      } else if (!updateTargetFound) {
        updatable = true; updateTargetFound = true;
      } else {
        updatable = false;
      }
      return {
        workOrderProcessId: p.workOrderProcessId,
        processOrder: p.processOrder,
        processName: p.processName,
        machineNo: machineNo(p.machineId),
        status: p.currentStatus,
        statusLabel: statusLabel(p.currentStatus),
        assignedUserId: p.assignedUserId,
        assignedUserName: userName(p.assignedUserId),
        updatable: updatable,
      };
    });
    return { selectedItem, processList };
  }

  function _saveWop(wop) {
    const all = workOrderProcesses();
    const i = all.findIndex((p) => Number(p.workOrderProcessId) === Number(wop.workOrderProcessId));
    if (i >= 0) { all[i] = wop; write(KEYS.workOrderProcesses, all); }
  }
  function _savePrp(prp) {
    const all = progressReportProcesses();
    const i = all.findIndex((p) => Number(p.progressReportProcessId) === Number(prp.progressReportProcessId));
    if (i >= 0) { all[i] = prp; write(KEYS.progressReportProcesses, all); }
  }
  function _saveWorkOrder(wo) {
    const all = workOrders();
    const i = all.findIndex((w) => Number(w.workOrderId) === Number(wo.workOrderId));
    if (i >= 0) { all[i] = wo; write(KEYS.workOrders, all); }
  }
  function nowStr() {
    return `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(TODAY.getDate())} ${pad(TODAY.getHours())}:${pad(TODAY.getMinutes())}:00`;
  }
  function blank(v) { return v == null || v === "" ? null : v; }

  function updateProgress(wopId, progressStatus, actualStart, expectedEndTime, actualEnd, handoverScheduledAt, comment) {
    const wop = workOrderProcess(wopId);
    if (wop) { wop.currentStatus = progressStatus; wop.updatedAt = nowStr(); _saveWop(wop); }
    const prp = prpByWorkOrderProcess(wopId);
    if (prp) {
      prp.progressStatus = progressStatus;
      prp.actualStart = blank(actualStart);
      prp.expectedEndTime = blank(expectedEndTime);
      prp.actualEnd = blank(actualEnd);
      prp.handoverScheduledAt = blank(handoverScheduledAt);
      prp.comment = blank(comment);
      prp.updatedAt = nowStr();
      _savePrp(prp);
    }
  }
  function decideWorkingStatus(processName) {
    if (!processName) return "processing";
    if (processName.includes("段取り")) return "preparing";
    if (processName.includes("検査")) return "inspecting";
    return "processing";
  }
  function recomputeWorkOrderStatus(woId) {
    const procs = processesByWorkOrder(woId);
    const wo = workOrder(woId);
    if (!wo || wo.status === "cancelled") return;
    const remaining = procs.filter((p) => p.currentStatus !== "completed").length;
    wo.status = remaining === 0 ? "completed" : "active";
    wo.updatedAt = nowStr();
    _saveWorkOrder(wo);
    const r = progressReportByWorkOrder(woId);
    if (r) {
      r.status = wo.status; r.updatedAt = nowStr();
      const all = progressReports();
      const i = all.findIndex((x) => Number(x.progressReportId) === Number(r.progressReportId));
      if (i >= 0) { all[i] = r; write(KEYS.progressReports, all); }
    }
  }
  function startProgress(wopId) {
    const wop = workOrderProcess(wopId); if (!wop) return;
    const next = decideWorkingStatus(wop.processName);
    wop.currentStatus = next; wop.updatedAt = nowStr(); _saveWop(wop);
    const prp = prpByWorkOrderProcess(wopId);
    if (prp) { prp.progressStatus = next; prp.actualStart = nowStr(); prp.updatedAt = nowStr(); _savePrp(prp); }
    recomputeWorkOrderStatus(wop.workOrderId);
  }
  function finishProgress(wopId) {
    const wop = workOrderProcess(wopId); if (!wop) return;
    wop.currentStatus = "completed"; wop.updatedAt = nowStr(); _saveWop(wop);
    const prp = prpByWorkOrderProcess(wopId);
    if (prp) { prp.progressStatus = "completed"; prp.actualEnd = nowStr(); prp.updatedAt = nowStr(); _savePrp(prp); }
    recomputeWorkOrderStatus(wop.workOrderId);
  }

  // ========== 進捗管理書編集（管理者） ==========
  function reportEditTarget(reportId, processId) {
    const sorted = prpByReport(reportId);
    if (processId != null && processId !== "") {
      for (let i = 0; i < sorted.length; i++) {
        if (Number(sorted[i].progressReportProcessId) === Number(processId)) {
          if (i === 0) return sorted[i];
          if (sorted[i - 1].progressStatus !== "completed") return null;
          return sorted[i];
        }
      }
    }
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].progressStatus === "completed") continue;
      if (i === 0) return sorted[i];
      if (sorted[i - 1].progressStatus === "completed") return sorted[i];
      return null;
    }
    return null;
  }
  function reportEditValidate(reportId, processId) {
    const sorted = prpByReport(reportId);
    for (let i = 0; i < sorted.length; i++) {
      if (Number(sorted[i].progressReportProcessId) === Number(processId)) {
        if (i > 0 && sorted[i - 1].progressStatus !== "completed") return "1つ前の工程が完了していないため編集出来ません";
        if (i + 1 >= sorted.length) return null;
        const next = sorted[i + 1];
        if (next.progressStatus === "completed") return "1つ後の工程が完了のため編集出来ません";
        if (next.progressStatus !== "not_started") return "1つ後の工程が進行中のため編集出来ません";
        return null;
      }
    }
    return null;
  }
  function reportUpdate(prpId, machineNoActual, assignedUserId, progressStatus, actualStart, expectedEndTime, actualEnd, handoverScheduledAt, comment) {
    const prp = prpById(prpId); if (!prp) return;
    const wop = workOrderProcess(prp.workOrderProcessId);
    const mac = machineByNo(machineNoActual);
    if (wop && mac) { wop.machineId = mac.machineId; }
    prp.machineNoActual = machineNoActual;
    if (wop) wop.assignedUserId = Number(assignedUserId);
    prp.assignedUserId = Number(assignedUserId);
    prp.progressStatus = progressStatus;
    if (wop) wop.currentStatus = progressStatus;
    prp.actualStart = blank(actualStart) ? String(actualStart).replace("T", " ") : prp.actualStart;
    prp.expectedEndTime = blank(expectedEndTime) ? String(expectedEndTime).replace("T", " ") : prp.expectedEndTime;
    prp.actualEnd = blank(actualEnd) ? String(actualEnd).replace("T", " ") : prp.actualEnd;
    prp.handoverScheduledAt = blank(handoverScheduledAt) ? String(handoverScheduledAt).replace("T", " ") : prp.handoverScheduledAt;
    prp.comment = comment;
    prp.updatedAt = nowStr();
    if (wop) { wop.updatedAt = nowStr(); _saveWop(wop); }
    _savePrp(prp);
  }

  // ========== 作業指示書一覧/詳細 ==========
  function searchWorkOrders(keyword, status) {
    let rows = workOrders().filter((w) => w.status !== "cancelled");
    if (status) rows = rows.filter((w) => w.status === status);
    if (keyword) rows = rows.filter((w) => w.orderNo.includes(keyword) || w.partName.includes(keyword));
    return rows;
  }
  // 各受注の最初の未完了工程（machine 付き）
  function activeProcess(woId) {
    const p = processesByWorkOrder(woId).find((x) => x.currentStatus !== "completed");
    if (!p) return null;
    return Object.assign({}, p, { machine: machine(p.machineId) });
  }
  function distinctOrderNo() { return [...new Set(workOrders().map((w) => w.orderNo))].sort(); }
  function distinctPartName() { return [...new Set(workOrders().map((w) => w.partName))].sort(); }
  function distinctClientName() { return [...new Set(workOrders().map((w) => w.clientName))].sort(); }

  // 作業指示書詳細（workInstructionDetail）
  function workInstructionByProcess(wopId) {
    const wop = workOrderProcess(wopId);
    if (!wop) return null;
    return workInstructionByWorkOrder(wop.workOrderId);
  }
  function workInstructionByWorkOrder(woId) {
    const wo = workOrder(woId);
    if (!wo) return null;
    const procs = processesByWorkOrder(woId);
    const processes = procs.map((p) => ({
      processOrder: p.processOrder,
      processName: p.processName,
      machineNo: machineNo(p.machineId),
      status: p.currentStatus,
      statusLabel: statusLabel(p.currentStatus),
      assignedUserId: userName(p.assignedUserId), // 元実装は u.name を assigned_user_id として表示
    }));
    const results = procs.map((p) => {
      const prp = prpByWorkOrderProcess(p.workOrderProcessId);
      return {
        processOrder: p.processOrder,
        processName: p.processName,
        assignedUserId: userName(p.assignedUserId),
        actualStart: prp && prp.actualStart ? fmtDateTime(prp.actualStart) : "",
        actualEnd: prp && prp.actualEnd ? fmtDateTime(prp.actualEnd) : "",
        comment: prp ? prp.comment : null,
      };
    });
    // 先頭工程の machine を基本情報の機械番号に使う（元 SQL は wop.machine_id JOIN）
    const firstMachineNo = procs.length ? machineNo(procs[0].machineId) : null;
    return {
      workOrderId: wo.workOrderId,
      orderNo: wo.orderNo,
      partName: wo.partName,
      clientName: wo.clientName,
      quantity: wo.quantity,
      notes: wo.notes,
      dueDate: fmtDate(wo.dueDate),
      machineNo: firstMachineNo,
      processes,
      results,
    };
  }

  // 移動先選択（workerNavigation）
  function navigationItem(wopId) {
    const wop = workOrderProcess(wopId);
    if (!wop) return null;
    const wo = workOrder(wop.workOrderId);
    return {
      workOrderProcessId: wop.workOrderProcessId,
      orderNo: wo ? wo.orderNo : "",
      partName: wo ? wo.partName : "",
      processName: wop.processName,
    };
  }

  // 作業指示書 編集データ
  function workOrderEditData(woId) {
    const wo = workOrder(woId);
    if (!wo) return null;
    const processes = processesByWorkOrder(woId).map((p) => ({
      workOrderProcessId: p.workOrderProcessId,
      processOrder: p.processOrder,
      processName: p.processName,
      machineId: p.machineId,
      assignedUserId: p.assignedUserId,
      assignedUserName: userName(p.assignedUserId),
      currentStatus: p.currentStatus,
    }));
    return {
      workOrderId: wo.workOrderId,
      orderNo: wo.orderNo,
      partName: wo.partName,
      clientName: wo.clientName,
      quantity: wo.quantity,
      dueDate: wo.dueDate,
      processes,
    };
  }

  // 作業指示書 削除データ
  function workOrderDeleteData(woId) {
    const wo = workOrder(woId);
    if (!wo) return null;
    const processes = processesByWorkOrder(woId).map((p) =>
      Object.assign({}, p, { machine: machine(p.machineId), assignedUser: user(p.assignedUserId) }));
    const reports = progressReportProcesses()
      .filter((p) => Number(p.workOrderId) === Number(woId))
      .sort((a, b) => a.workOrderProcessId - b.workOrderProcessId)
      .map((p) => Object.assign({}, p, {
        workOrderProcess: workOrderProcess(p.workOrderProcessId),
        assignedUser: user(p.assignedUserId),
      }));
    return { workOrder: wo, processes, reports };
  }

  // 作業指示書 登録
  function addWorkOrder(form, processList) {
    const s = session();
    const all = workOrders();
    const wo = {
      workOrderId: nextId(all, "workOrderId"),
      orderNo: form.orderNo,
      partName: form.partName,
      clientName: form.clientName,
      quantity: Number(form.quantity),
      notes: form.notes || null,
      dueDate: form.dueDate,
      status: "not_started",
      createdBy: s && s.loginUser ? s.loginUser.userId : 1,
      createdAt: nowStr(), updatedAt: nowStr(),
    };
    all.push(wo); write(KEYS.workOrders, all);

    const reports = progressReports();
    const report = {
      progressReportId: nextId(reports, "progressReportId"),
      workOrderId: wo.workOrderId,
      status: "not_started",
      createdAt: nowStr(), updatedAt: nowStr(),
    };
    reports.push(report); write(KEYS.progressReports, reports);

    (processList || []).forEach((pf) => {
      const wops = workOrderProcesses();
      const mac = machine(pf.machineId);
      const wop = {
        workOrderProcessId: nextId(wops, "workOrderProcessId"),
        workOrderId: wo.workOrderId,
        processOrder: Number(pf.processOrder),
        processName: pf.processName,
        machineId: Number(pf.machineId),
        assignedUserId: Number(pf.assignedUserId),
        currentStatus: pf.processStatus || "not_started",
        createdAt: nowStr(), updatedAt: nowStr(),
      };
      wops.push(wop); write(KEYS.workOrderProcesses, wops);

      const prps = progressReportProcesses();
      prps.push({
        progressReportProcessId: nextId(prps, "progressReportProcessId"),
        progressReportId: report.progressReportId,
        workOrderId: wo.workOrderId,
        workOrderProcessId: wop.workOrderProcessId,
        assignedUserId: wop.assignedUserId,
        progressStatus: wop.currentStatus,
        machineNoActual: mac ? mac.machineNo : null,
        actualStart: null, expectedEndTime: null, actualEnd: null,
        handoverScheduledAt: null, comment: null, updatedBy: null,
        createdAt: nowStr(), updatedAt: nowStr(),
      });
      write(KEYS.progressReportProcesses, prps);
    });
    return wo.workOrderId;
  }

  // 作業指示書 更新（工程の追加/削除/再採番に対応）
  function updateWorkOrder(woId, dto) {
    const wo = workOrder(woId);
    if (!wo) return;
    wo.orderNo = dto.orderNo; wo.partName = dto.partName; wo.clientName = dto.clientName;
    wo.quantity = Number(dto.quantity); wo.dueDate = dto.dueDate; wo.updatedAt = nowStr();
    _saveWorkOrder(wo);

    const submittedIds = new Set((dto.processes || []).filter((p) => p.workOrderProcessId).map((p) => Number(p.workOrderProcessId)));
    // 削除された工程
    processesByWorkOrder(woId).forEach((existing) => {
      if (!submittedIds.has(Number(existing.workOrderProcessId))) {
        let prps = progressReportProcesses().filter((p) => Number(p.workOrderProcessId) !== Number(existing.workOrderProcessId));
        write(KEYS.progressReportProcesses, prps);
        let wops = workOrderProcesses().filter((p) => Number(p.workOrderProcessId) !== Number(existing.workOrderProcessId));
        write(KEYS.workOrderProcesses, wops);
      }
    });
    let order = 1;
    const report = progressReportByWorkOrder(woId);
    (dto.processes || []).forEach((pd) => {
      let wops = workOrderProcesses();
      let wop;
      if (!pd.workOrderProcessId) {
        wop = { workOrderProcessId: nextId(wops, "workOrderProcessId"), workOrderId: woId, createdAt: nowStr() };
        wops.push(wop);
      } else {
        wop = wops.find((p) => Number(p.workOrderProcessId) === Number(pd.workOrderProcessId));
      }
      if (!wop) return;
      wop.processOrder = order++;
      wop.processName = pd.processName;
      wop.machineId = Number(pd.machineId);
      wop.assignedUserId = Number(pd.assignedUserId);
      wop.currentStatus = pd.currentStatus;
      wop.updatedAt = nowStr();
      write(KEYS.workOrderProcesses, wops);
      // prp 同期
      const mac = machine(pd.machineId);
      let prps = progressReportProcesses();
      let prp = prps.find((p) => Number(p.workOrderProcessId) === Number(wop.workOrderProcessId));
      if (!prp && report) {
        prp = {
          progressReportProcessId: nextId(prps, "progressReportProcessId"),
          progressReportId: report.progressReportId,
          workOrderId: woId, workOrderProcessId: wop.workOrderProcessId,
          actualStart: null, expectedEndTime: null, actualEnd: null,
          handoverScheduledAt: null, comment: null, updatedBy: null,
          createdAt: nowStr(),
        };
        prps.push(prp);
      }
      if (prp) {
        prp.assignedUserId = Number(pd.assignedUserId);
        prp.machineNoActual = mac ? mac.machineNo : null;
        prp.progressStatus = pd.currentStatus;
        prp.updatedAt = nowStr();
        write(KEYS.progressReportProcesses, prps);
      }
    });
  }

  function deleteWorkOrder(woId) {
    write(KEYS.progressReportProcesses, progressReportProcesses().filter((p) => Number(p.workOrderId) !== Number(woId)));
    write(KEYS.progressReports, progressReports().filter((r) => Number(r.workOrderId) !== Number(woId)));
    write(KEYS.workOrderProcesses, workOrderProcesses().filter((p) => Number(p.workOrderId) !== Number(woId)));
    write(KEYS.workOrders, workOrders().filter((w) => Number(w.workOrderId) !== Number(woId)));
  }

  function existsDuplicateWorkOrder(form, processList) {
    return workOrders().some((w) => {
      if (w.orderNo !== form.orderNo || w.partName !== form.partName) return false;
      if (Number(w.quantity) !== Number(form.quantity)) return false;
      if (fmtDate(w.dueDate) !== fmtDate(form.dueDate)) return false;
      const dbProcs = processesByWorkOrder(w.workOrderId);
      if (dbProcs.length !== (processList || []).length) return false;
      return dbProcs.every((p, i) => p.processName === processList[i].processName);
    });
  }

  // ========== 技能継承（ナレッジ） ==========
  function skillContents() { return read(KEYS.skillContents).filter((s) => Number(s.isDeleted) !== 1); }
  function skillContent(id) {
    const s = read(KEYS.skillContents).find((x) => Number(x.skillContentsId) === Number(id));
    return s && Number(s.isDeleted) !== 1 ? s : null;
  }
  function skillFiles(scId) {
    return read(KEYS.skillContentsFiles).filter((f) => Number(f.skillContentsId) === Number(scId) && Number(f.isDeleted) !== 1);
  }
  function skillFile(fileId) {
    return read(KEYS.skillContentsFiles).find((f) => Number(f.skillContentsFilesId) === Number(fileId) && Number(f.isDeleted) !== 1) || null;
  }
  function previewInfo(fileType) {
    if (fileType && fileType.startsWith("image")) return { previewType: "image", fileLabel: "画像" };
    if (fileType && fileType.startsWith("video")) return { previewType: "video", fileLabel: "動画" };
    if (fileType && fileType.indexOf("pdf") >= 0) return { previewType: "pdf", fileLabel: "PDF" };
    if (fileType && fileType.indexOf("text") >= 0) return { previewType: "text", fileLabel: "TEXT" };
    return { previewType: "file", fileLabel: "資料" };
  }
  function searchSkillCards(keyword, targetProcess, loginUserId) {
    let list = skillContents()
      .filter((s) => {
        const kw = !keyword || (s.title && s.title.includes(keyword)) || (s.targetPart && s.targetPart.includes(keyword));
        const tp = !targetProcess || s.targetProcess === targetProcess;
        return kw && tp;
      })
      .sort((a, b) => (parseDate(b.createdAt) || 0) - (parseDate(a.createdAt) || 0));
    const cards = list.map((s) => {
      const files = skillFiles(s.skillContentsId);
      const card = {
        skillContentsId: s.skillContentsId, title: s.title, targetPart: s.targetPart,
        targetProcess: s.targetProcess, description: s.description, registeredByName: s.registeredByName,
      };
      if (files.length) {
        const f = files[0];
        const pv = previewInfo(f.fileType);
        card.fileId = f.skillContentsFilesId; card.fileName = f.fileName; card.fileType = f.fileType;
        card.previewType = pv.previewType; card.fileLabel = pv.fileLabel;
      } else {
        card.previewType = "none"; card.fileLabel = "資料なし";
      }
      return card;
    });
    if (loginUserId != null) {
      const assigned = [...new Set(workOrderProcesses()
        .filter((p) => Number(p.assignedUserId) === Number(loginUserId))
        .map((p) => p.processName))];
      cards.sort((a, b) => {
        const aa = assigned.includes(a.targetProcess), ba = assigned.includes(b.targetProcess);
        if (aa && !ba) return -1; if (!aa && ba) return 1; return 0;
      });
    }
    return cards;
  }
  function groupSkillCards(cards) {
    const map = new Map();
    cards.forEach((c) => {
      const key = c.targetProcess && c.targetProcess.trim() ? c.targetProcess : "工程未設定";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(c);
    });
    return map;
  }
  function detailViewerType(fileType) {
    if (!fileType) return "file";
    if (fileType.startsWith("video")) return "video";
    if (fileType.startsWith("image")) return "image";
    if (fileType.indexOf("pdf") >= 0) return "pdf";
    return "file";
  }
  function addSkillContent(form) {
    const all = read(KEYS.skillContents);
    const sc = {
      skillContentsId: nextId(all, "skillContentsId"),
      title: form.title, targetPart: form.targetPart, targetProcess: form.targetProcess,
      description: form.description, workContent: form.workContent, notes: form.notes,
      registeredByName: form.registeredByName,
      createdBy: 1, updatedBy: 1, isDeleted: 0, createdAt: nowStr(), updatedAt: nowStr(),
    };
    all.push(sc); write(KEYS.skillContents, all);
    return sc.skillContentsId;
  }
  function updateSkillContent(id, form) {
    const all = read(KEYS.skillContents);
    const sc = all.find((x) => Number(x.skillContentsId) === Number(id));
    if (!sc) return;
    sc.title = form.title; sc.targetPart = form.targetPart; sc.targetProcess = form.targetProcess;
    sc.description = form.description; sc.workContent = form.workContent; sc.notes = form.notes;
    sc.registeredByName = form.registeredByName; sc.updatedBy = 1; sc.updatedAt = nowStr();
    write(KEYS.skillContents, all);
  }
  function deleteSkillContent(id) {
    const all = read(KEYS.skillContents);
    const sc = all.find((x) => Number(x.skillContentsId) === Number(id));
    if (sc) { sc.isDeleted = 1; sc.updatedAt = nowStr(); write(KEYS.skillContents, all); }
    const files = read(KEYS.skillContentsFiles);
    files.forEach((f) => { if (Number(f.skillContentsId) === Number(id)) { f.isDeleted = 1; f.updatedAt = nowStr(); } });
    write(KEYS.skillContentsFiles, files);
  }

  // ========== ユーザー登録 ==========
  function loginIdExists(loginId) { return !!userByLogin(loginId); }
  function addUser(name, loginId, password, role) {
    if (loginIdExists(loginId)) throw new Error("この社員IDはすでに使用されています。");
    const all = users();
    all.push({
      userId: nextId(all, "userId"), name, loginId, password,
      passwordHash: null, role, isActive: 1, createdAt: nowStr(), updatedAt: nowStr(),
    });
    write(KEYS.users, all);
  }

  // ========== 下書き（入力→確認 受け渡し, sessionStorage） ==========
  function setDraft(key, obj) { sessionStorage.setItem(NS + "draft:" + key, JSON.stringify(obj)); }
  function getDraft(key) {
    try { return JSON.parse(sessionStorage.getItem(NS + "draft:" + key) || "null"); }
    catch (e) { return null; }
  }
  function clearDraft(key) { sessionStorage.removeItem(NS + "draft:" + key); }

  window.TeamH = {
    init, resetData,
    // helpers
    esc, fmtDate, fmtDateTime, fmtTimeHM, toLocalInput, statusLabel, dashboardStatusLabel,
    ROLE_LABEL, remainingDays, TODAY,
    // session
    session, login, logout, requireLogin, authenticate, homeUrl,
    // masters
    users, user, userByLogin, userName, craftsmen, machines, machine, machineByNo, machineNo,
    workOrders, workOrder, workOrderProcesses, workOrderProcess, processesByWorkOrder,
    progressReports, progressReport, progressReportByWorkOrder,
    progressReportProcesses, prpById, prpByWorkOrderProcess, prpByReport, prpView, handoverNotes,
    // dashboard
    dashboardItems, dashboardGroups, countWorkingItems, countCompletedItems,
    countWorkingMachines, totalMachineCount, machineOperationRate, flowTargetOrders, priorityFlow,
    // todo
    todoList, priorityWork, todoPartNameList, todoMachineNoList,
    // progress list/detail
    searchProgress, progressGroups, progressDetail,
    // progress update
    progressPage, updateProgress, startProgress, finishProgress,
    // report edit
    reportEditTarget, reportEditValidate, reportUpdate,
    // work orders
    searchWorkOrders, activeProcess, distinctOrderNo, distinctPartName, distinctClientName,
    workInstructionByProcess, workInstructionByWorkOrder, navigationItem,
    workOrderEditData, workOrderDeleteData, addWorkOrder, updateWorkOrder, deleteWorkOrder, existsDuplicateWorkOrder,
    // knowledge
    skillContents, skillContent, skillFiles, skillFile, searchSkillCards, groupSkillCards,
    detailViewerType, previewInfo, addSkillContent, updateSkillContent, deleteSkillContent,
    // user regist
    loginIdExists, addUser,
    // draft
    setDraft, getDraft, clearDraft,
  };
})();
