/*
 * teamC 共通ヘッダー — 元 fragments/header.html (th:fragment="appHeader") の置き換え。
 * 各ページは <body> 直下に <div id="appHeader"></div> を置き、db.js の後に
 *   <script src="./js/header.js"></script>
 * を読み込むだけでヘッダーが描画されます（style.css の .app-header 系で装飾）。
 *
 * ・ログインユーザー名 / 権限を表示
 * ・「ポータルへ戻る」はロール別の遷移先（教室長/講師→admin_dashboard、生徒→自分のカルテ）
 * ・ログアウトは TeamC.logout() → login.html
 */
(function () {
  function portalHref() {
    var u = (window.TeamC && TeamC.loginUser && TeamC.loginUser()) || null;
    if (!u) return "./login.html";
    if (u.role === "教室長" || u.role === "講師") return "./admin_dashboard.html";
    if (u.role === "生徒" || u.role === "生徒・保護者") {
      var sid = TeamC.loginStudentId && TeamC.loginStudentId();
      return sid ? "./student_carte.html?studentId=" + sid : "./login.html";
    }
    return "./login.html";
  }

  function render() {
    var mount = document.getElementById("appHeader");
    if (!mount) return;
    var u = (window.TeamC && TeamC.loginUser && TeamC.loginUser()) || null;
    var esc = (window.TeamC && TeamC.esc) ? TeamC.esc : function (s) { return s == null ? "" : String(s); };
    var portal = portalHref();

    var userBlock = u
      ? '<div class="header-user-info">' +
          '<span class="header-user-name">' + esc(u.name) + "</span>" +
          '<span class="header-user-role">' + esc(u.role) + "</span>" +
        "</div>"
      : "";

    mount.outerHTML =
      '<header class="app-header">' +
        '<div class="header-inner">' +
          '<a href="' + portal + '" class="header-brand">' +
            '<img src="./images/matsukaze-logo.png" alt="進学ゼミナール松風 ロゴ" class="header-logo">' +
            '<div class="header-brand-text">' +
              '<div class="header-title-ja">進学ゼミナール松風</div>' +
              '<div class="header-title-en">Matsukaze</div>' +
            "</div>" +
          "</a>" +
          '<nav class="header-nav">' +
            userBlock +
            '<a href="' + portal + '" class="header-link">ポータルへ戻る</a>' +
            '<form class="header-logout-form" id="appHeaderLogout">' +
              '<button type="submit" class="header-logout-btn">ログアウト</button>' +
            "</form>" +
          "</nav>" +
        "</div>" +
      "</header>";

    var form = document.getElementById("appHeaderLogout");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (window.TeamC && TeamC.logout) TeamC.logout();
        window.location.href = "./login.html";
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
