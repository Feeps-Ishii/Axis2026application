/*
 * 共通モックストア (MockStore)
 * -------------------------------------------------------------
 * DB を使わず、JSON データを localStorage に保存して
 * 擬似的にアプリを動かすための共通ライブラリです。
 *
 * 各チームの HTML から次のように読み込んで使います:
 *
 *   <script src="/mock/store.js"></script>
 *   <script>
 *     // 初回だけ初期データを投入（既にあれば何もしない）
 *     MockStore.seed('products', [
 *       { name: 'りんご', stock: 10 },
 *       { name: 'みかん', stock: 5 },
 *     ]);
 *
 *     const items = MockStore.list('products'); // [{id, name, stock}, ...]
 *     MockStore.add('products', { name: 'ぶどう', stock: 3 });
 *     MockStore.update('products', id, { stock: 8 });
 *     MockStore.remove('products', id);
 *   </script>
 *
 * 注意: チームごとにデータが混ざらないよう、キーには自動で
 *       URL のパス（/team-apps/<slug>/）を接頭辞として付けます。
 */
(function (global) {
  "use strict";

  // 同じ store.js を別チームで共有してもデータが衝突しないように、
  // 配置パスを名前空間にする（例: team-apps/team1）。
  function namespace() {
    const m = global.location.pathname.match(/team-apps\/([^/]+)/);
    return m ? m[1] : "default";
  }

  function fullKey(key) {
    return "mockstore:" + namespace() + ":" + key;
  }

  function read(key) {
    try {
      const raw = global.localStorage.getItem(fullKey(key));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("[MockStore] 読み込みに失敗しました:", e);
      return null;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(fullKey(key), JSON.stringify(value));
    } catch (e) {
      console.warn("[MockStore] 保存に失敗しました:", e);
    }
    return value;
  }

  // 簡易 ID 生成（時刻 + ランダム）。
  function genId() {
    return (
      Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }

  const MockStore = {
    /** コレクションが未作成なら初期データを投入する。既にあれば何もしない。 */
    seed(key, defaultItems) {
      if (read(key) === null) {
        const withIds = (defaultItems || []).map((item) => ({
          id: item.id || genId(),
          ...item,
        }));
        write(key, withIds);
      }
      return this.list(key);
    },

    /** コレクションを配列で取得する。 */
    list(key) {
      const data = read(key);
      return Array.isArray(data) ? data : [];
    },

    /** id で 1 件取得する。 */
    get(key, id) {
      return this.list(key).find((item) => item.id === id) || null;
    },

    /** 1 件追加する。id が無ければ自動採番。追加した要素を返す。 */
    add(key, item) {
      const list = this.list(key);
      const record = { id: item.id || genId(), ...item };
      list.push(record);
      write(key, list);
      return record;
    },

    /** id の要素を patch でマージ更新する。更新後の要素を返す。 */
    update(key, id, patch) {
      const list = this.list(key);
      const idx = list.findIndex((item) => item.id === id);
      if (idx === -1) return null;
      list[idx] = { ...list[idx], ...patch, id };
      write(key, list);
      return list[idx];
    },

    /** id の要素を削除する。削除できたら true。 */
    remove(key, id) {
      const list = this.list(key);
      const next = list.filter((item) => item.id !== id);
      write(key, next);
      return next.length !== list.length;
    },

    /** コレクションをまるごと置き換える。 */
    saveAll(key, items) {
      return write(key, items);
    },

    /** コレクションを削除する。 */
    reset(key) {
      global.localStorage.removeItem(fullKey(key));
    },

    /** このチームの全データを削除する。 */
    clearAll() {
      const prefix = "mockstore:" + namespace() + ":";
      Object.keys(global.localStorage)
        .filter((k) => k.indexOf(prefix) === 0)
        .forEach((k) => global.localStorage.removeItem(k));
    },
  };

  global.MockStore = MockStore;
})(window);
