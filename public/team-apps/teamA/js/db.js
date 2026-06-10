/*
 * teamA「つばさ配送サービス」(tsubasa-delivery-app / sky_db) — 擬似データ層
 * --------------------------------------------------------------------------
 * 元は Next.js(フロント) + Spring Boot(`http://localhost:8080/sky/api/...`) 構成。
 * Vercel では Java/DB が動かないため、seed.json を localStorage に取り込み、
 * 各画面から window.TeamA 経由で参照・更新する静的モックに作り直す。
 *
 *   <script src="./js/db.js"></script>
 *   <script> TeamA.init().then(() => { ... }); </script>
 *
 * 権限(ログイン種別): customer(顧客) / staff(社員: admin|staff) / driver(ドライバー)
 * 名前空間 localStorage キー "teamA:" プレフィックス。デモ固定日 2026-06-08。
 */
(function (global) {
  "use strict";

  const NS = "teamA:";
  const SEED_FLAG = NS + "seeded";
  const SEED_VERSION = "v1";
  const VERSION_KEY = NS + "seedVersion";
  const SESSION_KEY = NS + "session";
  const TODAY = "2026-06-08";

  const COLLECTIONS = [
    "customers", "employees", "drivers", "products", "allergens",
    "customerAllergens", "productAllergens", "customerDislikedProducts",
    "customerDeliveryPreferences", "deliveryAreas", "deliveryGroups",
    "deliveryGroupAreas", "carts", "cartItems", "orders", "orderItems",
    "payments", "deliveries", "subscriptions", "subscriptionItems",
    "farmers", "farmerProducts", "messageLogs",
  ];

  function read(key, fallback) {
    try {
      const raw = global.localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    global.localStorage.setItem(NS + key, JSON.stringify(value));
    return value;
  }

  async function init(force) {
    const versionOk = global.localStorage.getItem(VERSION_KEY) === SEED_VERSION;
    if (!force && global.localStorage.getItem(SEED_FLAG) && versionOk) return;
    const res = await fetch("./data/seed.json", { cache: "no-store" });
    const seed = await res.json();
    COLLECTIONS.forEach((c) => write(c, seed[c] || []));
    global.localStorage.setItem(SEED_FLAG, "1");
    global.localStorage.setItem(VERSION_KEY, SEED_VERSION);
  }
  function reset() {
    Object.keys(global.localStorage)
      .filter((k) => k.indexOf(NS) === 0)
      .forEach((k) => global.localStorage.removeItem(k));
  }

  // ---- 低レベルアクセス（画面側で自由に集計できるよう公開） ----
  const table = (c) => read(c, []);
  const saveTable = (c, arr) => write(c, arr);
  const nextId = (c, key) => table(c).reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0) + 1;
  const now = () => `${TODAY} 09:00:00`;
  const today = () => TODAY;
  const img = (p) => (p ? String(p).replace(/^\//, "./") : "./images/no_image.png");
  const contains = (h, n) => !n || String(h == null ? "" : h).toLowerCase().indexOf(String(n).toLowerCase()) !== -1;

  // ---- 入力→確認→完了フロー用の下書き(sessionStorage) ----
  const setDraft = (k, o) => global.sessionStorage.setItem(NS + "draft:" + k, JSON.stringify(o));
  const getDraft = (k) => { try { const r = global.sessionStorage.getItem(NS + "draft:" + k); return r ? JSON.parse(r) : null; } catch (e) { return null; } };
  const clearDraft = (k) => global.sessionStorage.removeItem(NS + "draft:" + k);

  // =================================================================
  // セッション / ログイン
  // =================================================================
  // role: customer(電話番号) / staff(社員コード) / driver(ドライバーコード)
  function login(role, loginId, password) {
    if (role === "customer") {
      const c = table("customers").find((x) => x.phone === loginId && x.passwordHash === password && x.activeFlag);
      if (!c) return { ok: false, message: "電話番号またはパスワードが違います。" };
      setSession({ loggedIn: true, role: "customer", userId: c.customerId, userName: c.customerName });
      return { ok: true, role: "customer", redirectUrl: "./customer-item-list.html" };
    }
    if (role === "staff") {
      const e = table("employees").find((x) => x.employeeCode === loginId && x.passwordHash === password && x.activeFlag);
      if (!e) return { ok: false, message: "社員コードまたはパスワードが違います。" };
      setSession({ loggedIn: true, role: e.role, userId: e.employeeId, userName: e.employeeName });
      return { ok: true, role: e.role, redirectUrl: "./manager-orders.html" };
    }
    if (role === "driver") {
      const d = table("drivers").find((x) => x.driverCode === loginId && x.passwordHash === password && x.activeFlag);
      if (!d) return { ok: false, message: "ドライバーコードまたはパスワードが違います。" };
      setSession({ loggedIn: true, role: "driver", userId: d.driverId, userName: d.driverName });
      return { ok: true, role: "driver", redirectUrl: "./driver-orders.html" };
    }
    return { ok: false, message: "ログイン種別が不正です。" };
  }
  function setSession(s) { write("session", s); }
  function session() {
    return read("session", { loggedIn: false, role: null, userId: null, userName: null });
  }
  function logout() { global.localStorage.removeItem(SESSION_KEY); }
  // ガード: 許可ロール配列。未ログイン/権限外は login へ
  function requireRole(roles, returnFile) {
    const s = session();
    if (!s.loggedIn) { location.href = "./login.html"; return false; }
    if (roles && roles.indexOf(s.role) === -1) { location.href = "./login.html"; return false; }
    return true;
  }

  // =================================================================
  // 商品
  // =================================================================
  const productsActive = () => table("products").filter((p) => p.activeFlag);
  const productsStopped = () => table("products").filter((p) => !p.activeFlag);
  const allProducts = () => table("products");
  const productById = (id) => table("products").find((p) => p.productId === Number(id)) || null;
  function createProduct(o) {
    const list = table("products");
    const rec = { productId: nextId("products", "productId"), productName: o.productName, category: o.category, price: Number(o.price), imagePath: o.imagePath || "/images/no_image.png", description: o.description || "", activeFlag: true };
    list.push(rec); saveTable("products", list); return rec;
  }
  function updateProduct(id, o) {
    const list = table("products"); const i = list.findIndex((p) => p.productId === Number(id));
    if (i < 0) return null;
    list[i] = { ...list[i], ...o, productId: Number(id), price: o.price != null ? Number(o.price) : list[i].price };
    saveTable("products", list); return list[i];
  }
  const stopProduct = (id) => setProductActive(id, false);   // 販売停止
  const restoreProduct = (id) => setProductActive(id, true); // 販売再開
  function setProductActive(id, flag) {
    const list = table("products"); const i = list.findIndex((p) => p.productId === Number(id));
    if (i >= 0) { list[i].activeFlag = flag; saveTable("products", list); }
  }
  function deleteProduct(id) { setProductActive(id, false); }

  // アレルゲン
  const allergens = () => table("allergens").filter((a) => a.activeFlag);
  const allergenName = (id) => (table("allergens").find((a) => a.allergenId === Number(id)) || {}).allergenName || "";
  const productAllergenNames = (productId) =>
    table("productAllergens").filter((pa) => pa.productId === Number(productId)).map((pa) => allergenName(pa.allergenId));
  const customerAllergenNames = (customerId) =>
    table("customerAllergens").filter((ca) => ca.customerId === Number(customerId)).map((ca) => allergenName(ca.allergenId));
  const customerDislikedNames = (customerId) =>
    table("customerDislikedProducts").filter((d) => d.customerId === Number(customerId)).map((d) => (productById(d.productId) || {}).productName || "");

  // =================================================================
  // 顧客
  // =================================================================
  const customersActive = () => table("customers").filter((c) => c.activeFlag);
  const customerById = (id) => table("customers").find((c) => c.customerId === Number(id)) || null;
  const customerByPhone = (phone) => table("customers").find((c) => c.phone === phone) || null;
  function searchCustomers(keyword) {
    const k = (keyword || "").trim();
    if (!k) return customersActive();
    return customersActive().filter((c) => contains(c.customerName, k) || contains(c.phone, k) || contains(c.customerCode, k) || contains(c.address, k));
  }
  function createCustomer(o) {
    const list = table("customers");
    const id = nextId("customers", "customerId");
    const rec = {
      customerId: id, customerCode: "C" + String(id).padStart(4, "0"),
      customerName: o.customerName, phone: o.phone, passwordHash: o.passwordHash || o.password || "password123",
      postalCode: o.postalCode || "", address: o.address || "", birthDate: o.birthDate || null,
      defaultLeaveAtDoorFlag: !!o.defaultLeaveAtDoorFlag, defaultFrozenFlag: !!o.defaultFrozenFlag,
      defaultDeliveryInstruction: o.defaultDeliveryInstruction || null,
      defaultPaymentMethod: o.defaultPaymentMethod || "credit",
      creditCardValidFlag: !!o.creditCardValidFlag, cardLast4: o.cardLast4 || null, activeFlag: true,
    };
    list.push(rec); saveTable("customers", list); return rec;
  }
  function updateCustomer(id, o) {
    const list = table("customers"); const i = list.findIndex((c) => c.customerId === Number(id));
    if (i < 0) return null; list[i] = { ...list[i], ...o, customerId: Number(id) };
    saveTable("customers", list); return list[i];
  }
  // 顧客配送要望
  const customerPreference = (customerId) => table("customerDeliveryPreferences").find((p) => p.customerId === Number(customerId)) || null;
  function saveCustomerPreference(customerId, o) {
    const list = table("customerDeliveryPreferences"); const i = list.findIndex((p) => p.customerId === Number(customerId));
    if (i >= 0) { list[i] = { ...list[i], ...o }; } else {
      list.push({ preferenceId: nextId("customerDeliveryPreferences", "preferenceId"), customerId: Number(customerId), leaveAtDoorFlag: !!o.leaveAtDoorFlag, frozenFlag: !!o.frozenFlag, preferenceNote: o.preferenceNote || "" });
    }
    saveTable("customerDeliveryPreferences", list);
  }
  // 顧客アレルギー/苦手を置き換え
  function setCustomerAllergens(customerId, allergenIds) {
    let list = table("customerAllergens").filter((ca) => ca.customerId !== Number(customerId));
    (allergenIds || []).forEach((aid) => list.push({ customerAllergenId: list.reduce((m, r) => Math.max(m, r.customerAllergenId), 0) + 1, customerId: Number(customerId), allergenId: Number(aid) }));
    saveTable("customerAllergens", list);
  }
  function setCustomerDisliked(customerId, productIds) {
    let list = table("customerDislikedProducts").filter((d) => d.customerId !== Number(customerId));
    (productIds || []).forEach((pid) => list.push({ customerDislikedProductId: list.reduce((m, r) => Math.max(m, r.customerDislikedProductId), 0) + 1, customerId: Number(customerId), productId: Number(pid) }));
    saveTable("customerDislikedProducts", list);
  }

  // =================================================================
  // 社員 / ドライバー
  // =================================================================
  const employeesActive = () => table("employees").filter((e) => e.activeFlag);
  const employeeById = (id) => table("employees").find((e) => e.employeeId === Number(id)) || null;
  function createEmployee(o) {
    const list = table("employees"); const id = nextId("employees", "employeeId");
    const rec = { employeeId: id, employeeCode: o.employeeCode || String(1000 + id), employeeName: o.employeeName, phone: o.phone || "", birthDate: o.birthDate || null, passwordHash: o.passwordHash || o.password || "password123", role: o.role || "staff", activeFlag: true };
    list.push(rec); saveTable("employees", list); return rec;
  }
  function updateEmployee(id, o) {
    const list = table("employees"); const i = list.findIndex((e) => e.employeeId === Number(id));
    if (i < 0) return null; list[i] = { ...list[i], ...o, employeeId: Number(id) }; saveTable("employees", list); return list[i];
  }
  function deleteEmployee(id) {
    const list = table("employees"); const i = list.findIndex((e) => e.employeeId === Number(id));
    if (i >= 0) { list[i].activeFlag = false; saveTable("employees", list); }
  }

  const driversActive = () => table("drivers").filter((d) => d.activeFlag);
  const allDrivers = () => table("drivers");
  const driverById = (id) => table("drivers").find((d) => d.driverId === Number(id)) || null;
  function createDriver(o) {
    const list = table("drivers"); const id = nextId("drivers", "driverId");
    const rec = { driverId: id, driverCode: o.driverCode || String(2000 + id), driverName: o.driverName, phone: o.phone || "", vehicleNo: o.vehicleNo || "", vehicleInfo: o.vehicleInfo || "", refrigeratedFlag: !!o.refrigeratedFlag, passwordHash: o.passwordHash || o.password || "password123", activeFlag: true };
    list.push(rec); saveTable("drivers", list); return rec;
  }
  function updateDriver(id, o) {
    const list = table("drivers"); const i = list.findIndex((d) => d.driverId === Number(id));
    if (i < 0) return null; list[i] = { ...list[i], ...o, driverId: Number(id) }; saveTable("drivers", list); return list[i];
  }
  function deleteDriver(id) {
    const list = table("drivers"); const i = list.findIndex((d) => d.driverId === Number(id));
    if (i >= 0) { list[i].activeFlag = false; saveTable("drivers", list); }
  }
  // ドライバーが担当する配送グループ名
  const driverDeliveryGroups = (driverId) =>
    table("deliveryGroups").filter((g) => g.driverId === Number(driverId) && g.activeFlag);

  // =================================================================
  // 配送エリア / 配送グループ
  // =================================================================
  const deliveryAreasActive = () => table("deliveryAreas").filter((a) => a.activeFlag);
  const allDeliveryAreas = () => table("deliveryAreas");
  const deliveryAreaById = (id) => table("deliveryAreas").find((a) => a.areaId === Number(id)) || null;
  function createArea(o) {
    const list = table("deliveryAreas");
    const rec = { areaId: nextId("deliveryAreas", "areaId"), areaCode: o.areaCode, postalCodePattern: o.postalCodePattern || "", postalPrefix5: o.postalPrefix5 || "", activeFlag: o.activeFlag != null ? !!o.activeFlag : true };
    list.push(rec); saveTable("deliveryAreas", list); return rec;
  }
  function updateArea(id, o) {
    const list = table("deliveryAreas"); const i = list.findIndex((a) => a.areaId === Number(id));
    if (i < 0) return null; list[i] = { ...list[i], ...o, areaId: Number(id) }; saveTable("deliveryAreas", list); return list[i];
  }
  function deleteArea(id) {
    const list = table("deliveryAreas"); const i = list.findIndex((a) => a.areaId === Number(id));
    if (i >= 0) { list[i].activeFlag = false; saveTable("deliveryAreas", list); }
  }
  const deliveryGroupsActive = () => table("deliveryGroups").filter((g) => g.activeFlag);
  const allDeliveryGroups = () => table("deliveryGroups");
  const deliveryGroupById = (id) => table("deliveryGroups").find((g) => g.deliveryGroupId === Number(id)) || null;
  // グループに紐づくエリア
  const groupAreas = (groupId) =>
    table("deliveryGroupAreas").filter((ga) => ga.deliveryGroupId === Number(groupId)).map((ga) => deliveryAreaById(ga.areaId)).filter(Boolean);
  // 郵便番号からエリアを判定（先頭5桁一致）。無ければ null
  function areaForPostal(postalCode) {
    const p5 = String(postalCode || "").replace(/[^0-9]/g, "").slice(0, 5);
    return table("deliveryAreas").find((a) => a.activeFlag && a.postalPrefix5 === p5) || null;
  }
  // 郵便番号から配送グループを判定
  function groupForPostal(postalCode) {
    const area = areaForPostal(postalCode);
    if (!area) return null;
    const ga = table("deliveryGroupAreas").find((x) => x.areaId === area.areaId);
    if (!ga) return null;
    return deliveryGroupById(ga.deliveryGroupId);
  }

  // =================================================================
  // カート
  // =================================================================
  function cartByCustomer(customerId) {
    let carts = table("carts");
    let cart = carts.find((c) => c.customerId === Number(customerId));
    if (!cart) { cart = { cartId: nextId("carts", "cartId"), customerId: Number(customerId) }; carts.push(cart); saveTable("carts", carts); }
    return cart;
  }
  function cartItems(customerId) {
    const cart = cartByCustomer(customerId);
    return table("cartItems").filter((ci) => ci.cartId === cart.cartId).map((ci) => ({ ...ci, product: productById(ci.productId) }));
  }
  function addToCart(customerId, productId, quantity) {
    const cart = cartByCustomer(customerId);
    const list = table("cartItems");
    const p = productById(productId);
    const ex = list.find((ci) => ci.cartId === cart.cartId && ci.productId === Number(productId));
    if (ex) { ex.quantity += Number(quantity || 1); }
    else { list.push({ cartItemId: nextId("cartItems", "cartItemId"), cartId: cart.cartId, productId: Number(productId), quantity: Number(quantity || 1), unitPrice: p ? p.price : 0 }); }
    saveTable("cartItems", list);
  }
  function updateCartQty(cartItemId, quantity) {
    const list = table("cartItems"); const i = list.findIndex((ci) => ci.cartItemId === Number(cartItemId));
    if (i >= 0) { list[i].quantity = Number(quantity); saveTable("cartItems", list); }
  }
  function removeCartItem(cartItemId) {
    saveTable("cartItems", table("cartItems").filter((ci) => ci.cartItemId !== Number(cartItemId)));
  }
  function clearCart(customerId) {
    const cart = cartByCustomer(customerId);
    saveTable("cartItems", table("cartItems").filter((ci) => ci.cartId !== cart.cartId));
  }

  // =================================================================
  // 注文
  // =================================================================
  // 表示用ステータス文字列
  function orderStatusOf(o) {
    if (!o) return "unapproved";
    if (o.cancelFlag) return "canceled";
    const d = deliveryByOrder(o.orderId);
    if (d && d.deliveryStatus === "completed") return "completed";
    if (o.approvalStatus === 1) return "approved";
    return "unapproved";
  }
  function paymentStatusLabel(o) {
    const pay = paymentByOrder(o.orderId);
    if (!pay) return "未設定";
    const method = pay.paymentMethod === "credit" ? "クレジット" : pay.paymentMethod === "paypay" ? "PayPay" : pay.paymentMethod === "cod" ? "代引き" : pay.paymentMethod;
    const st = pay.paymentStatus === "paid" ? "支払済" : pay.paymentStatus === "cod_target" ? "代引き（未収）" : "未払い";
    return `${method}／${st}`;
  }
  const paymentByOrder = (orderId) => table("payments").find((p) => p.orderId === Number(orderId)) || null;
  const deliveryByOrder = (orderId) => table("deliveries").find((d) => d.orderId === Number(orderId)) || null;
  const orderById = (orderId) => table("orders").find((o) => o.orderId === Number(orderId)) || null;
  const orderByNo = (orderNo) => table("orders").find((o) => o.orderNo === orderNo) || null;
  function orderItemsOf(orderId) {
    return table("orderItems").filter((oi) => oi.orderId === Number(orderId)).map((oi) => {
      const p = productById(oi.productId);
      return { ...oi, productName: p ? p.productName : "", productCode: p ? String(p.productId) : "", category: p ? p.category : "" };
    });
  }
  // 注文一覧（フィルタ: status, route, keyword, deliveryDate）。view済み（顧客名・配送日・状態等付き）
  function ordersList(filters) {
    const f = filters || {};
    let list = table("orders").slice();
    let views = list.map(orderView);
    if (f.status) views = views.filter((v) => v.orderStatus === f.status);
    if (f.route) views = views.filter((v) => v.orderRoute === f.route);
    if (f.deliveryDate) views = views.filter((v) => v.deliveryDate === f.deliveryDate);
    if (f.keyword) { const k = f.keyword; views = views.filter((v) => contains(v.customerName, k) || contains(v.orderNo, k)); }
    return views.sort((a, b) => (a.orderDatetime < b.orderDatetime ? 1 : -1));
  }
  function orderView(o) {
    if (!o) return null;
    const c = customerById(o.customerId);
    const d = deliveryByOrder(o.orderId);
    const driver = d ? driverById(d.driverId) : null;
    const area = c ? areaForPostal(c.postalCode) : null;
    return {
      ...o,
      orderStatus: orderStatusOf(o),
      customerName: c ? c.customerName : "",
      phone: c ? c.phone : "",
      postalCode: c ? c.postalCode : "",
      address: c ? c.address : "",
      deliveryArea: area ? area.areaCode : "未設定",
      driverName: driver ? driver.driverName : "未割当",
      realDeliveryStatus: d ? d.deliveryStatus : "undelivered",
      paymentStatus: paymentStatusLabel(o),
      orderPlaced: o.orderFlag === 1 ? "済" : "未",
      canceled: !!o.cancelFlag,
      items: orderItemsOf(o.orderId),
      allergies: c ? customerAllergenNames(c.customerId) : [],
      dislikedFoods: c ? customerDislikedNames(c.customerId) : [],
    };
  }
  // 状態別件数（注文一覧の上部カウンタ用）
  function orderCounts() {
    const all = table("orders");
    const c = { total: all.length, unapproved: 0, approved: 0, completed: 0, canceled: 0 };
    all.forEach((o) => { c[orderStatusOf(o)]++; });
    return c;
  }
  // 承認
  function approveOrder(orderId, approvedBy) {
    const list = table("orders"); const i = list.findIndex((o) => o.orderId === Number(orderId));
    if (i < 0) return; list[i].approvalStatus = 1; list[i].approvedBy = approvedBy || (session().userId || null); list[i].approvedAt = now(); saveTable("orders", list);
  }
  // 発注（order-placed）
  function placeOrder(orderId, placed) {
    const list = table("orders"); const i = list.findIndex((o) => o.orderId === Number(orderId));
    if (i < 0) return; list[i].orderFlag = placed ? 1 : 0; saveTable("orders", list);
  }
  // キャンセル
  function cancelOrder(orderId) {
    const list = table("orders"); const i = list.findIndex((o) => o.orderId === Number(orderId));
    if (i < 0) return; list[i].cancelFlag = 1; saveTable("orders", list);
    const dl = table("deliveries"); const di = dl.findIndex((d) => d.orderId === Number(orderId));
    if (di >= 0) { dl[di].deliveryStatus = "failed"; saveTable("deliveries", dl); }
  }
  // 注文の編集（配送日・ドライバー・要望・発注状況）
  function updateOrder(orderId, o) {
    const list = table("orders"); const i = list.findIndex((x) => x.orderId === Number(orderId));
    if (i < 0) return null;
    if (o.deliveryDate != null) list[i].deliveryDate = o.deliveryDate;
    if (o.requestNote != null) list[i].requestNote = o.requestNote;
    if (o.orderFlag != null) list[i].orderFlag = o.orderFlag;
    saveTable("orders", list);
    if (o.driverId != null) {
      const dl = table("deliveries"); const di = dl.findIndex((d) => d.orderId === Number(orderId));
      if (di >= 0) { dl[di].driverId = Number(o.driverId); saveTable("deliveries", dl); }
    }
    return list[i];
  }
  // 注文作成（カート/電話注文）。items=[{productId,quantity}]
  function createOrder(o) {
    const orders = table("orders");
    const id = nextId("orders", "orderId");
    const year = TODAY.slice(0, 4);
    const orderNo = o.orderNo || `OD-${year}-${String(id).padStart(4, "0")}`;
    const cust = customerById(o.customerId);
    const group = cust ? groupForPostal(cust.postalCode) : null;
    const items = (o.items || []).map((it) => {
      const p = productById(it.productId);
      const qty = Number(it.quantity || 1);
      const price = p ? p.price : 0;
      return { productId: Number(it.productId), quantity: qty, unitPrice: price, subtotal: price * qty };
    });
    const total = items.reduce((s, it) => s + it.subtotal, 0);
    const rec = {
      orderId: id, orderNo, customerId: Number(o.customerId), orderRoute: o.orderRoute || "web",
      orderType: o.orderType || "one_time", approvalStatus: 0, orderFlag: 0, cancelFlag: 0,
      orderDatetime: now(), deliveryDate: o.deliveryDate || TODAY,
      deliveryGroupId: group ? group.deliveryGroupId : null,
      deliveryInstruction: o.deliveryInstruction || (cust ? cust.defaultDeliveryInstruction : "") || "",
      requestNote: o.requestNote || "", totalAmount: total, approvedBy: null, approvedAt: null,
      allergyWarningFlag: !!o.allergyWarningFlag,
    };
    orders.push(rec); saveTable("orders", orders);
    const oiList = table("orderItems");
    items.forEach((it) => oiList.push({ orderItemId: nextId("orderItems", "orderItemId"), orderId: id, ...it }));
    saveTable("orderItems", oiList);
    // 支払
    const payList = table("payments");
    const method = o.paymentMethod || (cust ? cust.defaultPaymentMethod : "credit");
    payList.push({ paymentId: nextId("payments", "paymentId"), orderId: id, paymentMethod: method, paymentStatus: method === "cod" ? "cod_target" : "unpaid", amount: total, paidAt: null, updatedBy: null });
    saveTable("payments", payList);
    // 配送
    const delList = table("deliveries");
    delList.push({ deliveryId: nextId("deliveries", "deliveryId"), orderId: id, deliveryGroupId: group ? group.deliveryGroupId : null, driverId: group ? group.driverId : null, scheduledDate: rec.deliveryDate, deliveryStatus: "undelivered", completedAt: null, completionNote: null });
    saveTable("deliveries", delList);
    return rec;
  }
  // 顧客の注文一覧（マイページ）
  function ordersByCustomer(customerId) {
    return table("orders").filter((o) => o.customerId === Number(customerId)).map(orderView).sort((a, b) => (a.orderDatetime < b.orderDatetime ? 1 : -1));
  }

  // =================================================================
  // 配送（ドライバー）
  // =================================================================
  // ドライバーの配送一覧（任意でstatus絞り込み）。view: order/customer/address付き
  function deliveriesForDriver(driverId, status) {
    let list = table("deliveries").filter((d) => d.driverId === Number(driverId));
    if (status) list = list.filter((d) => d.deliveryStatus === status);
    return list.map(deliveryView);
  }
  function deliveriesList(filters) {
    const f = filters || {};
    let list = table("deliveries").slice();
    if (f.driverId) list = list.filter((d) => d.driverId === Number(f.driverId));
    if (f.status) list = list.filter((d) => d.deliveryStatus === f.status);
    if (f.scheduledDate) list = list.filter((d) => d.scheduledDate === f.scheduledDate);
    return list.map(deliveryView);
  }
  function deliveryView(d) {
    if (!d) return null;
    const o = orderById(d.orderId);
    const c = o ? customerById(o.customerId) : null;
    return {
      ...d,
      orderNo: o ? o.orderNo : "",
      customerName: c ? c.customerName : "",
      phone: c ? c.phone : "",
      postalCode: c ? c.postalCode : "",
      address: c ? c.address : "",
      deliveryInstruction: o ? o.deliveryInstruction : "",
      totalAmount: o ? o.totalAmount : 0,
      paymentLabel: o ? paymentStatusLabel(o) : "",
    };
  }
  function completeDelivery(deliveryId, note) {
    const list = table("deliveries"); const i = list.findIndex((d) => d.deliveryId === Number(deliveryId));
    if (i < 0) return; list[i].deliveryStatus = "completed"; list[i].completedAt = now(); if (note != null) list[i].completionNote = note; saveTable("deliveries", list);
  }
  // ドライバーの未配送をまとめて配送中に
  function batchStart(driverId) {
    const list = table("deliveries"); let n = 0;
    list.forEach((d) => { if (d.driverId === Number(driverId) && d.deliveryStatus === "undelivered") { d.deliveryStatus = "delivering"; n++; } });
    saveTable("deliveries", list); return n;
  }

  // =================================================================
  // 定期配送
  // =================================================================
  const subscriptionsByCustomer = (customerId) => table("subscriptions").filter((s) => s.customerId === Number(customerId));
  const subscriptionItems = (subscriptionId) =>
    table("subscriptionItems").filter((si) => si.subscriptionId === Number(subscriptionId)).map((si) => ({ ...si, product: productById(si.productId) }));

  // =================================================================
  // 公開API
  // =================================================================
  global.TeamA = {
    init, reset, now, today, img,
    table, saveTable, nextId, setDraft, getDraft, clearDraft, contains,
    // session
    login, session, logout, requireRole,
    // products
    productsActive, productsStopped, allProducts, productById, createProduct, updateProduct,
    stopProduct, restoreProduct, deleteProduct,
    // allergens
    allergens, allergenName, productAllergenNames, customerAllergenNames, customerDislikedNames,
    // customers
    customersActive, customerById, customerByPhone, searchCustomers, createCustomer, updateCustomer,
    customerPreference, saveCustomerPreference, setCustomerAllergens, setCustomerDisliked,
    // employees
    employeesActive, employeeById, createEmployee, updateEmployee, deleteEmployee,
    // drivers
    driversActive, allDrivers, driverById, createDriver, updateDriver, deleteDriver, driverDeliveryGroups,
    // areas / groups
    deliveryAreasActive, allDeliveryAreas, deliveryAreaById, createArea, updateArea, deleteArea,
    deliveryGroupsActive, allDeliveryGroups, deliveryGroupById, groupAreas, areaForPostal, groupForPostal,
    // cart
    cartByCustomer, cartItems, addToCart, updateCartQty, removeCartItem, clearCart,
    // orders
    orderById, orderByNo, orderItemsOf, ordersList, orderView, orderCounts, orderStatusOf,
    paymentStatusLabel, paymentByOrder, deliveryByOrder, approveOrder, placeOrder, cancelOrder,
    updateOrder, createOrder, ordersByCustomer,
    // deliveries
    deliveriesForDriver, deliveriesList, deliveryView, completeDelivery, batchStart,
    // subscriptions
    subscriptionsByCustomer, subscriptionItems,
  };
})(window);
