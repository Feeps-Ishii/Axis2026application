/*
 * teamE「ニシキギ」現場管理アプリ — 擬似データ層
 * --------------------------------------------------------------
 * 本物の Spring + MySQL の代わりに、seed.json を localStorage に
 * 取り込み、JSON データだけでアプリを動かします。
 * ページからは window.TeamE 経由でアクセスします。
 *
 *   <script src="./js/db.js"></script>
 *   <script>
 *     TeamE.init().then(() => {
 *       const sites = TeamE.sites();
 *       ...
 *     });
 *   </script>
 */
(function (global) {
  "use strict";

  const NS = "teamE:";
  const SEED_FLAG = NS + "seeded";

  const COLLECTIONS = [
    "users",
    "sites",
    "managers",
    "dailyreports",
    "safeties",
    "troubles",
    "chats",
  ];

  function read(key, fallback) {
    try {
      const raw = global.localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    global.localStorage.setItem(NS + key, JSON.stringify(value));
    return value;
  }

  // seed.json を取り込む（初回のみ）。force=true で再投入。
  async function init(force) {
    if (!force && global.localStorage.getItem(SEED_FLAG)) {
      return;
    }
    const res = await fetch("./data/seed.json", { cache: "no-store" });
    const seed = await res.json();
    COLLECTIONS.forEach((c) => write(c, seed[c] || []));
    global.localStorage.setItem(SEED_FLAG, "1");
  }

  function reset() {
    Object.keys(global.localStorage)
      .filter((k) => k.indexOf(NS) === 0)
      .forEach((k) => global.localStorage.removeItem(k));
  }

  function nextId(list, idField) {
    return list.reduce((m, x) => Math.max(m, x[idField] || 0), 0) + 1;
  }

  // ---- 表示用ラベル（コントローラ/テンプレ側の数値→日本語） ----
  // ※テンプレートの実装に厳密に合わせています。
  const WEATHER = { 1: "晴れ", 2: "曇り", 3: "雨", 0: "雪" };
  const ROLL = { 0: "本社", 1: "現場担当", 2: "閲覧" };
  const PRIORITY = { 0: "なし", 1: "低", 2: "中", 3: "高" };
  const TROUBLE_TYPE = { 1: "事故", 2: "資材不足", 3: "納品遅れ", 4: "工程遅延", 5: "その他" };
  // 安全点検：値 0 = 良好 / 1 = 不備
  const SAFETY_ITEMS = [
    { key: "scaffolding", label: "足場（手すり・幅木・滑り止め）" },
    { key: "protectingOpenings", label: "開口部養生" },
    { key: "safetyHarness", label: "高所作業の安全帯使用" },
    { key: "equipmentInspection", label: "重機点検記録" },
    { key: "fireExtinguisher", label: "火気使用時の消火器配置" },
    { key: "organization", label: "整理整頓（つまずきリスク）" },
    { key: "electricalInsulation", label: "仮設電気の絶縁" },
  ];

  const TeamE = {
    init,
    reset,

    // ---- ラベル ----
    label: { WEATHER, ROLL, PRIORITY, TROUBLE_TYPE, SAFETY_ITEMS },

    // ---- 参照系 ----
    users: () => read("users", []),
    sites: () => read("sites", []),
    site: (id) => TeamE.sites().find((s) => s.siteId === Number(id)) || null,
    managers: () => read("managers", []),
    reports: () => read("dailyreports", []),
    safeties: () => read("safeties", []),
    troubles: () => read("troubles", []),
    chats: () => read("chats", []),

    reportsBySite: (siteId) =>
      TeamE.reports().filter((r) => r.siteId === Number(siteId)),
    safetiesBySite: (siteId) =>
      TeamE.safeties().filter((s) => s.siteId === Number(siteId)),
    troublesBySite: (siteId) =>
      TeamE.troubles().filter((t) => t.siteId === Number(siteId)),

    // ---- ID 単体取得（編集・確認画面用） ----
    reportById: (id) =>
      TeamE.reports().find((r) => r.reportId === Number(id)) || null,
    safetyById: (id) =>
      TeamE.safeties().find((s) => s.safetyId === Number(id)) || null,
    troubleById: (id) =>
      TeamE.troubles().find((t) => t.troubleId === Number(id)) || null,
    chatsBySite: (siteId) =>
      TeamE.chats()
        .filter((c) => c.siteId === Number(siteId))
        .sort((a, b) => (a.dateTime < b.dateTime ? -1 : 1)),

    // ログイン中ユーザーが担当する現場ID（無ければ null）
    siteIdOfUser: (userId) => {
      if (Number(userId) === 1) return 1;
      const m = TeamE.managers().find((m) => m.userId === Number(userId));
      return m ? m.siteId : null;
    },

    // ---- 更新系（localStorageに保存） ----
    addChat: (chat) => {
      const list = TeamE.chats();
      chat.chatId = nextId(list, "chatId");
      chat.dateTime = chat.dateTime || isoNow();
      list.push(chat);
      write("chats", list);
      return chat;
    },
    addReport: (report) => {
      const list = TeamE.reports();
      report.reportId = nextId(list, "reportId");
      report.dCreatedAt = report.dCreatedAt || isoNow();
      report.dStatusFlag = report.dStatusFlag || 0;
      list.push(report);
      write("dailyreports", list);
      return report;
    },
    addSafety: (safety) => {
      const list = TeamE.safeties();
      safety.safetyId = nextId(list, "safetyId");
      safety.sCreatedAt = safety.sCreatedAt || isoNow();
      safety.sStatusFlag = safety.sStatusFlag || 0;
      list.push(safety);
      write("safeties", list);
      return safety;
    },
    addTrouble: (trouble) => {
      const list = TeamE.troubles();
      trouble.troubleId = nextId(list, "troubleId");
      trouble.tCreatedAt = trouble.tCreatedAt || isoNow();
      trouble.tStatusFlag = trouble.tStatusFlag || 0;
      list.push(trouble);
      write("troubles", list);
      return trouble;
    },

    // 既存レコードの更新（編集フロー用）。patch を Object.assign で反映。
    updateReport: (reportId, patch) => {
      const list = TeamE.reports();
      const r = list.find((x) => x.reportId === Number(reportId));
      if (r) { Object.assign(r, patch); write("dailyreports", list); }
      return r;
    },
    updateSafety: (safetyId, patch) => {
      const list = TeamE.safeties();
      const s = list.find((x) => x.safetyId === Number(safetyId));
      if (s) { Object.assign(s, patch); write("safeties", list); }
      return s;
    },
    updateTrouble: (troubleId, patch) => {
      const list = TeamE.troubles();
      const t = list.find((x) => x.troubleId === Number(troubleId));
      if (t) { Object.assign(t, patch); write("troubles", list); }
      return t;
    },

    // 状態フラグの更新（本社の確認完了など）
    setReportStatus: (reportId, flag) => {
      const list = TeamE.reports();
      const r = list.find((x) => x.reportId === Number(reportId));
      if (r) { r.dStatusFlag = flag; write("dailyreports", list); }
      return r;
    },
    setSafetyStatus: (safetyId, flag) => {
      const list = TeamE.safeties();
      const s = list.find((x) => x.safetyId === Number(safetyId));
      if (s) { s.sStatusFlag = flag; write("safeties", list); }
      return s;
    },
    setTroubleStatus: (troubleId, flag) => {
      const list = TeamE.troubles();
      const t = list.find((x) => x.troubleId === Number(troubleId));
      if (t) { t.tStatusFlag = flag; write("troubles", list); }
      return t;
    },

    // ---- 擬似セッション ----
    login: (userId, password) => {
      const u = TeamE.users().find(
        (u) => u.userId === Number(userId) && u.password === password
      );
      if (!u) return null;
      const siteId = TeamE.siteIdOfUser(u.userId);
      write("session", { user: u, siteId: siteId });
      return u;
    },
    session: () => read("session", null),
    logout: () => global.localStorage.removeItem(NS + "session"),

    // ---- 確認画面用の一時データ受け渡し（sessionStorage） ----
    // Spring の「フォーム→確認画面→登録」の session 持ち回りを擬似する。
    // kind 例: "report" / "safety" / "trouble"
    setPending: (kind, obj) => {
      global.sessionStorage.setItem(NS + "pending:" + kind, JSON.stringify(obj));
      return obj;
    },
    getPending: (kind) => {
      try {
        const raw = global.sessionStorage.getItem(NS + "pending:" + kind);
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },
    clearPending: (kind) => global.sessionStorage.removeItem(NS + "pending:" + kind),

    // ログイン必須ページのガード。未ログインなら login.html へ。
    requireLogin: () => {
      const s = TeamE.session();
      if (!s) {
        global.location.href = "./login.html";
        return null;
      }
      return s;
    },

    // デモ上の「今日」。初期データがこの日付なので、いつ動かしても
    // 「本日の日報/安全点検」として表示されるよう固定しています。
    today: () => "2026-06-08",

    // 現場の「本日の日報」状態（未提出 / 未確認 / 確認済）
    dailyStatusForSite: (siteId) => {
      const today = TeamE.today();
      const reps = TeamE.reportsBySite(siteId).filter(
        (r) => r.targetDate === today
      );
      if (reps.length === 0) return "未提出";
      return reps.some((r) => r.dStatusFlag === 1) ? "確認済" : "未確認";
    },

    // 現場の「本日の安全点検」状態
    safetyStatusForSite: (siteId) => {
      const today = TeamE.today();
      const list = TeamE.safetiesBySite(siteId).filter(
        (s) => String(s.sCreatedAt).slice(0, 10) === today
      );
      if (list.length === 0) return "未提出";
      return list.some((s) => s.sStatusFlag === 1) ? "確認済" : "未確認";
    },

    // 安全点検：良好件数（値0）/ 不備件数（値1）/ 判定
    safetyGood: (s) => SAFETY_ITEMS.filter((it) => s[it.key] === 0).length,
    safetyBad: (s) => SAFETY_ITEMS.filter((it) => s[it.key] === 1).length,
    safetyJudgement: (s) => (TeamE.safetyBad(s) > 0 ? "要対応" : "良好"),
  };

  function isoNow() {
    // 表示用の簡易ISO（秒まで）。new Date() を使用。
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() +
      "-" + p(d.getMonth() + 1) +
      "-" + p(d.getDate()) +
      "T" + p(d.getHours()) +
      ":" + p(d.getMinutes()) +
      ":" + p(d.getSeconds())
    );
  }

  // 表示ヘルパ（HTMLエスケープ・日時整形）
  TeamE.esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  TeamE.fmtDateTime = (iso) => {
    if (!iso) return "";
    return String(iso).replace("T", " ").slice(0, 16).replace(/-/g, "/");
  };
  TeamE.fmtDate = (iso) => {
    if (!iso) return "";
    return String(iso).slice(0, 10).replace(/-/g, "/");
  };

  global.TeamE = TeamE;
})(window);
