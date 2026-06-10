/*
 * teamD「まちのこ食卓プロジェクト」(子ども食堂 支援ポータル) — 擬似データ層
 * --------------------------------------------------------------------------
 * 本物の Spring Boot + MySQL の代わりに、seed.json を localStorage に取り込み、
 * JSON データだけでアプリを動かす。各画面からは window.TeamD 経由で参照・更新する。
 *
 *   <script src="./js/db.js"></script>
 *   <script>
 *     TeamD.init().then(() => { ... });
 *   </script>
 *
 * 名前空間は localStorage キー "teamD:" プレフィックス。権限 authority:
 *   1=管理者 / 2=食堂職員 / 3=ボランティア
 */
(function (global) {
  "use strict";

  const NS = "teamD:";
  const SEED_FLAG = NS + "seeded";
  const SEED_VERSION = "v1";
  const VERSION_KEY = NS + "seedVersion";
  const SESSION_KEY = NS + "loginUserId";
  const TODAY = "2026-06-10"; // デモ固定日（seed と一致）

  const COLLECTIONS = [
    "days", "availableTimes", "regions", "handoffMethods", "foods", "images", "badges",
    "userAccounts", "shokudos", "kodomoShokudos", "volunteerProfiles",
    "foodRecruits", "recruitFoods", "foodDonations", "donationDetails",
    "volunteerRecruits", "volunteerEntries", "userShifts", "userAvailableRegions",
    "thanksMessages", "notifications",
  ];

  function read(key, fallback) {
    try {
      const raw = global.localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
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

  // ---- 入力→確認→完了フロー用の下書き（sessionStorage） ----
  function setDraft(key, obj) {
    global.sessionStorage.setItem(NS + "draft:" + key, JSON.stringify(obj));
  }
  function getDraft(key) {
    try {
      const raw = global.sessionStorage.getItem(NS + "draft:" + key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clearDraft(key) {
    global.sessionStorage.removeItem(NS + "draft:" + key);
  }

  // ---- 汎用ヘルパー ----
  const all = (c) => read(c, []);
  const save = (c, arr) => write(c, arr);
  const nextId = (c, key) =>
    all(c).reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0) + 1;
  const now = () => `${TODAY} 09:00:00`;
  const todayStr = () => TODAY;
  const contains = (hay, needle) =>
    !needle || String(hay == null ? "" : hay).indexOf(needle) !== -1;
  const dateOnly = (s) => (s ? String(s).slice(0, 10) : "");

  // =================================================================
  // セッション
  // =================================================================
  function login(email, pass) {
    const u = all("userAccounts").find(
      (x) => x.email === email && x.pass === pass && !x.deleteFlag
    );
    if (!u) return null;
    global.localStorage.setItem(SESSION_KEY, String(u.userId));
    return u;
  }
  function currentUser() {
    const id = global.localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    return all("userAccounts").find((x) => x.userId === Number(id)) || null;
  }
  function logout() {
    global.localStorage.removeItem(SESSION_KEY);
  }
  function isLogin() {
    return !!currentUser();
  }
  function isAdmin() {
    const u = currentUser();
    return !!u && u.authority === 1;
  }
  // 管理者 or 食堂職員（admin画面アクセス権）
  function isStaff() {
    const u = currentUser();
    return !!u && (u.authority === 1 || u.authority === 2);
  }
  function isVolunteer() {
    const u = currentUser();
    return !!u && u.authority === 3;
  }
  // ログイン必須ページのガード。未ログインなら login.html へ。
  function requireLogin(returnFile) {
    if (isLogin()) return true;
    const r = returnFile || location.pathname.split("/").pop();
    location.href = `./login.html?redirect=${encodeURIComponent(r)}`;
    return false;
  }
  // 管理者ダッシュボード系のガード（authority 1/2 のみ）
  function requireStaff(returnFile) {
    if (!requireLogin(returnFile)) return false;
    if (isStaff()) return true;
    location.href = "./portal.html";
    return false;
  }

  // =================================================================
  // マスタ
  // =================================================================
  const days = () => all("days").slice().sort((a, b) => a.dayId - b.dayId);
  const times = () =>
    all("availableTimes").slice().sort((a, b) => a.timeId - b.timeId);
  const regions = () =>
    all("regions").slice().sort((a, b) => a.regionId - b.regionId);
  const handoffMethods = () => all("handoffMethods");
  const handoffMethodById = (id) =>
    all("handoffMethods").find((m) => m.methodId === Number(id)) || null;
  const foods = () => all("foods");
  const foodById = (id) => all("foods").find((f) => f.foodId === Number(id)) || null;
  const badges = () =>
    all("badges").slice().sort((a, b) => a.requiredCount - b.requiredCount);
  const dayName = (id) => (days().find((d) => d.dayId === id) || {}).dayName || "";
  const timeLabel = (id) => {
    const t = times().find((x) => x.timeId === id);
    return t ? `${t.startTime}～${t.endTime}` : "";
  };
  const regionName = (id) =>
    (regions().find((r) => r.regionId === id) || {}).regionName || "";

  // バッジ：stamp 以下で最大の requiredCount のバッジ
  function currentBadge(stamp) {
    const s = stamp == null ? 0 : stamp;
    const cand = badges().filter((b) => !b.deleteFlag && b.requiredCount <= s);
    return cand.length ? cand[cand.length - 1] : null;
  }

  // =================================================================
  // 食堂
  // =================================================================
  const shokudosActive = () =>
    all("shokudos")
      .filter((s) => !s.deleteFlag)
      .sort((a, b) => a.shokudoId - b.shokudoId);
  const shokudoById = (id) =>
    all("shokudos").find((s) => s.shokudoId === Number(id) && !s.deleteFlag) || null;
  const shokudoByIdAny = (id) =>
    all("shokudos").find((s) => s.shokudoId === Number(id)) || null;
  const shokudoName = (id) => (shokudoByIdAny(id) || {}).shokudoName || "";
  function shokudoNameMap() {
    const m = {};
    all("shokudos").forEach((s) => (m[s.shokudoId] = s.shokudoName));
    return m;
  }
  function shokudoSearch(name, address) {
    let list = shokudosActive();
    const hasName = name && name.trim() !== "";
    const hasAddr = address && address.trim() !== "";
    if (hasName) list = list.filter((s) => s.shokudoName === name);
    if (hasAddr) list = list.filter((s) => contains(s.address, address.trim()));
    return list;
  }
  function saveShokudo(obj) {
    const list = all("shokudos");
    if (obj.shokudoId) {
      const i = list.findIndex((s) => s.shokudoId === Number(obj.shokudoId));
      if (i >= 0) {
        list[i] = { ...list[i], ...obj, shokudoId: Number(obj.shokudoId), updatedAt: now() };
        save("shokudos", list);
        return list[i];
      }
    }
    const rec = {
      shokudoId: nextId("shokudos", "shokudoId"),
      shokudoName: obj.shokudoName || "",
      description: obj.description || "",
      postalCode: obj.postalCode || "",
      address: obj.address || "",
      phoneNumber: obj.phoneNumber || "",
      hpUrl: obj.hpUrl || "",
      snsUrl: obj.snsUrl || "",
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    };
    list.push(rec);
    save("shokudos", list);
    return rec;
  }
  function deleteShokudo(id) {
    const list = all("shokudos");
    const i = list.findIndex((s) => s.shokudoId === Number(id));
    if (i >= 0) {
      list[i].deleteFlag = true;
      list[i].updatedAt = now();
      save("shokudos", list);
    }
  }

  // =================================================================
  // ユーザー / 食堂職員所属
  // =================================================================
  const usersActive = () => all("userAccounts").filter((u) => !u.deleteFlag);
  const userById = (id) =>
    all("userAccounts").find((u) => u.userId === Number(id)) || null;
  // userId → 所属食堂名（職員）
  function userShokudoNameMap() {
    const m = {};
    const snm = shokudoNameMap();
    all("kodomoShokudos")
      .filter((k) => !k.deleteFlag)
      .forEach((k) => (m[k.userId] = snm[k.shokudoId]));
    return m;
  }
  function searchUsers(name, authority, shokudoName) {
    const snm = userShokudoNameMap();
    return usersActive()
      .filter((u) => {
        if (name && name.trim() && !contains(u.name, name.trim())) return false;
        if (authority != null && authority !== "" && u.authority !== Number(authority)) return false;
        if (shokudoName && shokudoName.trim() && snm[u.userId] !== shokudoName) return false;
        return true;
      })
      .sort((a, b) => a.userId - b.userId);
  }
  function emailExists(email, exceptUserId) {
    return all("userAccounts").some(
      (u) => u.email === email && (exceptUserId == null || u.userId !== Number(exceptUserId))
    );
  }
  // 管理者/職員 作成
  function createUser(user, shokudoId) {
    if (emailExists(user.email)) throw new Error("このメールアドレスは既に登録されています");
    const list = all("userAccounts");
    const rec = {
      userId: nextId("userAccounts", "userId"),
      name: user.name,
      phone: user.phone,
      email: user.email,
      pass: user.pass,
      authority: Number(user.authority),
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    };
    list.push(rec);
    save("userAccounts", list);
    if (rec.authority === 2) {
      if (!shokudoId) throw new Error("食堂職員の場合は食堂を選択してください");
      const ks = all("kodomoShokudos");
      ks.push({
        managementId: nextId("kodomoShokudos", "managementId"),
        shokudoId: Number(shokudoId),
        userId: rec.userId,
        createdAt: now(),
        updatedAt: now(),
        deleteFlag: false,
      });
      save("kodomoShokudos", ks);
    }
    return rec;
  }
  function updateUser(user) {
    const list = all("userAccounts");
    const i = list.findIndex((u) => u.userId === Number(user.userId));
    if (i < 0) throw new Error("ユーザーが存在しません");
    if (user.email !== list[i].email && emailExists(user.email, user.userId))
      throw new Error("このメールアドレスは既に登録されています");
    list[i].name = user.name;
    list[i].phone = user.phone;
    list[i].email = user.email;
    if (user.pass && user.pass.trim()) list[i].pass = user.pass;
    if (user.authority != null) list[i].authority = Number(user.authority);
    list[i].updatedAt = now();
    save("userAccounts", list);
    return list[i];
  }
  function deleteUser(id) {
    const list = all("userAccounts");
    const i = list.findIndex((u) => u.userId === Number(id));
    if (i >= 0) {
      list[i].deleteFlag = true;
      list[i].updatedAt = now();
      save("userAccounts", list);
    }
  }

  // =================================================================
  // ボランティアプロフィール
  // =================================================================
  const volunteerProfileByUserId = (userId) =>
    all("volunteerProfiles").find((p) => p.userId === Number(userId)) || null;
  const volunteerProfileById = (volunteerId) =>
    all("volunteerProfiles").find((p) => p.volunteerId === Number(volunteerId)) || null;
  // プロフィール + user を結合した view
  function volunteerView(p) {
    if (!p) return null;
    const u = userById(p.userId) || {};
    return { ...p, user: u };
  }
  // 編集画面用：選択済みシフト値 "dayId-timeId"
  function selectedShiftValues(userId) {
    return all("userShifts")
      .filter((s) => s.volunteerId === Number(userId))
      .sort((a, b) => a.dayId - b.dayId || a.timeId - b.timeId)
      .map((s) => `${s.dayId}-${s.timeId}`);
  }
  function selectedRegionIds(userId) {
    return all("userAvailableRegions")
      .filter((r) => r.volunteerId === Number(userId))
      .map((r) => r.regionId);
  }
  // userId → 参加可能日時 表示文字列（<br>区切り）
  function shiftTextByUser(userId) {
    const order = ["月", "火", "水", "木", "金", "土", "日"];
    const byDay = {};
    all("userShifts")
      .filter((s) => s.volunteerId === Number(userId))
      .forEach((s) => {
        const dn = dayName(s.dayId);
        (byDay[dn] = byDay[dn] || []).push(timeLabel(s.timeId));
      });
    return order
      .filter((d) => byDay[d] && byDay[d].length)
      .map((d) => `${d} ${byDay[d].join("・")}`)
      .join("<br>");
  }
  function regionTextByUser(userId) {
    const names = all("userAvailableRegions")
      .filter((r) => r.volunteerId === Number(userId))
      .map((r) => regionName(r.regionId));
    return names.join(" / ");
  }
  // 名簿検索（dayId,timeId,regionId,各資格bool）
  function searchVolunteers(dayId, timeId, regionId, cooking, nutritionist, childcare, driver) {
    const shifts = all("userShifts");
    const regs = all("userAvailableRegions");
    return all("volunteerProfiles")
      .filter((p) => {
        const u = userById(p.userId);
        if (!u || u.deleteFlag) return false;
        if (dayId) {
          if (!shifts.some((s) => s.volunteerId === p.userId && s.dayId === Number(dayId))) return false;
        }
        if (timeId) {
          if (!shifts.some((s) => s.volunteerId === p.userId && s.timeId === Number(timeId))) return false;
        }
        if (regionId) {
          if (!regs.some((r) => r.volunteerId === p.userId && r.regionId === Number(regionId))) return false;
        }
        if (cooking && !p.cookingExperience) return false;
        if (nutritionist && !p.nutritionist) return false;
        if (childcare && !p.childcare) return false;
        if (driver && !p.driverLicense) return false;
        return true;
      })
      .sort((a, b) => a.volunteerId - b.volunteerId);
  }
  // ボランティア新規登録（user authority=3 + profile + shift + region）
  function createVolunteer(user, profile, shiftValues, regionIds) {
    if (emailExists(user.email)) throw new Error("このメールアドレスは既に登録されています");
    const users = all("userAccounts");
    const userRec = {
      userId: nextId("userAccounts", "userId"),
      name: user.name,
      phone: user.phone,
      email: user.email,
      pass: user.pass,
      authority: 3,
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    };
    users.push(userRec);
    save("userAccounts", users);

    const profiles = all("volunteerProfiles");
    const profRec = {
      volunteerId: nextId("volunteerProfiles", "volunteerId"),
      userId: userRec.userId,
      nickname: profile.nickname || "",
      postalCode: profile.postalCode || "",
      address: profile.address || "",
      age: profile.age != null ? Number(profile.age) : null,
      occupation: profile.occupation || "",
      cookingExperience: !!profile.cookingExperience,
      nutritionist: !!profile.nutritionist,
      childcare: !!profile.childcare,
      driverLicense: !!profile.driverLicense,
      stamp: 0,
      badgeId: null,
      evaluationComment: "",
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    };
    profiles.push(profRec);
    save("volunteerProfiles", profiles);

    applyShifts(userRec.userId, shiftValues);
    applyRegions(userRec.userId, regionIds);
    return { user: userRec, profile: profRec };
  }
  function applyShifts(userId, shiftValues) {
    let list = all("userShifts").filter((s) => s.volunteerId !== Number(userId));
    (shiftValues || []).forEach((v) => {
      const [d, t] = String(v).split("-").map(Number);
      list.push({
        shiftId: list.reduce((m, r) => Math.max(m, r.shiftId), 0) + 1,
        volunteerId: Number(userId),
        dayId: d,
        timeId: t,
        createdAt: now(),
        updatedAt: now(),
      });
    });
    save("userShifts", list);
  }
  function applyRegions(userId, regionIds) {
    let list = all("userAvailableRegions").filter((r) => r.volunteerId !== Number(userId));
    (regionIds || []).forEach((rid) => {
      list.push({
        availableRegionsId: list.reduce((m, r) => Math.max(m, r.availableRegionsId), 0) + 1,
        volunteerId: Number(userId),
        regionId: Number(rid),
        createdAt: now(),
        updatedAt: now(),
      });
    });
    save("userAvailableRegions", list);
  }
  // ボランティア編集（user + profile + shift/region 再登録）。isAdmin で評価コメント更新。
  function updateVolunteerByUserId(userId, user, profile, shiftValues, regionIds, isAdmin) {
    const users = all("userAccounts");
    const ui = users.findIndex((u) => u.userId === Number(userId));
    if (ui < 0) throw new Error("ユーザー情報が存在しません。");
    users[ui].name = user.name;
    users[ui].phone = user.phone;
    users[ui].email = user.email;
    if (user.pass && user.pass.trim()) users[ui].pass = user.pass;
    users[ui].updatedAt = now();
    save("userAccounts", users);

    const profiles = all("volunteerProfiles");
    const pi = profiles.findIndex((p) => p.userId === Number(userId));
    if (pi >= 0) {
      profiles[pi].nickname = profile.nickname;
      profiles[pi].postalCode = profile.postalCode;
      profiles[pi].address = profile.address;
      if (profile.age != null && profile.age !== "") profiles[pi].age = Number(profile.age);
      profiles[pi].occupation = profile.occupation;
      profiles[pi].cookingExperience = !!profile.cookingExperience;
      profiles[pi].nutritionist = !!profile.nutritionist;
      profiles[pi].childcare = !!profile.childcare;
      profiles[pi].driverLicense = !!profile.driverLicense;
      if (isAdmin && profile.evaluationComment != null)
        profiles[pi].evaluationComment = profile.evaluationComment;
      profiles[pi].updatedAt = now();
      save("volunteerProfiles", profiles);
    }
    applyShifts(Number(userId), shiftValues);
    applyRegions(Number(userId), regionIds);
  }
  // 管理者：volunteerId 指定で編集
  function updateVolunteerById(volunteerId, user, profile, shiftValues, regionIds) {
    const p = volunteerProfileById(volunteerId);
    if (!p) throw new Error("ボランティア情報が存在しません。");
    updateVolunteerByUserId(p.userId, user, profile, shiftValues, regionIds, true);
  }
  function deleteVolunteerById(volunteerId) {
    const p = volunteerProfileById(volunteerId);
    if (p) deleteUser(p.userId);
  }
  function deleteMyAccount(userId) {
    deleteUser(userId);
    logout();
  }

  // =================================================================
  // 食材募集 / 募集食品
  // =================================================================
  const foodRecruitsActive = () =>
    all("foodRecruits").filter((f) => !f.deleteFlag);
  const foodRecruitById = (id) =>
    all("foodRecruits").find((f) => f.foodRecruitId === Number(id)) || null;
  const recruitFoodByRecruitId = (frId) =>
    all("recruitFoods").find((rf) => rf.foodRecruitId === Number(frId)) || null;
  // foodRecruitId → 食品名
  function foodNameMap() {
    const m = {};
    const fm = {};
    all("foods").forEach((f) => (fm[f.foodId] = f.foodName));
    all("recruitFoods").forEach((rf) => {
      if (m[rf.foodRecruitId] == null) m[rf.foodRecruitId] = fm[rf.foodId];
    });
    return m;
  }
  function quantityMap() {
    const m = {};
    all("recruitFoods").forEach((rf) => {
      if (m[rf.foodRecruitId] == null) m[rf.foodRecruitId] = rf.requiredQuantity;
    });
    return m;
  }
  // 食材募集 view（shokudo付き）
  function foodRecruitView(f) {
    if (!f) return null;
    return { ...f, shokudo: shokudoByIdAny(f.shokudoId) };
  }
  function createFoodRecruit(form) {
    const list = all("foodRecruits");
    const rec = {
      foodRecruitId: nextId("foodRecruits", "foodRecruitId"),
      shokudoId: Number(form.shokudoId),
      title: form.title,
      deadlineDate: `${form.deadlineDate} 00:00:00`,
      remarks: form.remarks || "",
      createdAt: now(),
      updatedAt: now(),
      status: Number(form.status),
      deleteFlag: false,
    };
    list.push(rec);
    save("foodRecruits", list);

    const rfs = all("recruitFoods");
    rfs.push({
      recruitFoodId: nextId("recruitFoods", "recruitFoodId"),
      foodRecruitId: rec.foodRecruitId,
      foodId: Number(form.foodId),
      requiredQuantity: form.requiredQuantity,
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    });
    save("recruitFoods", rfs);
    return rec;
  }
  function updateFoodRecruit(id, form) {
    const list = all("foodRecruits");
    const i = list.findIndex((f) => f.foodRecruitId === Number(id));
    if (i < 0) return null;
    list[i].title = form.title;
    list[i].shokudoId = Number(form.shokudoId);
    list[i].deadlineDate = `${form.deadlineDate} 00:00:00`;
    list[i].remarks = form.remarks || "";
    list[i].status = Number(form.status);
    list[i].updatedAt = now();
    save("foodRecruits", list);

    const rfs = all("recruitFoods");
    const ri = rfs.findIndex((rf) => rf.foodRecruitId === Number(id));
    if (ri >= 0) {
      rfs[ri].foodId = Number(form.foodId);
      rfs[ri].requiredQuantity = form.requiredQuantity;
      rfs[ri].updatedAt = now();
      save("recruitFoods", rfs);
    }
    return list[i];
  }
  function deleteFoodRecruit(id) {
    const list = all("foodRecruits");
    const i = list.findIndex((f) => f.foodRecruitId === Number(id));
    if (i >= 0) {
      list[i].deleteFlag = true;
      list[i].updatedAt = now();
      save("foodRecruits", list);
    }
  }

  // =================================================================
  // 食材寄付
  // =================================================================
  const donationById = (id) =>
    all("foodDonations").find((d) => d.donationId === Number(id) && !d.deleteFlag) || null;
  // 寄付 view（募集タイトル・食品名・寄付者名・受渡方法名）
  function donationView(d) {
    if (!d) return null;
    const fr = foodRecruitById(d.foodRecruitId);
    const rf = recruitFoodByRecruitId(d.foodRecruitId);
    const food = rf ? foodById(rf.foodId) : null;
    const donor = userById(d.volunteerId);
    return {
      ...d,
      recruitTitle: fr ? fr.title : "",
      shokudoName: fr ? shokudoName(fr.shokudoId) : "",
      foodName: food ? food.foodName : "",
      donorName: donor ? donor.name : "",
      methodName: (handoffMethodById(d.methodId) || {}).methodName || "",
    };
  }
  function donationList(searchType, keyword) {
    let list = all("foodDonations").filter((d) => !d.deleteFlag).map(donationView);
    const kw = keyword && keyword.trim();
    if (kw) {
      if (searchType === "foodName") list = list.filter((d) => contains(d.foodName, kw));
      else list = list.filter((d) => contains(d.donorName, kw)); // donorName 検索
    }
    // status 昇順, donationId 降順
    return list.sort((a, b) => a.status - b.status || b.donationId - a.donationId);
  }
  function createDonation(form, userId) {
    const list = all("foodDonations");
    const rec = {
      donationId: nextId("foodDonations", "donationId"),
      foodRecruitId: Number(form.foodRecruitId),
      volunteerId: Number(userId),
      expirationDate: form.expirationDate,
      methodId: Number(form.methodId),
      remarks: form.remarks || "",
      createdAt: now(),
      updatedAt: now(),
      status: 1,
      deleteFlag: false,
      quantity: Number(form.quantity),
      unit: form.unit,
    };
    list.push(rec);
    save("foodDonations", list);

    // 募集食品の残数量を減らす（数字部分のみ計算）。0 になれば募集終了。
    const rfs = all("recruitFoods");
    const ri = rfs.findIndex((rf) => rf.foodRecruitId === rec.foodRecruitId);
    if (ri >= 0) {
      const reqNum = parseInt(String(rfs[ri].requiredQuantity).replace(/[^0-9]/g, ""), 10) || 0;
      let remaining = reqNum - rec.quantity;
      if (remaining < 0) remaining = 0;
      rfs[ri].requiredQuantity = remaining + rec.unit;
      rfs[ri].updatedAt = now();
      save("recruitFoods", rfs);
      if (remaining === 0) deleteFoodRecruit(rec.foodRecruitId);
    }
    return rec;
  }
  function updateDonation(id, form) {
    const list = all("foodDonations");
    const i = list.findIndex((d) => d.donationId === Number(id));
    if (i < 0) return null;
    list[i].expirationDate = form.expirationDate;
    list[i].methodId = Number(form.methodId);
    list[i].remarks = form.remarks || "";
    list[i].quantity = Number(form.quantity);
    list[i].unit = form.unit;
    list[i].updatedAt = now();
    save("foodDonations", list);
    return list[i];
  }
  function setDonationStatus(id, status) {
    const list = all("foodDonations");
    const i = list.findIndex((d) => d.donationId === Number(id));
    if (i >= 0) {
      list[i].status = status;
      list[i].updatedAt = now();
      save("foodDonations", list);
    }
  }
  const markReceived = (id) => setDonationStatus(id, 2);
  const markUnreceived = (id) => setDonationStatus(id, 1);
  function deleteDonation(id) {
    const list = all("foodDonations");
    const i = list.findIndex((d) => d.donationId === Number(id));
    if (i >= 0) {
      list[i].deleteFlag = true;
      list[i].updatedAt = now();
      save("foodDonations", list);
    }
  }

  // =================================================================
  // ボランティア募集
  // =================================================================
  const recruitsActiveAll = () => all("volunteerRecruits").filter((r) => !r.deleteFlag);
  const recruitById = (id) =>
    all("volunteerRecruits").find((r) => r.recruitId === Number(id)) || null;
  const recruitActiveById = (id) =>
    all("volunteerRecruits").find((r) => r.recruitId === Number(id) && !r.deleteFlag) || null;
  function recruitView(r) {
    if (!r) return null;
    return { ...r, shokudo: shokudoByIdAny(r.shokudoId), shokudoName: shokudoName(r.shokudoId) };
  }
  // 一覧検索：status 0=募集中(空きあり), 9=満員, 1=締切, 2=中止
  function recruitList(shokudoId, location, status) {
    const hasShokudo = shokudoId != null && shokudoId !== "";
    const hasLocation = location && location.trim() !== "";
    const hasStatus = status != null && status !== "";
    let base = recruitsActiveAll();
    if (!hasShokudo && !hasLocation && !hasStatus) {
      return base.sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1)).map(recruitView);
    }
    if (hasShokudo) base = base.filter((r) => r.shokudoId === Number(shokudoId));
    if (hasLocation) base = base.filter((r) => contains(r.location, location.trim()));
    if (hasStatus) {
      const st = Number(status);
      if (st === 0) base = base.filter((r) => r.status === 0 && r.currentCount < r.capacity);
      else if (st === 9) base = base.filter((r) => r.status === 0 && r.currentCount >= r.capacity);
      else base = base.filter((r) => r.status === st);
    }
    return base.sort((a, b) => (a.eventDate < b.eventDate ? 1 : -1)).map(recruitView);
  }
  function createRecruit(form) {
    const list = all("volunteerRecruits");
    const rec = {
      recruitId: nextId("volunteerRecruits", "recruitId"),
      shokudoId: Number(form.shokudoId),
      title: form.title,
      eventDate: `${form.eventDate} ${form.eventTime}:00`,
      endDate: `${form.eventDate} ${form.endTime}:00`,
      location: form.location,
      description: form.description || "",
      capacity: Number(form.capacity),
      deadline: form.deadline ? form.deadline.replace("T", " ") + ":00" : `${form.eventDate} 00:00:00`,
      isUrgent: !!form.isUrgent,
      currentCount: 0,
      status: 0,
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    };
    list.push(rec);
    save("volunteerRecruits", list);
    // 緊急募集ならボランティア全員へ通知
    if (rec.isUrgent) notifyUrgentRecruit(rec);
    return rec;
  }
  function updateRecruit(id, form) {
    const list = all("volunteerRecruits");
    const i = list.findIndex((r) => r.recruitId === Number(id));
    if (i < 0) return null;
    list[i].shokudoId = Number(form.shokudoId);
    list[i].title = form.title;
    list[i].eventDate = `${form.eventDate} ${form.eventTime}:00`;
    list[i].endDate = `${form.eventDate} ${form.endTime}:00`;
    list[i].location = form.location;
    list[i].description = form.description || "";
    list[i].capacity = Number(form.capacity);
    if (form.deadline) list[i].deadline = form.deadline.replace("T", " ") + (form.deadline.length === 16 ? ":00" : "");
    list[i].isUrgent = !!form.isUrgent;
    if (form.status != null && form.status !== "") list[i].status = Number(form.status);
    list[i].updatedAt = now();
    save("volunteerRecruits", list);
    return list[i];
  }
  function deleteRecruit(id) {
    const list = all("volunteerRecruits");
    const i = list.findIndex((r) => r.recruitId === Number(id));
    if (i >= 0) {
      list[i].deleteFlag = true;
      list[i].updatedAt = now();
      save("volunteerRecruits", list);
    }
  }
  // 編集フォーム用に分解
  function recruitEditForm(id) {
    const r = recruitById(id);
    if (!r) return null;
    return {
      recruitId: r.recruitId,
      title: r.title,
      shokudoId: r.shokudoId,
      eventDate: dateOnly(r.eventDate),
      eventTime: String(r.eventDate).slice(11, 16),
      endTime: String(r.endDate).slice(11, 16),
      location: r.location,
      description: r.description,
      capacity: r.capacity,
      deadline: String(r.deadline).slice(0, 16).replace(" ", "T"),
      isUrgent: r.isUrgent,
      status: r.status,
    };
  }

  // =================================================================
  // ポータル
  // =================================================================
  function portalFoodRecruits() {
    const t = todayStr();
    return foodRecruitsActive()
      .filter((f) => f.status === 1 && dateOnly(f.deadlineDate) >= t)
      .sort((a, b) => (a.deadlineDate < b.deadlineDate ? -1 : 1))
      .map(foodRecruitView);
  }
  function portalVolunteerRecruits() {
    const n = now();
    return recruitsActiveAll()
      .filter((r) => r.status === 0 && r.deadline > n && r.currentCount < r.capacity)
      .sort((a, b) => (a.eventDate < b.eventDate ? -1 : 1))
      .map(recruitView);
  }
  function portalUrgentRecruits() {
    return portalVolunteerRecruits().filter((r) => r.isUrgent);
  }
  function portalThanks() {
    return all("thanksMessages")
      .filter((m) => m.volunteerId == null && !m.deleteFlag)
      .map((m) => ({ ...m, shokudo: shokudoByIdAny(m.shokudoId), shokudoName: shokudoName(m.shokudoId) }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }

  // =================================================================
  // ボランティア参加
  // =================================================================
  const entryById = (id) =>
    all("volunteerEntries").find((e) => e.entryId === Number(id) && !e.deleteFlag) || null;
  function entryView(e) {
    if (!e) return null;
    const recruit = recruitById(e.volunteerRecruitId);
    const profile = volunteerProfileByUserId(e.volunteerId);
    const user = userById(e.volunteerId);
    return {
      ...e,
      recruit,
      recruitTitle: recruit ? recruit.title : "",
      volunteerProfile: profile,
      nickname: profile ? profile.nickname : "",
      postalCode: profile ? profile.postalCode : "",
      address: profile ? profile.address : "",
      userName: user ? user.name : "",
      phoneNumber: user ? user.phone : "",
      email: user ? user.email : "",
    };
  }
  function entrySearch(recruitTitle, userName, nickname) {
    const r = (recruitTitle || "").replace(/　/g, " ").trim();
    const u = (userName || "").replace(/　/g, " ").trim();
    const n = (nickname || "").replace(/　/g, " ").trim();
    return all("volunteerEntries")
      .filter((e) => !e.deleteFlag)
      .map(entryView)
      .filter((e) => contains(e.recruitTitle, r) && contains(e.userName, u) && contains(e.nickname, n))
      .sort((a, b) => a.volunteerRecruitId - b.volunteerRecruitId);
  }
  function participantsByRecruitId(recruitId) {
    return all("volunteerEntries")
      .filter((e) => e.volunteerRecruitId === Number(recruitId) && !e.deleteFlag)
      .map(entryView);
  }
  function isAlreadyApplied(recruitId, userId) {
    return all("volunteerEntries").some(
      (e) => e.volunteerRecruitId === Number(recruitId) && e.volunteerId === Number(userId) && !e.deleteFlag
    );
  }
  function createEntry(form, recruitId, userId) {
    if (isAlreadyApplied(recruitId, userId)) throw new Error("この募集にはすでに参加申込済みです");
    const recruits = all("volunteerRecruits");
    const ri = recruits.findIndex((r) => r.recruitId === Number(recruitId));
    if (ri < 0) throw new Error("募集情報が存在しません");
    const recruit = recruits[ri];
    const cc = recruit.currentCount || 0;
    if (cc >= recruit.capacity) throw new Error("定員に達しているため参加できません");

    const list = all("volunteerEntries");
    const rec = {
      entryId: nextId("volunteerEntries", "entryId"),
      volunteerRecruitId: Number(recruitId),
      volunteerId: Number(userId),
      attendedFlag: !!form.attendedFlag,
      healthCondition: form.healthCondition || "",
      remarks: form.remarks || "",
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
    };
    list.push(rec);
    save("volunteerEntries", list);

    recruit.currentCount = cc + 1;
    recruit.updatedAt = now();
    save("volunteerRecruits", recruits);

    // 管理者・職員へ応募通知
    notifyEntry(rec, userById(userId), recruit);
    return rec;
  }
  // スタンプ加算/減算 + バッジ再計算
  function recomputeBadge(userId, delta) {
    const profiles = all("volunteerProfiles");
    const pi = profiles.findIndex((p) => p.userId === Number(userId));
    if (pi < 0) return;
    let s = (profiles[pi].stamp || 0) + delta;
    if (s < 0) s = 0;
    profiles[pi].stamp = s;
    const b = currentBadge(s);
    profiles[pi].badgeId = b ? b.badgeId : null;
    profiles[pi].updatedAt = now();
    save("volunteerProfiles", profiles);
  }
  function updateEntry(id, form, isAdmin) {
    const list = all("volunteerEntries");
    const i = list.findIndex((e) => e.entryId === Number(id));
    if (i < 0) throw new Error("データが存在しません");
    const before = list[i].attendedFlag;
    list[i].remarks = form.remarks || "";
    list[i].healthCondition = form.healthCondition || list[i].healthCondition;
    if (isAdmin) {
      const after = !!form.attendedFlag;
      list[i].attendedFlag = after;
      if (!before && after) recomputeBadge(list[i].volunteerId, +1);
      if (before && !after) recomputeBadge(list[i].volunteerId, -1);
    }
    list[i].updatedAt = now();
    save("volunteerEntries", list);
    return list[i];
  }
  function updateAttendedFlag(id, attendedFlag) {
    const list = all("volunteerEntries");
    const i = list.findIndex((e) => e.entryId === Number(id));
    if (i < 0) throw new Error("データが存在しません");
    const before = list[i].attendedFlag;
    list[i].attendedFlag = !!attendedFlag;
    list[i].updatedAt = now();
    save("volunteerEntries", list);
    if (!before && attendedFlag) recomputeBadge(list[i].volunteerId, +1);
  }
  // キャンセル（人数据え置き）
  function cancelEntry(id) {
    const list = all("volunteerEntries");
    const i = list.findIndex((e) => e.entryId === Number(id));
    if (i >= 0) {
      list[i].deleteFlag = true;
      list[i].updatedAt = now();
      save("volunteerEntries", list);
    }
  }
  function decrementRecruitCount(recruitId) {
    const recruits = all("volunteerRecruits");
    const ri = recruits.findIndex((r) => r.recruitId === Number(recruitId));
    if (ri >= 0) {
      recruits[ri].currentCount = Math.max((recruits[ri].currentCount || 0) - 1, 0);
      recruits[ri].updatedAt = now();
      save("volunteerRecruits", recruits);
    }
  }
  // 削除（人数-1）
  function deleteEntry(id) {
    const e = entryById(id);
    if (!e) return;
    cancelEntry(id);
    decrementRecruitCount(e.volunteerRecruitId);
  }
  // ボランティア本人によるキャンセル（参加済みは不可、人数-1）
  function cancelByRecruitAndUser(recruitId, userId) {
    const list = all("volunteerEntries");
    const i = list.findIndex(
      (e) => e.volunteerRecruitId === Number(recruitId) && e.volunteerId === Number(userId) && !e.deleteFlag
    );
    if (i < 0) throw new Error("参加申込が存在しません");
    if (list[i].attendedFlag) throw new Error("参加済みのためキャンセルできません");
    list[i].deleteFlag = true;
    list[i].updatedAt = now();
    save("volunteerEntries", list);
    decrementRecruitCount(recruitId);
  }
  // ログインユーザーから参加フォーム初期値
  function entryFormFromUser(user) {
    if (!user) return { attendedFlag: false };
    const p = volunteerProfileByUserId(user.userId);
    return {
      name: user.name,
      phoneNumber: user.phone,
      email: user.email,
      nickname: p ? p.nickname : "",
      postalCode: p ? p.postalCode : "",
      address: p ? p.address : "",
      attendedFlag: false,
    };
  }

  // =================================================================
  // マイページ
  // =================================================================
  function myEntries(userId) {
    return all("volunteerEntries")
      .filter((e) => e.volunteerId === Number(userId) && e.attendedFlag && !e.deleteFlag)
      .map(entryView)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }
  function thanksForUser(userId) {
    return all("thanksMessages")
      .filter((m) => m.volunteerId === Number(userId) && !m.deleteFlag)
      .map((m) => ({ ...m, shokudo: shokudoByIdAny(m.shokudoId), shokudoName: shokudoName(m.shokudoId) }))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  function myShifts(userId) {
    return all("userShifts")
      .filter((s) => s.volunteerId === Number(userId))
      .sort((a, b) => a.dayId - b.dayId || a.timeId - b.timeId)
      .map((s) => ({ ...s, dayName: dayName(s.dayId), timeLabel: timeLabel(s.timeId) }));
  }
  function myRegions(userId) {
    return all("userAvailableRegions")
      .filter((r) => r.volunteerId === Number(userId))
      .map((r) => ({ ...r, regionName: regionName(r.regionId) }));
  }

  // =================================================================
  // 感謝メッセージ
  // =================================================================
  function createThanks(form) {
    const list = all("thanksMessages");
    const rec = {
      messageId: nextId("thanksMessages", "messageId"),
      shokudoId: Number(form.shokudoId),
      volunteerId: form.targetType === "PERSONAL" ? Number(form.volunteerId) : null,
      message: form.message,
      createdAt: now(),
      updatedAt: now(),
      imageUrl: form.imageUrl || null,
      deleteFlag: false,
    };
    list.push(rec);
    save("thanksMessages", list);
    notifyThanks(rec, form.targetType);
    return rec;
  }

  // =================================================================
  // 通知
  // =================================================================
  function pushNotification(n) {
    const list = all("notifications");
    list.push({
      notificationId: nextId("notifications", "notificationId"),
      isRead: false,
      notifiedAt: now(),
      readAt: null,
      createdByUserId: (currentUser() || {}).userId || null,
      createdAt: now(),
      updatedAt: now(),
      deleteFlag: false,
      foodRecruitId: null,
      volunteerRecruitId: null,
      messageId: null,
      ...n,
    });
    save("notifications", list);
  }
  function notifyThanks(msg, targetType) {
    if (targetType === "PERSONAL") {
      pushNotification({
        userId: msg.volunteerId,
        title: "💌 感謝メッセージが届きました",
        message: msg.message,
        notificationType: "THANKS",
        messageId: msg.messageId,
      });
    } else if (targetType === "ALL") {
      usersActive()
        .filter((u) => u.authority === 3)
        .forEach((u) =>
          pushNotification({
            userId: u.userId,
            title: "💌 感謝メッセージが届きました",
            message: msg.message,
            notificationType: "THANKS",
            messageId: msg.messageId,
          })
        );
    }
  }
  function notifyUrgentRecruit(recruit) {
    usersActive()
      .filter((u) => u.authority === 3)
      .forEach((u) =>
        pushNotification({
          userId: u.userId,
          title: "🚨 緊急募集のお知らせ",
          message: `「${recruit.title}」のボランティア募集が作成されました。\n詳細を確認してください。`,
          notificationType: "URGENT",
          volunteerRecruitId: recruit.recruitId,
        })
      );
  }
  function notifyEntry(entry, applicant, recruit) {
    const cc = recruit.currentCount || 0;
    const cap = recruit.capacity || 0;
    const remaining = Math.max(cap - cc, 0);
    usersActive()
      .filter((u) => u.authority === 1 || u.authority === 2)
      .forEach((u) =>
        pushNotification({
          userId: u.userId,
          title: `👤 ${applicant ? applicant.name : ""}さんが応募しました`,
          message: `${applicant ? applicant.name : ""}さんが「${recruit.title}」へ応募しました。\n現在 ${cc} / ${cap} 名です。\n残り ${remaining} 名です。`,
          notificationType: "VOLUNTEER",
          volunteerRecruitId: recruit.recruitId,
        })
      );
  }
  function unreadTop5(userId) {
    return all("notifications")
      .filter((n) => n.userId === Number(userId) && !n.isRead && !n.deleteFlag)
      .sort((a, b) => (a.notifiedAt < b.notifiedAt ? 1 : -1))
      .slice(0, 5);
  }
  function countUnread(userId) {
    return all("notifications").filter(
      (n) => n.userId === Number(userId) && !n.isRead && !n.deleteFlag
    ).length;
  }
  function notificationsByUser(userId) {
    return all("notifications")
      .filter((n) => n.userId === Number(userId) && !n.deleteFlag)
      .sort((a, b) => (a.notifiedAt < b.notifiedAt ? 1 : -1));
  }
  function markNotificationRead(id, userId) {
    const list = all("notifications");
    const i = list.findIndex(
      (n) => n.notificationId === Number(id) && n.userId === Number(userId) && !n.deleteFlag
    );
    if (i < 0) return null;
    list[i].isRead = true;
    list[i].readAt = now();
    list[i].updatedAt = now();
    save("notifications", list);
    return list[i];
  }
  // 通知「見る」→ 既読化 + 遷移先ファイルを返す
  function openNotification(id, userId) {
    const n = markNotificationRead(id, userId);
    if (!n) return "./portal.html";
    if ((n.notificationType === "URGENT" || n.notificationType === "VOLUNTEER") && n.volunteerRecruitId) {
      return `./volunteer-recruit-detail.html?id=${n.volunteerRecruitId}`;
    }
    if (n.notificationType === "THANKS") return "./mypage.html";
    return "./portal.html";
  }

  // =================================================================
  // 公開API
  // =================================================================
  global.TeamD = {
    init, reset, now, today: todayStr,
    setDraft, getDraft, clearDraft,
    // session
    login, currentUser, logout, isLogin, isAdmin, isStaff, isVolunteer, requireLogin, requireStaff,
    // masters
    days, times, regions, handoffMethods, handoffMethodById, foods, foodById, badges,
    dayName, timeLabel, regionName, currentBadge,
    // shokudo
    shokudosActive, shokudoById, shokudoByIdAny, shokudoName, shokudoNameMap, shokudoSearch,
    saveShokudo, deleteShokudo,
    // users
    usersActive, userById, userShokudoNameMap, searchUsers, emailExists,
    createUser, updateUser, deleteUser,
    // volunteer profiles
    volunteerProfileByUserId, volunteerProfileById, volunteerView,
    selectedShiftValues, selectedRegionIds, shiftTextByUser, regionTextByUser,
    searchVolunteers, createVolunteer, updateVolunteerByUserId, updateVolunteerById,
    deleteVolunteerById, deleteMyAccount,
    // food recruit
    foodRecruitsActive, foodRecruitById, recruitFoodByRecruitId, foodNameMap, quantityMap,
    foodRecruitView, createFoodRecruit, updateFoodRecruit, deleteFoodRecruit,
    // donation
    donationById, donationView, donationList, createDonation, updateDonation,
    markReceived, markUnreceived, deleteDonation,
    // volunteer recruit
    recruitsActiveAll, recruitById, recruitActiveById, recruitView, recruitList,
    createRecruit, updateRecruit, deleteRecruit, recruitEditForm,
    // portal
    portalFoodRecruits, portalVolunteerRecruits, portalUrgentRecruits, portalThanks,
    // entry
    entryById, entryView, entrySearch, participantsByRecruitId, isAlreadyApplied,
    createEntry, updateEntry, updateAttendedFlag, cancelEntry, deleteEntry,
    cancelByRecruitAndUser, entryFormFromUser,
    // mypage
    myEntries, thanksForUser, myShifts, myRegions,
    // thanks
    createThanks,
    // notification
    unreadTop5, countUnread, notificationsByUser, markNotificationRead, openNotification,
  };
})(window);
