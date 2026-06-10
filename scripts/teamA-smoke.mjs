/*
 * teamA「つばさ配送サービス」静的モック スモークテスト（Playwright）
 *   node scripts/static-serve.mjs public 3018 & SV=$!; PORT=3018 node scripts/teamA-smoke.mjs; kill $SV
 */
import { chromium } from "playwright";

const PORT = process.env.PORT || 3018;
const BASE = `http://localhost:${PORT}/team-apps/teamA`;
let pass = 0, fail = 0; const fails = [];
function ok(c, m) { if (c) { pass++; console.log("  ✓ " + m); } else { fail++; fails.push(m); console.log("  ✗ " + m); } }

const browser = await chromium.launch();
const page = await browser.newPage();
let errs = [];
page.on("pageerror", (e) => errs.push(String(e.message)));
page.on("console", (m) => { if (m.type() === "error") errs.push("console:" + m.text()); });

async function goto(p) { errs = []; await page.goto(BASE + "/" + p, { waitUntil: "networkidle" }); await page.waitForTimeout(250); }
function noErr(label) { ok(errs.length === 0, `${label} エラーなし` + (errs.length ? ` → ${errs.slice(0, 2).join(" | ")}` : "")); }
async function loginAs(role, id, pw) {
  await goto("login.html");
  await page.evaluate(async ([r, i, p]) => { await TeamA.init(); TeamA.login(r, i, p); }, [role, id, pw]);
}
async function sweep(pages) {
  for (const [p, label] of pages) {
    await goto(p);
    noErr(label);
    const onLogin = page.url().endsWith("login.html");
    ok(!onLogin, `${label}: ガード通過(login.htmlに飛ばない)`);
  }
}

try {
  // ===== 1. ログイン画面 & 各ロールログイン =====
  console.log("\n[1] ログイン");
  await goto("login.html");
  noErr("login");
  ok((await page.locator("#loginHeader").textContent()) === "お客様ログイン", "login: 初期は顧客ログイン");
  // 役割切替
  await page.click('[data-switch="staff"]');
  ok((await page.locator("#loginHeader").textContent()) === "社員ログイン", "login: 社員へ切替");
  // 顧客ログイン
  await page.click('[data-switch="customer"]');
  await page.fill("#phone", "09011112222"); await page.fill("#customer-password", "password123");
  await Promise.all([page.waitForNavigation(), page.click('[data-role="customer"]')]);
  ok(page.url().endsWith("customer-item-list.html"), "顧客ログイン→商品一覧へ");

  // ===== 2. 顧客画面スイープ =====
  console.log("\n[2] 顧客画面");
  await sweep([
    ["customer-item-list.html", "商品一覧"],
    ["customer-item-cart.html", "カート"],
    ["customer-item-buy.html", "購入手続き"],
    ["customer-mypage.html", "マイページ"],
    ["customer-request.html", "要望設定"],
    ["customer-detail.html", "会員情報"],
    ["customer-order-detail.html?orderNo=OD-2026-0001", "注文詳細"],
  ]);
  ok((await page.locator("#appHeader .customerSiteHeader").count()) > 0, "顧客ヘッダー描画");
  // 商品一覧のカード
  await goto("customer-item-list.html");
  ok((await page.locator(".itemCard").count()) === 4, "商品一覧: 4商品(active)");
  // カート操作フロー
  const cartFlow = await page.evaluate(() => {
    const cid = TeamA.session().userId;
    TeamA.clearCart(cid);
    TeamA.addToCart(cid, 1, 2);
    TeamA.addToCart(cid, 3, 1);
    const items = TeamA.cartItems(cid);
    return { count: items.length, qty1: items.find(i => i.productId === 1).quantity };
  });
  ok(cartFlow.count === 2 && cartFlow.qty1 === 2, "カート: 追加で2種・数量反映");
  // 購入フロー（createOrder）
  const buyFlow = await page.evaluate(() => {
    const cid = TeamA.session().userId;
    const before = TeamA.ordersByCustomer(cid).length;
    const o = TeamA.createOrder({ customerId: cid, items: TeamA.cartItems(cid).map(i => ({ productId: i.productId, quantity: i.quantity })), orderRoute: "web", orderType: "one_time", deliveryDate: "2026-06-20", paymentMethod: "credit" });
    TeamA.clearCart(cid);
    return { before, after: TeamA.ordersByCustomer(cid).length, orderNo: o.orderNo, cartEmpty: TeamA.cartItems(cid).length };
  });
  ok(buyFlow.after === buyFlow.before + 1 && buyFlow.cartEmpty === 0, `購入: 注文作成(${buyFlow.orderNo})＆カート空`);

  // ===== 3. 管理者画面スイープ =====
  console.log("\n[3] 管理者(admin)画面");
  await loginAs("staff", "1001", "password123");
  await goto("manager-orders.html");
  ok(!page.url().endsWith("login.html"), "admin: manager-orders 到達");
  ok((await page.locator("#managerFooter .fabBtn").count()) > 0, "管理者フッターFAB表示");
  await sweep([
    ["manager-orders.html", "注文一覧"],
    ["manager-order-detail.html?id=1", "注文詳細(管理)"],
    ["manager-order-detail.html?id=1&mode=view", "注文詳細(view)"],
    ["manager-order-cancel.html?id=2", "注文キャンセル"],
    ["manager-neworder-search.html", "電話注文 顧客検索"],
    ["manager-neworder-regist.html?customerId=1", "電話注文 登録"],
    ["manager-neworder-confirm.html", "電話注文 確認"],
    ["manager-register.html", "顧客登録(管理)"],
    ["manager-drivers.html", "ドライバー一覧"],
    ["manager-driver-regist.html", "ドライバー登録"],
    ["manager-driver-detail.html?driverId=1", "ドライバー詳細"],
    ["manager-driver-delete.html?driverId=1", "ドライバー削除"],
    ["manager-driver-complete.html", "ドライバー完了"],
    ["manager-employees.html", "社員一覧"],
    ["manager-employee-regist.html", "社員登録"],
    ["manager-employee-detail.html?id=1", "社員詳細"],
    ["manager-employee-delete.html?id=1", "社員削除"],
    ["manager-employee-complete.html", "社員完了"],
    ["manager-areas.html", "エリア設定"],
    ["manager-areas-group.html", "配送グループ"],
    ["manager-foods.html", "商品管理"],
    ["manager-food-regist.html", "商品登録"],
    ["manager-food-update.html?productId=1", "商品更新"],
    ["manager-food-delete.html?productId=1", "商品削除"],
    ["manager-foods-stopped.html", "販売停止一覧"],
    ["manager-food-complete.html?mode=register", "商品完了"],
  ]);
  // 一覧の行数
  await goto("manager-orders.html");
  ok((await page.locator("table tbody tr").count()) > 0, "注文一覧: 行表示");
  await goto("manager-drivers.html");
  ok((await page.locator("table tbody tr, .driverCard, [class*=Card]").count()) > 0, "ドライバー一覧: 表示");
  await goto("manager-foods.html");
  ok((await page.locator("table tbody tr, [class*=Card], [class*=card]").count()) > 0, "商品管理: 表示");

  // ===== 4. データ層フロー（管理操作） =====
  console.log("\n[4] 管理操作フロー");
  const mgr = await page.evaluate(() => {
    // 承認
    const o2 = TeamA.ordersList({}).find(o => o.orderStatus === "unapproved");
    let approveOk = false;
    if (o2) { TeamA.approveOrder(o2.orderId); approveOk = TeamA.orderStatusOf(TeamA.orderById(o2.orderId)) === "approved"; }
    // 商品 登録/停止/再開
    const p = TeamA.createProduct({ productName: "スモーク商品", category: "野菜", price: 999 });
    const created = !!TeamA.productById(p.productId);
    TeamA.stopProduct(p.productId);
    const stopped = TeamA.productsStopped().some(x => x.productId === p.productId);
    TeamA.restoreProduct(p.productId);
    const restored = TeamA.productsActive().some(x => x.productId === p.productId);
    // ドライバー登録/削除
    const d = TeamA.createDriver({ driverName: "テスト配送" });
    const dCreated = TeamA.driversActive().some(x => x.driverId === d.driverId);
    TeamA.deleteDriver(d.driverId);
    const dDeleted = !TeamA.driversActive().some(x => x.driverId === d.driverId);
    // 電話注文作成
    const before = TeamA.ordersList({}).length;
    const po = TeamA.createOrder({ customerId: 2, items: [{ productId: 1, quantity: 1 }], orderRoute: "phone", orderType: "one_time", deliveryDate: "2026-06-22" });
    const phoneOrder = TeamA.ordersList({}).length === before + 1 && po.orderRoute === "phone";
    return { approveOk, created, stopped, restored, dCreated, dDeleted, phoneOrder, counts: TeamA.orderCounts() };
  });
  ok(mgr.approveOk, "注文承認: unapproved→approved");
  ok(mgr.created && mgr.stopped && mgr.restored, "商品: 登録→販売停止→再開");
  ok(mgr.dCreated && mgr.dDeleted, "ドライバー: 登録→削除(論理)");
  ok(mgr.phoneOrder, "電話注文: 作成(route=phone)");

  // ===== 5. ドライバー画面 =====
  console.log("\n[5] ドライバー画面");
  await loginAs("driver", "2001", "password123");
  await goto("driver-orders.html");
  noErr("driver-orders");
  ok(!page.url().endsWith("login.html"), "driver: 配送一覧 到達");
  ok((await page.locator("#appHeader .driverHeader, #appHeader .staffSiteHeader").count()) > 0, "ドライバーヘッダー描画");
  const drv = await page.evaluate(() => {
    const did = TeamA.session().userId;
    const list = TeamA.deliveriesForDriver(did);
    const undeliv = list.filter(d => d.deliveryStatus === "undelivered").length;
    const started = TeamA.batchStart(did);
    const target = TeamA.deliveriesForDriver(did).find(d => d.deliveryStatus === "delivering");
    let completed = false;
    if (target) { TeamA.completeDelivery(target.deliveryId, "完了"); completed = TeamA.deliveryView(TeamA.table("deliveries").find(x => x.deliveryId === target.deliveryId)).deliveryStatus === "completed"; }
    return { total: list.length, undeliv, started, completed };
  });
  ok(drv.total > 0, `ドライバー配送: ${drv.total}件`);
  ok(drv.started > 0 && drv.completed, "配送: 一括開始→完了");

  // ===== 6. 権限ガード =====
  console.log("\n[6] 権限ガード");
  await page.evaluate(() => TeamA.logout());
  await goto("manager-orders.html");
  ok(page.url().endsWith("login.html"), "未ログインで manager-orders→login");

} catch (e) {
  fail++; fails.push("FATAL: " + e.message); console.error("FATAL", e);
} finally {
  await browser.close();
}

console.log(`\n==== teamA smoke: ${pass} passed, ${fail} failed ====`);
if (fails.length) { console.log("FAILED:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
