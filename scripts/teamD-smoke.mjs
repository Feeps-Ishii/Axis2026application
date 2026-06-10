/*
 * teamD「まちのこ食卓プロジェクト」静的モック スモークテスト（Playwright）
 *   npm i -D playwright   # 初回のみ
 *   node scripts/static-serve.mjs public 3015 & SV=$!; node scripts/teamD-smoke.mjs; kill $SV
 */
import { chromium } from "playwright";

const PORT = process.env.PORT || 3015;
const BASE = `http://localhost:${PORT}/team-apps/teamD`;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg) {
  if (cond) { pass++; console.log("  ✓ " + msg); }
  else { fail++; fails.push(msg); console.log("  ✗ " + msg); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

let pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e.message)));
page.on("console", (m) => { if (m.type() === "error") pageErrors.push("console:" + m.text()); });

async function goto(path) {
  pageErrors = [];
  await page.goto(BASE + "/" + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(350);
}
function noErr(label) {
  ok(pageErrors.length === 0, `${label} エラーなし` + (pageErrors.length ? ` → ${pageErrors.slice(0, 3).join(" | ")}` : ""));
}
async function loginAs(email) {
  await goto("login.html");
  await page.fill("#I-001", email);
  await page.fill("#I-002", "password");
  await Promise.all([page.waitForNavigation(), page.click("#loginForm button[type=submit]")]);
  await page.waitForTimeout(400);
}

try {
  // ============ 1. 公開ページ（未ログイン） ============
  console.log("\n[1] 公開ページ（未ログイン）");
  await goto("portal.html");
  noErr("portal");
  ok((await page.locator("#food-panel .list-card").count()) > 0, "portal: 食材募集カード表示");
  ok((await page.locator("#volunteer-panel .list-card").count()) > 0, "portal: ボランティア募集カード表示");
  ok((await page.locator("#thanks-panel .thanks-card").count()) > 0, "portal: 感謝メッセージ表示");
  ok((await page.locator("#appHeader a", { hasText: "ログイン" }).count()) > 0, "portal: 未ログインでログインリンク");

  await goto("sns-list.html");
  noErr("sns-list");
  await goto("food-recruit-detail.html?id=1");
  noErr("food-recruit-detail");
  await goto("volunteer-recruit-detail.html?id=1");
  noErr("volunteer-recruit-detail(未ログイン)");

  // ボランティア新規登録フロー
  await goto("volunteer-register.html");
  noErr("volunteer-register");

  // ============ 2. 管理者ログイン ============
  console.log("\n[2] 管理者ログイン & 管理画面スイープ");
  await loginAs("admin@example.com");
  ok(page.url().endsWith("portal.html"), "admin: ログイン後ポータル遷移");
  ok((await page.locator("#appHeader a", { hasText: "管理者ダッシュボード" }).count()) > 0, "admin: ダッシュボードリンク表示");

  const adminPages = [
    ["dashboard.html", "ダッシュボード"],
    ["shokudo-list.html", "食堂一覧"],
    ["shokudo-form.html", "食堂登録"],
    ["user-list.html", "ユーザー名簿"],
    ["user-register.html", "管理者登録"],
    ["user-edit.html?id=2", "ユーザー編集"],
    ["volunteer-list.html", "ボランティア名簿"],
    ["food-recruit-list.html", "食材募集一覧"],
    ["food-recruit-form.html", "食材募集登録"],
    ["food-recruit-edit.html?id=1", "食材募集編集"],
    ["food-donation-list.html", "食材寄付一覧"],
    ["food-donation-edit.html?id=1", "食材寄付編集"],
    ["volunteer-recruit-list.html", "ボランティア募集一覧"],
    ["volunteer-recruit-form.html", "ボランティア募集登録"],
    ["volunteer-recruit-edit.html?id=1", "ボランティア募集編集"],
    ["volunteer-recruit-detail.html?id=1", "ボランティア募集詳細(admin)"],
    ["volunteer-entry-list.html", "参加者一覧"],
    ["volunteer-entry-edit.html?id=1", "参加編集"],
    ["message-form.html", "感謝メッセージ作成"],
    ["mypage-edit.html?volunteerId=1", "管理者ボラ編集"],
  ];
  for (const [p, label] of adminPages) {
    await goto(p);
    noErr(label);
    ok((await page.locator(".main-container, .header").count()) > 0, `${label}: 描画`);
  }
  // 一覧の行数確認
  await goto("user-list.html");
  ok((await page.locator(".data-table tbody tr").count()) > 1, "ユーザー名簿: 行表示");
  await goto("volunteer-list.html");
  ok((await page.locator(".data-table tbody tr").count()) > 1, "ボランティア名簿: 行表示");
  await goto("food-donation-list.html");
  ok((await page.locator(".data-table tbody tr").count()) > 1, "食材寄付一覧: 行表示");
  await goto("volunteer-recruit-list.html");
  ok((await page.locator(".data-table tbody tr, .card").count()) > 1, "ボランティア募集一覧: 行表示");

  // ============ 3. 食堂CRUDフロー ============
  console.log("\n[3] 食堂 登録→確認→完了フロー");
  const beforeShokudo = await page.evaluate(() => { return TeamD.shokudosActive().length; });
  await goto("shokudo-form.html");
  await page.fill("#I-001", "スモーク食堂");
  await page.fill("#I-002", "テスト用の紹介文です。");
  await page.fill("#I-003", "8100099");
  await page.fill("#I-004", "福岡県福岡市中央区テスト1-2-3");
  await page.fill("#I-005", "09099998888");
  await page.fill("#I-007", "https://example.com/smoke");
  await page.fill("#I-008", "https://instagram.com/smoke");
  await Promise.all([page.waitForNavigation(), page.click('.button-area button[type="submit"], .button-area .primary-button')]);
  await page.waitForTimeout(300);
  noErr("shokudo-confirm");
  ok(/shokudo-confirm/.test(page.url()), "食堂: 確認画面遷移");
  await Promise.all([page.waitForNavigation(), page.click("button.primary-button")]);
  await page.waitForTimeout(300);
  ok(/complete/.test(page.url()), "食堂: 完了画面遷移");
  const afterShokudo = await page.evaluate(() => TeamD.shokudosActive().length);
  ok(afterShokudo === beforeShokudo + 1, `食堂: 登録で件数 +1 (${beforeShokudo}→${afterShokudo})`);

  // ============ 4. データ層ロジック ============
  console.log("\n[4] データ層ロジック検証");
  const stats = await page.evaluate(() => ({
    users: TeamD.usersActive().length,
    vols: TeamD.searchVolunteers().length,
    foodRecruits: TeamD.foodRecruitsActive().length,
    donations: TeamD.donationList("donorName", "").length,
    recruits: TeamD.recruitsActiveAll().length,
    portalFood: TeamD.portalFoodRecruits().length,
    portalVol: TeamD.portalVolunteerRecruits().length,
    portalThanks: TeamD.portalThanks().length,
    badgeFor7: (TeamD.currentBadge(7) || {}).badgeName,
    badgeFor25: (TeamD.currentBadge(25) || {}).badgeName,
    foodName1: TeamD.foodNameMap()[1],
  }));
  console.log("    stats:", JSON.stringify(stats));
  ok(stats.users >= 406, "ユーザー406件以上");
  ok(stats.vols === 400, "ボランティア400件");
  ok(stats.foodRecruits > 0, "食材募集あり");
  ok(stats.donations === 80, "食材寄付80件");
  ok(stats.recruits === 80, "ボランティア募集80件");
  ok(stats.portalThanks >= 5, "ポータル感謝メッセージ(ALL)あり");
  ok(stats.badgeFor7 === "ブロンズ", "バッジ: stamp7→ブロンズ");
  ok(stats.badgeFor25 === "ゴールド", "バッジ: stamp25→ゴールド");
  ok(!!stats.foodName1, "食材名マップ解決");

  // 寄付の受取トグル
  const recvToggle = await page.evaluate(() => {
    const before = TeamD.donationById(1).status;
    TeamD.markReceived(1);
    const recv = TeamD.donationById(1).status;
    TeamD.markUnreceived(1);
    const back = TeamD.donationById(1).status;
    return { before, recv, back };
  });
  ok(recvToggle.recv === 2 && recvToggle.back === 1, "寄付: 受取済み⇄未受取トグル");

  // 感謝メッセージ ALL 投稿 → ポータル反映
  const thanksFlow = await page.evaluate(() => {
    const before = TeamD.portalThanks().length;
    TeamD.createThanks({ shokudoId: 1, targetType: "ALL", message: "スモークテスト感謝です。" });
    return { before, after: TeamD.portalThanks().length };
  });
  ok(thanksFlow.after === thanksFlow.before + 1, "感謝(ALL): ポータル感謝が+1");

  // ============ 5. ボランティアログイン ============
  console.log("\n[5] ボランティアログイン & マイページ/参加");
  await ctx.clearCookies();
  await page.evaluate(() => { try { TeamD.reset(); } catch (e) {} });
  await loginAs("volunteer1@example.com");
  ok(page.url().endsWith("portal.html"), "volunteer: ログイン後ポータル");

  await goto("mypage.html");
  noErr("mypage(volunteer)");
  ok((await page.locator(".main-container").count()) > 0, "mypage: 描画");

  await goto("mypage-edit.html");
  noErr("mypage-edit(本人)");

  // 参加申込フロー（未申込の募集を探す）
  const targetRecruit = await page.evaluate(() => {
    const u = TeamD.currentUser();
    const all = TeamD.recruitsActiveAll();
    for (const r of all) {
      if (r.status === 0 && r.currentCount < r.capacity && !TeamD.isAlreadyApplied(r.recruitId, u.userId)) return r.recruitId;
    }
    return null;
  });
  ok(targetRecruit != null, "参加: 申込可能な募集が存在");
  if (targetRecruit != null) {
    await goto(`volunteer-recruit-detail.html?id=${targetRecruit}`);
    noErr("volunteer-recruit-detail(volunteer)");
    const applyFlow = await page.evaluate((rid) => {
      const u = TeamD.currentUser();
      const before = TeamD.recruitById(rid).currentCount;
      TeamD.createEntry({ name: u.name, healthCondition: "良好", remarks: "スモーク", attendedFlag: false }, rid, u.userId);
      return { before, after: TeamD.recruitById(rid).currentCount, applied: TeamD.isAlreadyApplied(rid, u.userId) };
    }, targetRecruit);
    ok(applyFlow.after === applyFlow.before + 1 && applyFlow.applied, "参加: 申込で人数+1 & 申込済み");
  }

  // 参加→管理者がattended→スタンプ加算→バッジ
  const stampFlow = await page.evaluate(() => {
    const e = TeamD.entrySearch("", "", "").find((x) => !x.attendedFlag);
    if (!e) return null;
    const p = TeamD.volunteerProfileByUserId(e.volunteerId);
    const before = p ? p.stamp : 0;
    TeamD.updateAttendedFlag(e.entryId, true);
    const p2 = TeamD.volunteerProfileByUserId(e.volunteerId);
    return { before, after: p2 ? p2.stamp : 0 };
  });
  ok(stampFlow && stampFlow.after === stampFlow.before + 1, "スタンプ: 参加済み化で+1");

  // ============ 6. 通知（ボランティアは通知あり） ============
  console.log("\n[6] 通知");
  await goto("portal.html");
  const notif = await page.evaluate(() => {
    const u = TeamD.currentUser();
    return { count: TeamD.countUnread(u.userId), top5: TeamD.unreadTop5(u.userId).length };
  });
  ok(notif.count >= 0, `通知: 未読数取得 (${notif.count})`);

} catch (e) {
  fail++;
  fails.push("FATAL: " + e.message);
  console.error("FATAL", e);
} finally {
  await browser.close();
}

console.log(`\n==== teamD smoke: ${pass} passed, ${fail} failed ====`);
if (fails.length) { console.log("FAILED:"); fails.forEach((f) => console.log("  - " + f)); process.exit(1); }
