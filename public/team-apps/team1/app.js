/*
 * 在庫管理アプリ（サンプル） — 配線テンプレート
 * 共通モックストア (window.MockStore) を使って
 * JSON データの一覧・追加・更新・削除を行います。
 */
(function () {
  "use strict";

  const KEY = "products";

  // 初回だけ初期データを投入する。
  MockStore.seed(KEY, [
    { name: "りんご", stock: 12 },
    { name: "みかん", stock: 5 },
    { name: "ぶどう", stock: 8 },
  ]);

  const listEl = document.getElementById("list");
  const formEl = document.getElementById("add-form");
  const nameEl = document.getElementById("name");
  const stockEl = document.getElementById("stock");
  const resetEl = document.getElementById("reset");

  // 一覧を描画する。
  function render() {
    const items = MockStore.list(KEY);

    if (items.length === 0) {
      listEl.innerHTML =
        '<tr><td colspan="3" class="empty">商品がありません。上のフォームから追加してください。</td></tr>';
      return;
    }

    listEl.innerHTML = items
      .map(
        (item) => `
          <tr data-id="${item.id}">
            <td>${escapeHtml(item.name)}</td>
            <td class="num">
              <input class="stock-input" type="number" min="0" value="${item.stock}" />
            </td>
            <td class="actions">
              <button class="del" type="button">削除</button>
            </td>
          </tr>`
      )
      .join("");
  }

  // HTML エスケープ（最低限）。
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // 追加
  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    const name = nameEl.value.trim();
    if (!name) return;
    MockStore.add(KEY, { name: name, stock: Number(stockEl.value) || 0 });
    nameEl.value = "";
    stockEl.value = "0";
    render();
  });

  // 在庫数の更新・削除（イベント委譲）
  listEl.addEventListener("change", function (e) {
    if (!e.target.classList.contains("stock-input")) return;
    const id = e.target.closest("tr").dataset.id;
    MockStore.update(KEY, id, { stock: Number(e.target.value) || 0 });
  });

  listEl.addEventListener("click", function (e) {
    if (!e.target.classList.contains("del")) return;
    const id = e.target.closest("tr").dataset.id;
    MockStore.remove(KEY, id);
    render();
  });

  // リセット
  resetEl.addEventListener("click", function () {
    MockStore.reset(KEY);
    MockStore.seed(KEY, [
      { name: "りんご", stock: 12 },
      { name: "みかん", stock: 5 },
      { name: "ぶどう", stock: 8 },
    ]);
    render();
  });

  render();
})();
