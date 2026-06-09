/*
 * TeamH 共通ヘッダー/サイドバー注入。元 maruwakaries/fragments/header.html + sidebar.html を移植。
 * 使い方:
 *   <div id="teamH-header"></div>
 *   <div class="layout"><div id="teamH-sidebar"></div><main class="main">...</main></div>
 *   TeamH.init().then(()=>{ const s=TeamH.requireLogin(); if(!s) return; TeamHNav.render('dashboard'); });
 * activeMenu は dashboard / workOrders / progress / knowledge のいずれか。
 */
(function () {
  const esc = (s) => (window.TeamH ? TeamH.esc(s) : String(s == null ? "" : s));

  // 権限別サイドバーメニュー（元 sidebar.html）
  function sidebarMenu(role, active) {
    function link(menu, href, label) {
      const cls = "nav-link" + (active === menu ? " active" : "");
      return `<a class="${cls}" href="${href}">${label}</a>`;
    }
    if (role === "admin") {
      return `<h3>管理者メニュー</h3>
        ${link("dashboard", "./admin_dashboard.html", "ダッシュボード")}
        ${link("workOrders", "./work_orders.html", "作業指示書一覧")}
        ${link("progress", "./progress_list.html", "進捗一覧")}
        ${link("knowledge", "./knowledge_list.html", "技能継承一覧")}`;
    }
    if (role === "craftsman") {
      return `<h3>職人メニュー</h3>
        ${link("dashboard", "./todo.html", "ダッシュボード")}
        ${link("progress", "./progress_list.html", "進捗管理書一覧")}
        ${link("knowledge", "./knowledge_list.html", "技能継承一覧")}`;
    }
    if (role === "sales") {
      return `<h3>営業メニュー</h3>
        ${link("progress", "./progress_list.html", "進捗管理書一覧")}
        ${link("knowledge", "./knowledge_list.html", "技能継承一覧")}`;
    }
    return "";
  }

  function headerHtml(sess) {
    const role = sess ? sess.role : null;
    const roleClass = role ? " role-" + role : "";
    const isAdmin = role === "admin";
    const notif = isAdmin
      ? `<div class="notification-area">
           <button class="header-icon-btn" type="button" onclick="TeamHNav.toggleNotifications(event)">🔔
             <span id="notification-count" class="notification-count">0</span>
           </button>
           <div id="notification-panel" class="notification-panel">
             <div class="notification-title">最新通知</div>
             <div id="notification-list"><div class="notification-empty">通知はありません</div></div>
           </div>
         </div>`
      : `<button class="header-icon-btn">🔔</button>`;
    const userBlock = sess && sess.loginUser
      ? `<div class="user-info">
           <span>${esc(TeamH.ROLE_LABEL[role] || "")}</span><span>：</span>
           <span>${esc(sess.loginUser.name)}</span>
           <div class="dropdown">
             <button class="menu-btn" onclick="TeamHNav.toggleMenu(event)">▼</button>
             <div class="dropdown-content">
               <a href="#">プロフィール</a>
               <a href="#">設定</a>
               <a href="#" onclick="TeamHNav.logout(event)">ログアウト</a>
             </div>
           </div>
         </div>`
      : `<div><a href="./login.html" class="login-btn">ログイン</a></div>`;

    return `<header class="header${roleClass}">
      <div class="header-left">
        <div class="header-logo">
          <div class="header-logo-icon">⚙</div>
          <div class="header-logo-text">
            <span class="header-logo-name">マルセイ精密工業</span>
            <span class="header-logo-sub">MARUSEI PRECISION INDUSTRY</span>
          </div>
        </div>
        <div class="header-divider"></div>
        <span class="header-system-name">進捗マルわかりシステム</span>
      </div>
      <div class="header-right">
        <div class="system-clock">
          <div id="clock-date" class="clock-date"></div>
          <div id="clock-time" class="clock-time"></div>
        </div>
        ${notif}
        ${userBlock}
      </div>
    </header>`;
  }

  function startClock() {
    const dateEl = document.getElementById("clock-date");
    const timeEl = document.getElementById("clock-time");
    if (!dateEl || !timeEl) return;
    const weeks = ["日", "月", "火", "水", "木", "金", "土"];
    function tick() {
      const now = new Date();
      const y = now.getFullYear(), mo = String(now.getMonth() + 1).padStart(2, "0"),
        d = String(now.getDate()).padStart(2, "0"), w = weeks[now.getDay()];
      const h = String(now.getHours()).padStart(2, "0"),
        mi = String(now.getMinutes()).padStart(2, "0"),
        s = String(now.getSeconds()).padStart(2, "0");
      dateEl.textContent = `${y}/${mo}/${d}(${w})`;
      timeEl.textContent = `${h}:${mi}:${s}`;
    }
    tick();
    setInterval(tick, 1000);
  }

  function wireSidebarHover() {
    const trigger = document.createElement("div");
    trigger.className = "sidebar-trigger";
    document.body.appendChild(trigger);
    const sidebar = document.querySelector(".sidebar");
    const main = document.querySelector(".main");
    if (!sidebar || !main) return;
    const open = () => { sidebar.classList.add("open"); main.classList.add("sidebar-open"); };
    const close = () => { sidebar.classList.remove("open"); main.classList.remove("sidebar-open"); };
    trigger.addEventListener("mouseenter", open);
    sidebar.addEventListener("mouseenter", open);
    sidebar.addEventListener("mouseleave", close);
  }

  // 管理者通知（元 ProgressService.findAdminNotifications を簡易再現）
  function loadAdminNotifications() {
    const list = document.getElementById("notification-list");
    const count = document.getElementById("notification-count");
    if (!list || !count) return;
    const data = TeamH.progressReportProcesses()
      .filter((p) => p.actualStart || p.actualEnd)
      .sort((a, b) => (new Date(String(b.updatedAt).replace(" ", "T")) - new Date(String(a.updatedAt).replace(" ", "T"))))
      .slice(0, 5)
      .map((p) => {
        const wo = TeamH.workOrder(p.workOrderId);
        const wop = TeamH.workOrderProcess(p.workOrderProcessId);
        let type, action;
        if (p.actualEnd && p.progressStatus === "completed") { type = "finish"; action = "作業を完了しました"; }
        else if (p.actualStart) { type = "start"; action = "作業を開始しました"; }
        else { type = "update"; action = "作業を更新しました"; }
        const msg = `${TeamH.userName(p.assignedUserId)} さんが ${wo ? wo.orderNo : ""} / ${wo ? wo.partName : ""} / ${wop ? wop.processName : ""} を${action}`;
        return { message: msg, type };
      });
    list.innerHTML = "";
    if (data.length === 0) {
      list.innerHTML = '<div class="notification-empty">通知はありません</div>';
      count.style.display = "none";
      return;
    }
    count.textContent = data.length;
    count.style.display = "flex";
    data.forEach((item) => {
      const div = document.createElement("div");
      div.className = "notification-item " + item.type;
      div.textContent = item.message;
      list.appendChild(div);
    });
  }

  const TeamHNav = {
    render(active) {
      const sess = TeamH.session();
      const headerHost = document.getElementById("teamH-header");
      if (headerHost) headerHost.outerHTML = headerHtml(sess);
      const sidebarHost = document.getElementById("teamH-sidebar");
      if (sidebarHost && sess) {
        const roleClass = " role-" + sess.role;
        sidebarHost.outerHTML = `<aside class="sidebar${roleClass}">${sidebarMenu(sess.role, active)}</aside>`;
      }
      startClock();
      wireSidebarHover();
      if (sess && sess.role === "admin") {
        loadAdminNotifications();
        setInterval(loadAdminNotifications, 10000);
      }
      document.addEventListener("click", function () {
        document.querySelector(".dropdown") && document.querySelector(".dropdown").classList.remove("show");
        const np = document.getElementById("notification-panel");
        np && np.classList.remove("show");
      });
    },
    toggleMenu(event) {
      event.stopPropagation();
      const dd = document.querySelector(".dropdown");
      dd && dd.classList.toggle("show");
    },
    toggleNotifications(event) {
      event.stopPropagation();
      const panel = document.getElementById("notification-panel");
      panel && panel.classList.toggle("show");
    },
    logout(event) {
      if (event) event.preventDefault();
      TeamH.logout();
      location.href = "./login.html";
    },
  };

  window.TeamHNav = TeamHNav;
})();
