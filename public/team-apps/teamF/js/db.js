/*
 * teamF「花あかりの湯」旅館予約管理アプリ — 擬似データ層
 * --------------------------------------------------------------
 * 本物の Spring + MySQL の代わりに、seed.json を localStorage に
 * 取り込み、JSON データだけでアプリを動かします。
 * ページからは window.TeamF 経由でアクセスします。
 *
 *   <script src="./js/db.js"></script>
 *   <script>
 *     TeamF.init().then(() => {
 *       const list = TeamF.reservationViews();
 *       ...
 *     });
 *   </script>
 *
 * データ構成（seed.json のキー）:
 *   accounts          ログインアカウント（staff001 / 1111）
 *   rooms             客室マスタ 25室（roomId, roomNo, roomType, capacity, roomStatus）
 *   plans             宿泊プラン 5種（planId, planName, roomType, min/maxPeople, basePrice, description）
 *   routes            予約経路 7種（routeId, routeCode, routeName, routeType, commissionRate）
 *   customers         顧客カルテ（customerId, name, nameKana, birthDate, phone, email,
 *                     allergyInfo, hospitalityNote, memo, visitCount, karteStatus, isDeleted）
 *   reservations      予約（reservationId, customerId, planId, routeId, stayDate, checkoutDate,
 *                     checkinTime, numPeople, status, requestNote, allergyInfo,
 *                     changeReason, cancelReason, checkedInAt, checkedOutAt）
 *   reservationRooms  予約⇔客室の割当（reservationRoomId, reservationId, roomId,
 *                     assignedFrom, assignedTo, assignStatus, assignmentMethod）
 */
(function (global) {
  "use strict";

  const NS = "teamF:";
  const SEED_FLAG = NS + "seeded";

  const COLLECTIONS = [
    "accounts",
    "rooms",
    "plans",
    "routes",
    "customers",
    "reservations",
    "reservationRooms",
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
    if (!force && global.localStorage.getItem(SEED_FLAG)) return;
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
    return list.reduce((mx, x) => Math.max(mx, x[idField] || 0), 0) + 1;
  }

  const TeamF = {
    init,
    reset,

    // ---- 参照系（コレクション全体） ----
    accounts: () => read("accounts", []),
    rooms: () => read("rooms", []),
    plans: () => read("plans", []),
    routes: () => read("routes", []),
    customers: () => read("customers", []),
    reservations: () => read("reservations", []),
    reservationRooms: () => read("reservationRooms", []),

    // 削除されていない顧客のみ（カルテ一覧用）
    activeCustomers: () =>
      TeamF.customers().filter((c) => !c.isDeleted),

    // ---- ID 単体取得 ----
    room: (id) => TeamF.rooms().find((r) => r.roomId === Number(id)) || null,
    plan: (id) => TeamF.plans().find((p) => p.planId === Number(id)) || null,
    route: (id) => TeamF.routes().find((r) => r.routeId === Number(id)) || null,
    customer: (id) =>
      TeamF.customers().find((c) => c.customerId === Number(id)) || null,
    reservation: (id) =>
      TeamF.reservations().find((r) => r.reservationId === Number(id)) || null,

    // ---- 結合 ----
    // 予約に紐づく客室割当（1予約に複数室の可能性あり）
    roomsOfReservation: (resId) =>
      TeamF.reservationRooms().filter(
        (rr) => rr.reservationId === Number(resId)
      ),
    reservationsOfCustomer: (custId) =>
      TeamF.reservations().filter((r) => r.customerId === Number(custId)),

    // 予約1件を画面表示しやすい形に結合したビュー
    //   { reservation, customer, plan, route, assignedRooms:[room...], roomLabel }
    reservationView: (resId) => {
      const r = TeamF.reservation(resId);
      if (!r) return null;
      return TeamF._view(r);
    },
    // 予約一覧ビュー（任意のフィルタ関数）
    reservationViews: (predicate) => {
      let list = TeamF.reservations();
      if (predicate) list = list.filter(predicate);
      return list.map((r) => TeamF._view(r));
    },
    _view: (r) => {
      const assignedRooms = TeamF.roomsOfReservation(r.reservationId)
        .map((rr) => TeamF.room(rr.roomId))
        .filter(Boolean);
      return {
        reservation: r,
        customer: TeamF.customer(r.customerId),
        plan: TeamF.plan(r.planId),
        route: TeamF.route(r.routeId),
        assignedRooms,
        roomLabel: assignedRooms.map((rm) => rm.roomNo).join("・"),
      };
    },

    // ---- 検索（emp/list, cus の検索画面用） ----
    // 条件はすべて任意。日付は "YYYY-MM-DD" 文字列で前方一致比較。
    searchReservations: (cond) => {
      cond = cond || {};
      return TeamF.reservationViews((r) => {
        if (cond.status && r.status !== cond.status) return false;
        if (cond.customerName) {
          const c = TeamF.customer(r.customerId);
          if (!c || c.name.indexOf(cond.customerName) < 0) return false;
        }
        if (cond.phone) {
          const c = TeamF.customer(r.customerId);
          if (!c || (c.phone || "").indexOf(cond.phone) < 0) return false;
        }
        if (cond.stayFrom && r.stayDate < cond.stayFrom) return false;
        if (cond.stayTo && r.stayDate > cond.stayTo) return false;
        if (cond.planId && r.planId !== Number(cond.planId)) return false;
        if (cond.routeId && r.routeId !== Number(cond.routeId)) return false;
        return true;
      });
    },
    // 本日宿泊の予約件数（女将bot / topmenu 用）。基準日は today()。
    todayReservationCount: () =>
      TeamF.reservations().filter((r) => r.stayDate === TeamF.today()).length,

    // ---- 更新系（localStorage に保存） ----
    addCustomer: (cust) => {
      const list = TeamF.customers();
      cust.customerId = nextId(list, "customerId");
      cust.visitCount = cust.visitCount || 0;
      cust.karteStatus = cust.karteStatus || "新規";
      cust.isDeleted = 0;
      cust.createdAt = cust.createdAt || isoNow();
      cust.updatedAt = isoNow();
      list.push(cust);
      write("customers", list);
      return cust;
    },
    updateCustomer: (id, patch) => {
      const list = TeamF.customers();
      const c = list.find((x) => x.customerId === Number(id));
      if (c) { Object.assign(c, patch, { updatedAt: isoNow() }); write("customers", list); }
      return c;
    },
    // 論理削除（カルテ削除）。reason と削除日時を記録。
    deleteCustomer: (id, reason) => {
      const list = TeamF.customers();
      const c = list.find((x) => x.customerId === Number(id));
      if (c) {
        c.isDeleted = 1;
        c.deletedReason = reason || "";
        c.deletedAt = isoNow();
        write("customers", list);
      }
      return c;
    },

    // 予約の新規作成。room を割り当てる場合は roomIds を渡す。
    addReservation: (res, roomIds) => {
      const list = TeamF.reservations();
      res.reservationId = nextId(list, "reservationId");
      res.status = res.status || "予約済";
      res.createdAt = res.createdAt || isoNow();
      res.updatedAt = isoNow();
      list.push(res);
      write("reservations", list);
      (roomIds || []).forEach((rid) =>
        TeamF.assignRoom(res.reservationId, rid, res.stayDate, res.checkoutDate)
      );
      return res;
    },
    updateReservation: (id, patch) => {
      const list = TeamF.reservations();
      const r = list.find((x) => x.reservationId === Number(id));
      if (r) { Object.assign(r, patch, { updatedAt: isoNow() }); write("reservations", list); }
      return r;
    },
    // キャンセル：ステータスと理由・日時を記録。
    cancelReservation: (id, reason, byType) => {
      return TeamF.updateReservation(id, {
        status: "キャンセル",
        cancelReason: reason || "",
        cancelledByType: byType || "staff",
        cancelledAt: isoNow(),
      });
    },
    checkin: (id) =>
      TeamF.updateReservation(id, { status: "宿泊中", checkedInAt: isoNow() }),
    checkout: (id) =>
      TeamF.updateReservation(id, { status: "チェックアウト済", checkedOutAt: isoNow() }),

    // 客室割当
    assignRoom: (resId, roomId, from, to) => {
      const list = TeamF.reservationRooms();
      const rr = {
        reservationRoomId: nextId(list, "reservationRoomId"),
        reservationId: Number(resId),
        roomId: Number(roomId),
        assignedFrom: from || null,
        assignedTo: to || null,
        assignStatus: "割当済",
        assignmentMethod: "MANUAL",
        createdAt: isoNow(),
        updatedAt: isoNow(),
      };
      list.push(rr);
      write("reservationRooms", list);
      return rr;
    },
    // 予約の割当客室を total 置き換え（変更画面用）
    reassignRooms: (resId, roomIds, from, to) => {
      const remain = TeamF.reservationRooms().filter(
        (rr) => rr.reservationId !== Number(resId)
      );
      write("reservationRooms", remain);
      (roomIds || []).forEach((rid) =>
        TeamF.assignRoom(resId, rid, from, to)
      );
    },
    // 客室の状態更新（emp/room）。例: 空室 / 清掃中 / 使用中
    setRoomStatus: (roomId, status) => {
      const list = TeamF.rooms();
      const rm = list.find((x) => x.roomId === Number(roomId));
      if (rm) { rm.roomStatus = status; rm.updatedAt = isoNow(); write("rooms", list); }
      return rm;
    },
    // ある日付に空いている部屋（指定 roomType 任意）。割当の期間が重なる部屋を除外。
    availableRooms: (stayDate, checkoutDate, roomType, excludeResId) => {
      const busy = new Set(
        TeamF.reservationRooms()
          .filter((rr) => {
            if (excludeResId && rr.reservationId === Number(excludeResId)) return false;
            const res = TeamF.reservation(rr.reservationId);
            if (!res || res.status === "キャンセル") return false;
            // 期間重なり判定
            return !(rr.assignedTo <= stayDate || rr.assignedFrom >= checkoutDate);
          })
          .map((rr) => rr.roomId)
      );
      return TeamF.rooms().filter(
        (rm) =>
          rm.isActive &&
          !busy.has(rm.roomId) &&
          (!roomType || rm.roomType === roomType)
      );
    },

    // ---- 擬似セッション（従業員ログイン staff001 / 1111） ----
    login: (loginId, password) => {
      const a = TeamF.accounts().find(
        (x) => x.loginId === loginId && String(x.passwordHash) === String(password)
      );
      if (!a) return null;
      write("session", { account: a });
      return a;
    },
    session: () => read("session", null),
    logout: () => global.localStorage.removeItem(NS + "session"),
    // emp 画面のログインガード。未ログインなら login.html へ。
    requireLogin: () => {
      const s = TeamF.session();
      if (!s) { global.location.href = "./login.html"; return null; }
      return s;
    },

    // ---- 確認画面への一時データ受け渡し（sessionStorage） ----
    // Spring の「フォーム→確認画面→登録」の session 持ち回りを擬似する。
    // kind 例: "regist" / "update" / "cancel" / "regcus" / "upcus" / "cancus" / "record_edit"
    setPending: (kind, obj) => {
      global.sessionStorage.setItem(NS + "pending:" + kind, JSON.stringify(obj));
      return obj;
    },
    getPending: (kind) => {
      try {
        const raw = global.sessionStorage.getItem(NS + "pending:" + kind);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clearPending: (kind) => global.sessionStorage.removeItem(NS + "pending:" + kind),

    // ---- 女将ボット（AIの代わりにルールベースで助言を生成） ----
    okamiHistory: () => read("okamiHistory", []),
    addOkamiMessage: (role, message) => {
      const list = TeamF.okamiHistory();
      list.push({ role: role, message: message });
      write("okamiHistory", list);
      return list;
    },
    clearOkami: () => global.localStorage.removeItem(NS + "okamiHistory"),
    // 相談内容と（任意の）対象顧客カルテから女将らしい助言を組み立てる。
    okamiAdvice: (message, customer) => {
      const msg = String(message || "");
      const lines = [];
      const name = customer ? customer.name : null;
      lines.push(
        name
          ? `${name}様のおもてなしについてですね。承知いたしました。`
          : "かしこまりました。女将がご案内いたします。"
      );
      if (customer) {
        if (customer.allergyInfo)
          lines.push(`アレルギー（${customer.allergyInfo}）には十分ご配慮を。お料理は代替食材でご用意なさってください。`);
        if (customer.hospitalityNote)
          lines.push(`おもてなしメモ：「${customer.hospitalityNote}」。こちらを踏まえたご対応を。`);
        if (Number(customer.visitCount) >= 3)
          lines.push(`${customer.visitCount}回目のご来館の常連様です。お名前でお声がけし、前回の会話に触れると喜ばれます。`);
        else if (Number(customer.visitCount) === 0)
          lines.push("初めてのご来館です。館内のご案内を丁寧に、緊張をほぐすお声がけを。");
      }
      // キーワードに応じた助言
      if (/記念日|誕生日|還暦|サプライズ|お祝/.test(msg))
        lines.push("記念日のご利用です。お花・お赤飯・鯛の塩焼き、写真サービスのご提案を。サプライズ演出も承れます。");
      if (/食|料理|夕食|懐石|アレル/.test(msg))
        lines.push("お食事は素材と提供時間のご希望を伺い、板長と共有なさってください。");
      if (/部屋|客室|露天|静か/.test(msg))
        lines.push("お部屋は眺望・静けさのご希望を確認し、可能な範囲で上層階や角部屋をご用意なさると良いでしょう。");
      if (/子供|こども|お子/.test(msg))
        lines.push("お子様連れには取り分けやすいお料理と、貸切風呂のご案内を。");
      if (lines.length <= 1)
        lines.push("ご要望の詳細をお聞かせいただければ、より丁寧なおもてなしをご提案いたします。");
      return lines.join("\n");
    },

    // デモ上の「今日」。seed の予約日が 2026年6月中心のため固定。
    today: () => "2026-06-09",
  };

  function isoNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
    );
  }

  // 表示ヘルパ
  TeamF.esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  TeamF.fmtDate = (d) => {
    if (!d) return "";
    return String(d).slice(0, 10).replace(/-/g, "/");
  };
  TeamF.fmtDateTime = (iso) => {
    if (!iso) return "";
    return String(iso).replace("T", " ").slice(0, 16).replace(/-/g, "/");
  };
  TeamF.fmtTime = (t) => (t ? String(t).slice(0, 5) : "");
  TeamF.yen = (n) =>
    "¥" + Number(n || 0).toLocaleString("ja-JP");
  // 和暦曜日つき日付「2026年6月9日（火）」
  TeamF.fmtJpDate = (d) => {
    if (!d) return "";
    const dt = new Date(String(d).slice(0, 10) + "T00:00:00");
    const w = ["日", "月", "火", "水", "木", "金", "土"][dt.getDay()];
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${w}）`;
  };

  global.TeamF = TeamF;
})(window);
