/*
 * teamI「ことのは書房」書籍・POP管理システム — 擬似データ層
 * --------------------------------------------------------------
 * 本物の Spring + MySQL の代わりに seed.json を localStorage に取り込み、
 * JSON データだけでアプリを動かします。ページからは window.TeamI 経由で参照します。
 */
(function (global) {
  "use strict";

  const NS = "teamI:";
  const SEED_FLAG = NS + "seeded";
  const COLLECTIONS = [
    "categories", "stores", "staff", "books",
    "stocks", "pops", "comments", "orders",
  ];

  function read(key, fb) {
    try {
      const raw = global.localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fb;
    } catch (e) { return fb; }
  }
  function write(key, val) {
    global.localStorage.setItem(NS + key, JSON.stringify(val));
    return val;
  }

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
  function nextId(list) {
    return list.reduce((m, x) => Math.max(m, x.id || 0), 0) + 1;
  }

  // 追加/更新/論理削除の共通処理（生コレクションを操作）
  function mutAdd(coll, obj) {
    const all = read(coll, []);
    obj.id = nextId(all);
    if (obj.isDeleted === undefined) obj.isDeleted = false;
    if (obj.createdAt === undefined) obj.createdAt = isoNow();
    obj.updatedAt = isoNow();
    all.push(obj);
    write(coll, all);
    return obj;
  }
  function mutUpdate(coll, id, patch) {
    const all = read(coll, []);
    const idx = all.findIndex((x) => x.id === Number(id));
    if (idx === -1) return null;
    all[idx] = Object.assign(all[idx], patch, { id: Number(id), updatedAt: isoNow() });
    write(coll, all);
    return all[idx];
  }
  function mutDelete(coll, id) {
    const all = read(coll, []);
    const idx = all.findIndex((x) => x.id === Number(id));
    if (idx === -1) return false;
    all[idx].isDeleted = true;
    write(coll, all);
    return true;
  }

  // ---- ラベル（テンプレ/SQLの数値→日本語） ----
  const ROLE = { 1: "管理者", 2: "一般" };
  const ORDER_STATUS = { 0: "キャンセル", 1: "新規受付", 2: "取り寄せ中", 3: "到着", 4: "受渡完了" };
  const EDITION_TYPE = { 1: "初版", 2: "重版", 3: "雑誌" };
  const POP_STATUS = { 0: "非公開", 1: "公開" };
  const CONTRIBUTOR = { 1: "店舗おすすめ", 2: "お客様投稿" };
  const CONTRACT_TYPE = { 1: "委託", 2: "買切" };

  const TeamI = {
    init, reset,
    label: { ROLE, ORDER_STATUS, EDITION_TYPE, POP_STATUS, CONTRIBUTOR, CONTRACT_TYPE },

    // ---- 参照 ----
    categories: () => read("categories", []),
    stores: () => read("stores", []),
    staffAll: () => read("staff", []),
    books: () => read("books", []),
    stocks: () => read("stocks", []).filter((s) => !s.isDeleted),
    pops: () => read("pops", []).filter((p) => !p.isDeleted),
    comments: () => read("comments", []).filter((c) => !c.isDeleted),
    orders: () => read("orders", []).filter((o) => !o.isDeleted),

    store: (id) => TeamI.stores().find((s) => s.id === Number(id)) || null,
    book: (id) => TeamI.books().find((b) => b.id === Number(id)) || null,
    categoryName: (id) => {
      const c = TeamI.categories().find((c) => c.id === Number(id));
      return c ? c.category : "";
    },
    storeName: (id) => {
      const s = TeamI.store(id);
      return s ? s.storeName : "";
    },

    // ある書籍の在庫がある店舗一覧
    bookStocks: (bookId) =>
      TeamI.stocks().filter((s) => s.bookId === Number(bookId)),

    // POP
    popsByContributor: (type) =>
      TeamI.pops()
        .filter((p) => p.status === 1 && p.contributorType === Number(type))
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    pop: (id) => TeamI.pops().find((p) => p.id === Number(id)) || null,

    // コメント
    commentsByPop: (popId) =>
      TeamI.comments()
        .filter((c) => c.popId === Number(popId))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    addComment: (popId, userName, content) => {
      const all = read("comments", []);
      const rec = {
        id: nextId(all), popId: Number(popId),
        userName: userName || null, content,
        createdAt: isoNow(), isDeleted: false,
      };
      all.push(rec);
      write("comments", all);
      return rec;
    },
    deleteComment: (id) => mutDelete("comments", id),

    // ---- 汎用 追加/更新/削除（論理削除）----
    // 在庫
    findStockByIsbnStore: (isbn, storeId) => {
      const b = TeamI.books().find((x) => x.isbn === String(isbn));
      if (!b) return null;
      return TeamI.stocks().find((s) => s.bookId === b.id && s.storeId === Number(storeId)) || null;
    },
    addStock: (obj) => mutAdd("stocks", obj),
    updateStock: (id, patch) => mutUpdate("stocks", id, patch),
    deleteStock: (id) => mutDelete("stocks", id),
    // 取り寄せ予約
    addOrder: (obj) => mutAdd("orders", obj),
    updateOrder: (id, patch) => mutUpdate("orders", id, patch),
    cancelOrder: (id) => mutUpdate("orders", id, { status: 0 }),
    // POP
    addPop: (obj) => mutAdd("pops", obj),
    updatePop: (id, patch) => mutUpdate("pops", id, patch),
    deletePop: (id) => mutDelete("pops", id),
    // 店員
    addStaff: (obj) => mutAdd("staff", obj),
    updateStaff: (id, patch) => mutUpdate("staff", id, patch),
    deleteStaff: (id) => mutDelete("staff", id),

    // ---- 入力→確認の下書き受け渡し（sessionStorage）----
    setDraft: (key, obj) => global.sessionStorage.setItem(NS + "draft:" + key, JSON.stringify(obj)),
    getDraft: (key) => {
      try { const r = global.sessionStorage.getItem(NS + "draft:" + key); return r ? JSON.parse(r) : null; }
      catch (e) { return null; }
    },
    clearDraft: (key) => global.sessionStorage.removeItem(NS + "draft:" + key),

    // 取り寄せ予約
    ordersByShipping: (storeId) =>
      TeamI.orders().filter((o) => o.shippingStoreId === Number(storeId)),
    ordersByPickup: (storeId) =>
      TeamI.orders().filter((o) => o.pickupStoreId === Number(storeId)),
    order: (id) => TeamI.orders().find((o) => o.id === Number(id)) || null,

    // ---- ダッシュボード ----
    // 入荷タイミング通知：自店の在庫数が発注閾値以下
    restockAlerts: (storeId) =>
      TeamI.stocks()
        .filter((s) => s.storeId === Number(storeId) && s.stockCount <= s.alertThreshold)
        .map((s) => {
          const b = TeamI.book(s.bookId) || {};
          return {
            isbn: b.isbn, title: b.title, author: b.author, publisher: b.publisher,
            genre: TeamI.categoryName(b.genreId), shelfLocation: s.shelfLocation,
            stockCount: s.stockCount, alertThreshold: s.alertThreshold,
          };
        }),
    // 他店取り寄せ依頼：自店が発送元で、新規受付（status=1）のもの
    incomingOrders: (storeId) =>
      TeamI.orders()
        .filter((o) => o.shippingStoreId === Number(storeId) && o.status === 1)
        .map((o) => {
          const b = TeamI.book(o.bookId) || {};
          return {
            isbn: b.isbn, title: b.title, author: b.author, publisher: b.publisher,
            editionTypeName: EDITION_TYPE[b.editionType] || "",
            pickupStoreName: TeamI.storeName(o.pickupStoreId),
            orderAcceptedDatetime: TeamI.fmtDateTime(o.reservedAt),
            statusName: "要求中",
          };
        }),

    // ---- 擬似セッション ----
    login: (staffNumber, password) => {
      const st = TeamI.staffAll().find(
        (s) => s.staffNumber === String(staffNumber) && s.password === password && !s.isDeleted
      );
      if (!st) return null;
      const store = TeamI.store(st.storeId);
      const sess = { staff: st, store: store };
      write("session", sess);
      return sess;
    },
    session: () => read("session", null),
    logout: () => global.localStorage.removeItem(NS + "session"),
    requireLogin: () => {
      const s = TeamI.session();
      if (!s) { global.location.href = "./login.html"; return null; }
      return s;
    },

    // ---- 表示ヘルパ ----
    esc: (s) =>
      String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    fmtDateTime: (v) => (v ? String(v).replace("T", " ").slice(0, 16).replace(/-/g, "/") : ""),
    fmtDate: (v) => (v ? String(v).slice(0, 10).replace(/-/g, "/") : ""),
  };

  function isoNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  global.TeamI = TeamI;
})(window);
