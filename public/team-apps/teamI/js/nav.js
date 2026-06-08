/*
 * 共通ナビゲーションバー。各ページの <div id="nav"></div> に描画します。
 * 使い方: TeamINav.render("dashboard")  // 引数はアクティブにするキー
 */
(function (global) {
  "use strict";

  const LINKS = [
    { key: "dashboard", href: "./dashboard.html", label: "ダッシュボード" },
    { key: "stocks", href: "./stocks.html", label: "在庫管理" },
    { key: "orders", href: "./orders.html", label: "取り寄せ予約管理" },
    { key: "pops", href: "./pops.html", label: "POP管理" },
    { key: "staffs", href: "./staffs.html", label: "店員管理", adminOnly: true },
  ];

  function render(active) {
    const el = document.getElementById("nav");
    if (!el) return;
    const sess = TeamI.session();
    const isAdmin = sess && sess.staff.roleId === 1;

    const links = LINKS.filter((l) => !l.adminOnly || isAdmin)
      .map((l) => `<a href="${l.href}"${l.key === active ? ' class="active"' : ""}>${l.label}</a>`)
      .join("");

    const user = sess
      ? `<span class="user-name">ログイン: <span>${TeamI.esc(sess.staff.name)}</span> 様 (<span>${TeamI.esc(sess.store ? sess.store.storeName : "")}</span>)</span>`
      : "";

    el.outerHTML = `
      <nav class="navbar">
        <div class="navbar-brand-group">
          <a href="./dashboard.html" class="brand">書籍・POP管理システム</a>
          <div class="navbar-nav">${links}</div>
        </div>
        <div class="navbar-user-group">
          ${user}
          <button type="button" id="navLogout" class="btn btn-secondary">ログアウト</button>
        </div>
      </nav>`;

    const lo = document.getElementById("navLogout");
    if (lo) lo.addEventListener("click", () => { TeamI.logout(); location.href = "./login.html"; });
  }

  global.TeamINav = { render };

  // ---- 一覧共通UI（ページャ・未実装リンクのスタブ）----
  const PAGE_SIZE = 10;

  function pagerHtml(total, current, size) {
    const pages = Math.ceil(total / (size || PAGE_SIZE));
    if (pages <= 1) return "";
    let h = `<li class="${current === 1 ? "disabled" : ""}"><a data-p="${current - 1}">« 前へ</a></li>`;
    for (let p = 1; p <= pages; p++) h += `<li class="${p === current ? "active" : ""}"><a data-p="${p}">${p}</a></li>`;
    h += `<li class="${current === pages ? "disabled" : ""}"><a data-p="${current + 1}">次へ »</a></li>`;
    return h;
  }

  // ulEl にページャを描画し、クリックで cb(page) を呼ぶ
  function wirePager(ulEl, total, current, size, cb) {
    if (!ulEl) return;
    ulEl.innerHTML = pagerHtml(total, current, size);
    ulEl.querySelectorAll("a[data-p]").forEach((a) =>
      a.addEventListener("click", () => cb(Number(a.dataset.p)))
    );
  }

  // 本デモで未実装の遷移先（編集/新規フォーム等）。クリックでメッセージ表示。
  function bindStubs(root) {
    (root || document).querySelectorAll(".stub").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        alert("この画面（登録・編集・削除フォーム）は本デモでは省略しています。\n一覧・検索・閲覧でアプリの流れをご確認ください。");
      });
    });
  }

  global.TeamIUI = { PAGE_SIZE, wirePager, bindStubs };
})(window);

