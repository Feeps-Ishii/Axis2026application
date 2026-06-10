/*
 * teamD 共通ヘッダー — 各ページの <div id="appHeader"></div> に注入する。
 * 元 templates/common/header.html（th:fragment="header"）を静的化したもの。
 * style.css の .header / .nav-header / .login / .floating-notification-* を利用。
 *
 * 使い方（各ページ）:
 *   <div id="appHeader"></div>
 *   <script src="./js/db.js"></script>
 *   <script src="./js/header.js"></script>
 * header.js が DOMContentLoaded で TeamD.init() 後に自動描画する。
 */
(function () {
  "use strict";

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function render() {
    const host = document.getElementById("appHeader");
    if (!host) return;

    const user = TeamD.currentUser();
    const staff = user && (user.authority === 1 || user.authority === 2);
    const admin = user && user.authority === 1;

    const unread = user ? TeamD.unreadTop5(user.userId) : [];
    const count = user ? TeamD.countUnread(user.userId) : 0;

    const notifItems = unread
      .map(
        (n) => `
        <li class="floating-notification-item" data-nid="${n.notificationId}">
          <strong>${esc(n.title)}</strong><br>
          <span class="floating-notification-message">${esc(n.message)}</span>
          <div class="notification-action-area">
            <button type="button" class="notification-action-button notification-open-button"
                    onclick="TeamDHeader.open(${n.notificationId})">見る</button>
            <button type="button" class="notification-action-button notification-read-button"
                    onclick="TeamDHeader.dismiss(this, ${n.notificationId})">表示を消す</button>
          </div>
        </li>`
      )
      .join("");

    const notifBox = user
      ? `
      <div class="floating-notification-box">
        <button type="button" class="floating-notification-button" onclick="TeamDHeader.toggle(event)">
          🔔
          ${count > 0 ? `<span class="floating-notification-count">${count}</span>` : ""}
        </button>
        <div id="floatingNotificationDropdown" class="floating-notification-dropdown">
          <div class="floating-notification-header"><strong>通知</strong></div>
          ${count === 0 ? `<p class="floating-notification-empty">未読通知はありません。</p>` : ""}
          ${count > 0 ? `<ul class="floating-notification-list">${notifItems}</ul>` : ""}
        </div>
      </div>`
      : "";

    const loginBox = user
      ? `
      <span>
        ようこそ <span>${esc(user.name)}</span> さん! &nbsp;|&nbsp;
        <button type="button" class="link-button" onclick="TeamDHeader.logout()">ログアウト</button>
      </span>
      ${admin ? `<span><a href="./user-register.html">管理者作成</a></span>` : ""}`
      : `<span><a href="./login.html">ログイン</a></span>`;

    host.innerHTML = `
      <div class="header">
        <h1><a href="./portal.html">まちのこ食卓プロジェクト</a></h1>
        <div class="nav-header">
          <ul>
            <li><a href="./portal.html">統合ポータル</a></li>
            <li><a href="./mypage.html">マイページ</a></li>
            <li><a href="./sns-list.html">食堂情報</a></li>
            ${staff ? `<li><a href="./dashboard.html">管理者ダッシュボード</a></li>` : ""}
          </ul>
        </div>
        ${notifBox}
        <div class="login">${loginBox}</div>
      </div>`;

    // ドロップダウン外クリックで閉じる
    document.addEventListener("click", function () {
      const box = document.getElementById("floatingNotificationDropdown");
      if (box) box.classList.remove("is-open");
    });
    const dd = document.getElementById("floatingNotificationDropdown");
    if (dd) dd.addEventListener("click", (e) => e.stopPropagation());
  }

  window.TeamDHeader = {
    render,
    toggle(event) {
      event.stopPropagation();
      const box = document.getElementById("floatingNotificationDropdown");
      if (box) box.classList.toggle("is-open");
    },
    open(id) {
      const user = TeamD.currentUser();
      if (!user) {
        location.href = "./login.html";
        return;
      }
      location.href = TeamD.openNotification(id, user.userId);
    },
    dismiss(button, id) {
      const user = TeamD.currentUser();
      if (!user) return;
      TeamD.markNotificationRead(id, user.userId);
      const item = button.closest(".floating-notification-item");
      if (item) item.remove();
      const badge = document.querySelector(".floating-notification-count");
      if (badge) {
        let c = parseInt(badge.textContent, 10) - 1;
        if (c > 0) badge.textContent = c;
        else {
          badge.remove();
          const list = document.querySelector(".floating-notification-list");
          if (list) list.remove();
          const dropdown = document.getElementById("floatingNotificationDropdown");
          if (dropdown) {
            const p = document.createElement("p");
            p.className = "floating-notification-empty";
            p.textContent = "未読通知はありません。";
            dropdown.appendChild(p);
          }
        }
      }
    },
    logout() {
      TeamD.logout();
      location.href = "./portal.html";
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.TeamD) return;
    TeamD.init().then(render);
  });
})();
