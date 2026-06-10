/*
 * teamA 共通UI — Header(顧客/社員/ドライバー) と 管理者フッター(FAB)。
 * 元 components/Header.tsx・ManagerFooter.tsx を静的化。CSS は css/Header.css・
 * css/ManagerFooter.css（CSS Modules をそのままコピー。class名はソースのまま使用）。
 *
 * 使い方:
 *   <link rel="stylesheet" href="./css/Header.css">
 *   <div id="appHeader"></div>
 *   ...
 *   <script src="./js/db.js"></script><script src="./js/ui.js"></script>
 *   <script>TeamA.init().then(()=>{ TeamAUI.renderHeader("staff","注文一覧"); ... });</script>
 */
(function (global) {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // type: "customer" | "staff" | "driver"
  function renderHeader(type, pageName, opts) {
    opts = opts || {};
    const host = document.getElementById("appHeader");
    if (!host) return;
    const s = TeamA.session();
    const userName = s.userName || opts.userName || "ゲスト";
    const showCustomerNav = opts.showCustomerNav !== false;

    if (type === "customer") {
      host.innerHTML = `
        <header class="customerSiteHeader">
          <div class="customerHeaderLogoArea">
            <img src="./images/tsubasa-logo.png" alt="つばさ配送サービス" class="customerSiteLogo">
          </div>
          <div class="customerHeaderTitleArea">
            <h1 class="customerHeaderTitle">${esc(pageName)}</h1>
            <span class="customerHeaderPageName">つばさ配送サービス</span>
          </div>
          ${showCustomerNav ? `
          <nav class="customerHeaderNav">
            <span class="customerHeaderUserName">${esc(userName)} 様</span>
            <a href="./customer-item-cart.html" class="customerHeaderLink customerHeaderCartLink">カート</a>
            <a href="./customer-mypage.html" class="customerHeaderLink customerHeaderMypageLink">マイページ</a>
            <button type="button" class="customerHeaderLogoutBtn" onclick="TeamAUI.logout()">ログアウト</button>
          </nav>` : ``}
        </header>`;
      return;
    }

    // staff / driver
    const driver = type === "driver";
    host.innerHTML = `
      <header class="staffSiteHeader ${driver ? "driverHeader" : "staffHeader"}">
        <div class="staffHeaderLeft">
          <h1 class="staffHeaderTitle">つばさ配送サービス</h1>
          <span class="staffHeaderPageName">${esc(pageName)}</span>
        </div>
        <nav class="staffHeaderNav">
          ${type === "staff" ? `<span class="staffHeaderUserName">社員：${esc(userName)}</span>` : ``}
          ${driver ? `<span class="staffHeaderUserName">ドライバー：${esc(userName)}</span>` : ``}
          <button type="button" class="staffHeaderLogoutBtn" onclick="TeamAUI.logout()">ログアウト</button>
        </nav>
      </header>`;
  }

  // 管理者(admin)のみ表示する右下FAB＋メニュー
  function renderManagerFooter() {
    const host = document.getElementById("managerFooter");
    if (!host) return;
    const s = TeamA.session();
    if (!s.loggedIn || s.role !== "admin") { host.innerHTML = ""; return; }
    host.innerHTML = `
      <button type="button" id="teamaFab" class="fabBtn" onclick="TeamAUI.toggleFooter()">☰</button>
      <nav id="teamaFooterMenu" class="footerMenu">
        <a href="./manager-orders.html" class="btnFooter">注文一覧</a>
        <a href="./manager-neworder-search.html" class="btnFooter">新規注文</a>
        <a href="./manager-foods.html" class="btnFooter">商品管理</a>
        <a href="./manager-areas.html" class="btnFooter">エリア設定</a>
        <a href="./manager-areas-group.html" class="btnFooter">配送グループ</a>
        <a href="./manager-drivers.html" class="btnFooter">ドライバー管理</a>
        <a href="./manager-employees.html" class="btnFooter">社員管理</a>
      </nav>`;
  }

  global.TeamAUI = {
    renderHeader,
    renderManagerFooter,
    esc,
    logout() { TeamA.logout(); location.href = "./login.html"; },
    toggleFooter() {
      const fab = document.getElementById("teamaFab");
      const menu = document.getElementById("teamaFooterMenu");
      if (!menu) return;
      const open = menu.classList.toggle("footerShow");
      if (fab) { fab.classList.toggle("fabOpen", open); fab.textContent = open ? "×" : "☰"; }
    },
  };
})(window);
