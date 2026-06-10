/*
 * teamD「まちのこ食卓プロジェクト」(子ども食堂 支援ポータル) — seed 生成スクリプト
 * ------------------------------------------------------------------------
 * teamD.sql は INSERT ... SELECT による「行ジェネレータ」方式（UNION ALL で
 * 1〜400 の連番 n を作って CASE 式で値を量産する）で書かれており、素朴な
 * INSERT パーサでは解析できない。さらに マスタ系テーブル
 * (T_FOOD / M_DAY / M_AVAILABLE_TIME / M_REGIONS / M_HANDOFF_METHODS) は
 * teamD.sql に含まれていない（別管理）。
 *
 * そこで本スクリプトは「SQLの生成ロジックを JS で忠実に再現」し、
 * 不足するマスタは entity / controller の参照値（食品ID 1-82、曜日 1-7、
 * 時間ID 10-17、地域ID 40-44=九州JISコード、受渡方法 1-5）に合わせて合成する。
 *
 *   node scripts/parse-teamD-sql.mjs
 *   → public/team-apps/teamD/data/seed.json
 *
 * 列名は camelCase（db.js / 画面の参照名に合わせる）。日時は固定 TODAY 基準。
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../public/team-apps/teamD/data");

const TODAY = "2026-06-10"; // デモ固定日（db.js の today() と一致させる）
const NOW = `${TODAY} 09:00:00`;

// ---- 日付ユーティリティ（SQL の DATE_ADD 相当） ----
function addDays(baseYmd, days) {
  const [y, m, d] = baseYmd.split(/[ T]/)[0].split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
function addDaysTime(baseYmd, time, days) {
  return `${addDays(baseYmd, days)} ${time}`;
}
const pad = (n, len) => String(n).padStart(len, "0");

// =====================================================================
// マスタ：曜日 / 時間 / 地域 / 受渡方法 / 食品
// =====================================================================
const days = [
  { dayId: 1, dayName: "月" },
  { dayId: 2, dayName: "火" },
  { dayId: 3, dayName: "水" },
  { dayId: 4, dayName: "木" },
  { dayId: 5, dayName: "金" },
  { dayId: 6, dayName: "土" },
  { dayId: 7, dayName: "日" },
].map((d) => ({ ...d, createdAt: NOW }));

// 時間ID 10-17（T_USER_SHIFT は 10 + (n%8) を使用）
const TIME_SLOTS = {
  10: ["09:00", "11:00"],
  11: ["11:00", "13:00"],
  12: ["13:00", "15:00"],
  13: ["15:00", "17:00"],
  14: ["17:00", "19:00"],
  15: ["10:00", "12:00"],
  16: ["12:00", "14:00"],
  17: ["14:00", "16:00"],
};
const availableTimes = Object.entries(TIME_SLOTS).map(([id, [s, e]]) => ({
  timeId: Number(id),
  startTime: s,
  endTime: e,
  createdAt: NOW,
}));

// 地域：JIS都道府県コード（40-44 が seed で使用される。九州+沖縄を用意）
const regions = [
  [40, "福岡県"],
  [41, "佐賀県"],
  [42, "長崎県"],
  [43, "熊本県"],
  [44, "大分県"],
  [45, "宮崎県"],
  [46, "鹿児島県"],
  [47, "沖縄県"],
].map(([regionId, regionName]) => ({ regionId, regionName, createdAt: NOW }));

// 受渡方法 1-5
const handoffMethods = [
  [1, "直接持ち込み"],
  [2, "宅配便"],
  [3, "郵送"],
  [4, "食堂で受け取り"],
  [5, "その他"],
].map(([methodId, methodName]) => ({
  methodId,
  methodName,
  createdAt: NOW,
  updatedAt: NOW,
  deleteFlag: false,
}));

// 食品マスタ food_id 1-82（recruit_food が ((fr-1)%82)+1 で参照）
const FOOD_BASE = [
  ["白米", "kg"], ["玄米", "kg"], ["もち米", "kg"], ["食パン", "斤"], ["菓子パン", "個"],
  ["うどん（乾麺）", "袋"], ["そば（乾麺）", "袋"], ["スパゲッティ", "袋"], ["中華麺", "袋"], ["そうめん", "束"],
  ["じゃがいも", "kg"], ["玉ねぎ", "kg"], ["にんじん", "本"], ["キャベツ", "玉"], ["大根", "本"],
  ["白菜", "玉"], ["ほうれん草", "袋"], ["小松菜", "袋"], ["ピーマン", "袋"], ["なす", "袋"],
  ["トマト", "個"], ["きゅうり", "本"], ["かぼちゃ", "個"], ["さつまいも", "kg"], ["ねぎ", "束"],
  ["りんご", "個"], ["みかん", "kg"], ["バナナ", "房"], ["いちご", "パック"], ["ぶどう", "房"],
  ["鶏むね肉", "kg"], ["鶏もも肉", "kg"], ["豚こま切れ", "kg"], ["豚バラ肉", "kg"], ["牛こま切れ", "kg"],
  ["ひき肉", "kg"], ["ウインナー", "袋"], ["ベーコン", "パック"], ["ハム", "パック"], ["鶏卵", "パック"],
  ["鮭（切り身）", "切れ"], ["さば（切り身）", "切れ"], ["ぶり（切り身）", "切れ"], ["ちりめんじゃこ", "袋"], ["かまぼこ", "本"],
  ["豆腐", "丁"], ["納豆", "パック"], ["油揚げ", "枚"], ["牛乳", "本"], ["ヨーグルト", "個"],
  ["チーズ", "個"], ["ツナ缶", "缶"], ["さば缶", "缶"], ["コーン缶", "缶"], ["トマト缶", "缶"],
  ["みかん缶", "缶"], ["大豆水煮", "袋"], ["ひじき（乾物）", "袋"], ["わかめ（乾物）", "袋"], ["切り干し大根", "袋"],
  ["カレールー", "箱"], ["シチュールー", "箱"], ["レトルトカレー", "個"], ["パスタソース", "袋"], ["インスタント味噌汁", "袋"],
  ["カップ麺", "個"], ["乾燥スープ", "袋"], ["米", "kg"], ["小麦粉", "kg"], ["片栗粉", "袋"],
  ["砂糖", "kg"], ["塩", "袋"], ["醤油", "本"], ["味噌", "kg"], ["みりん", "本"],
  ["料理酒", "本"], ["サラダ油", "本"], ["ごま油", "本"], ["ケチャップ", "本"], ["マヨネーズ", "本"],
  ["お茶（ペットボトル）", "本"], ["ジュース", "本"],
];
const foods = [];
for (let i = 1; i <= 82; i++) {
  const [name, unit] = FOOD_BASE[(i - 1) % FOOD_BASE.length];
  foods.push({ foodId: i, foodName: name, credit: unit, createdAt: NOW, updatedAt: NOW });
}

// =====================================================================
// 1. ユーザー（管理者1 / 食堂職員5 / ボランティア400）
//    ボランティア n は user_id = 6 + n （プロフィール側がこの前提で参照）
// =====================================================================
const userAccounts = [];
userAccounts.push({
  userId: 1, name: "テスト管理者", phone: "09011112222", email: "admin@example.com",
  pass: "password", authority: 1, createdAt: NOW, updatedAt: NOW, deleteFlag: false,
});
const STAFF_NAMES = ["田中美咲", "佐藤花子", "山本拓也", "中村あかり", "井上健太"];
for (let i = 0; i < 5; i++) {
  userAccounts.push({
    userId: 2 + i, name: STAFF_NAMES[i], phone: `0902000000${i + 1}`,
    email: `shokudo0${i + 1}@example.com`, pass: "password", authority: 2,
    createdAt: NOW, updatedAt: NOW, deleteFlag: false,
  });
}
for (let n = 1; n <= 400; n++) {
  userAccounts.push({
    userId: 6 + n, name: `ボランティア${n}さん`, phone: `080${pad(n, 8)}`,
    email: `volunteer${n}@example.com`, pass: "password", authority: 3,
    createdAt: NOW, updatedAt: NOW, deleteFlag: false,
  });
}

// =====================================================================
// 2. 食堂
// =====================================================================
const SHOKUDO_DATA = [
  ["まちのこ食堂", "地域のみんなで夕食を囲む、あたたかい子ども食堂です。", "8100001", "福岡県福岡市中央区天神1-1-1", "09012345678", "https://example.com/machinoko", "https://instagram.com/machinoko"],
  ["さくら食堂", "季節の野菜を使った家庭的なメニューを提供しています。", "8120011", "福岡県福岡市博多区博多駅前2-2-2", "09023456789", "https://example.com/sakura", "https://instagram.com/sakura"],
  ["ひまわり食堂", "放課後の子どもたちが安心して過ごせる居場所です。", "8140001", "福岡県福岡市早良区百道3-3-3", "09034567890", "https://example.com/himawari", "https://instagram.com/himawari"],
  ["みんなの食卓", "親子で参加できる地域交流型の食堂です。", "8150033", "福岡県福岡市南区大橋4-4-4", "09045678901", "https://example.com/minna", "https://instagram.com/minna"],
  ["チューリップ食堂", "食事と学習支援をあわせて行っています。", "8190002", "福岡県福岡市西区姪浜5-5-5", "09056789012", "https://example.com/tulip", "https://instagram.com/tulip"],
];
const shokudos = SHOKUDO_DATA.map((r, i) => ({
  shokudoId: i + 1, shokudoName: r[0], description: r[1], postalCode: r[2],
  address: r[3], phoneNumber: r[4], hpUrl: r[5], snsUrl: r[6],
  createdAt: NOW, updatedAt: NOW, deleteFlag: false,
}));

// 3. 食堂管理（職員 user_id 2-6 を食堂 1-5 に割当）
const kodomoShokudos = [];
for (let i = 1; i <= 5; i++) {
  kodomoShokudos.push({ managementId: i, shokudoId: i, userId: i + 1, createdAt: NOW, updatedAt: NOW, deleteFlag: false });
}

// 4. 画像・バッジ
const images = [
  { imageId: 1, imageName: "ブロンズバッジ", imagePath: "./images/badge/bronze.png", createdAt: NOW, updatedAt: NOW, deleteFlag: false },
  { imageId: 2, imageName: "シルバーバッジ", imagePath: "./images/badge/silver.png", createdAt: NOW, updatedAt: NOW, deleteFlag: false },
  { imageId: 3, imageName: "ゴールドバッジ", imagePath: "./images/badge/gold.png", createdAt: NOW, updatedAt: NOW, deleteFlag: false },
];
const badges = [
  { badgeId: 1, badgeName: "ブロンズ", requiredCount: 5, imageId: 1, imagePath: "./images/badge/bronze.png", createdAt: NOW, updatedAt: NOW, deleteFlag: false },
  { badgeId: 2, badgeName: "シルバー", requiredCount: 10, imageId: 2, imagePath: "./images/badge/silver.png", createdAt: NOW, updatedAt: NOW, deleteFlag: false },
  { badgeId: 3, badgeName: "ゴールド", requiredCount: 20, imageId: 3, imagePath: "./images/badge/gold.png", createdAt: NOW, updatedAt: NOW, deleteFlag: false },
];

// 5. ボランティアプロフィール 400件（volunteer_id 1-400, user_id 6+n）
const OCCUPATIONS = { 0: "会社員", 1: "学生", 2: "主婦・主夫", 3: "自営業", 4: "パート" };
const volunteerProfiles = [];
for (let n = 1; n <= 400; n++) {
  const stamp = n % 25;
  let badgeId = null;
  if (n % 25 >= 20) badgeId = 3;
  else if (n % 25 >= 10) badgeId = 2;
  else if (n % 25 >= 5) badgeId = 1;
  volunteerProfiles.push({
    volunteerId: n,
    userId: 6 + n,
    nickname: `ニック${n}`,
    postalCode: `810${pad(n, 4)}`,
    address: `福岡県福岡市テスト区${n}丁目`,
    age: 18 + (n % 45),
    occupation: OCCUPATIONS[n % 5],
    cookingExperience: n % 2 === 0,
    nutritionist: n % 20 === 0,
    childcare: n % 15 === 0,
    driverLicense: n % 3 === 0,
    stamp,
    badgeId,
    evaluationComment: `地域活動に前向きに参加されています。No.${n}`,
    createdAt: NOW,
    updatedAt: NOW,
    deleteFlag: false,
  });
}

// 6. 食材募集 400件（food_recruit_id 1-400）
const FR_TITLE = {
  0: "お米を募集しています", 1: "カレー用野菜募集", 2: "朝食用パン募集",
  3: "缶詰・レトルト食品募集", 4: "お菓子と飲み物募集", 5: "調味料・日用品食材募集",
};
const FR_REMARKS = {
  0: "未開封で賞味期限に余裕があるものをお願いします。",
  1: "子どもたちの夕食で使用します。",
  2: "常温保存できるものを歓迎します。",
  3: "",
};
const foodRecruits = [];
for (let n = 1; n <= 400; n++) {
  let status = 1;
  if (n % 20 === 0) status = 2;
  else if (n % 33 === 0) status = 3;
  foodRecruits.push({
    foodRecruitId: n,
    shokudoId: ((n - 1) % 5) + 1,
    title: `${FR_TITLE[n % 6]} ${n}`,
    deadlineDate: addDaysTime("2026-07-01", "00:00:00", n % 120),
    remarks: FR_REMARKS[n % 4],
    createdAt: NOW,
    updatedAt: NOW,
    status,
    deleteFlag: false,
  });
}

// 7. 募集食品 400件（1 食材募集につき 1 件）
const RF_UNIT = { 0: "kg", 1: "個", 2: "袋", 3: "箱", 4: "本" };
const recruitFoods = [];
for (let fr = 1; fr <= 400; fr++) {
  recruitFoods.push({
    recruitFoodId: fr,
    foodRecruitId: fr,
    foodId: ((fr - 1) % 82) + 1,
    requiredQuantity: `${5 + (fr % 30)}${RF_UNIT[fr % 5]}`,
    createdAt: NOW,
    updatedAt: NOW,
    deleteFlag: false,
  });
}

// 8. 食材寄付 80件（status 1=未受取 2=受取済み）
const FD_REMARKS = { 0: "未開封です。", 1: "直接持ち込み予定です。", 2: "受け渡し日時は相談可能です。" };
const FD_UNIT = { 0: "kg", 1: "個", 2: "袋", 3: "箱" };
const foodDonations = [];
for (let n = 1; n <= 80; n++) {
  foodDonations.push({
    donationId: n,
    foodRecruitId: ((n - 1) % 400) + 1,
    volunteerId: 6 + ((n - 1) % 400) + 1, // T_VOLUNTEER_PROFILE.user_id を参照
    expirationDate: addDays("2026-08-01", n % 90),
    methodId: ((n - 1) % 5) + 1,
    remarks: FD_REMARKS[n % 3],
    createdAt: NOW,
    updatedAt: NOW,
    status: n % 4 === 0 ? 2 : 1,
    deleteFlag: false,
    quantity: 3 + (n % 20),
    unit: FD_UNIT[n % 4],
  });
}

// 9. 寄付明細 80件
const donationDetails = foodDonations.map((d, i) => ({
  donationDetailId: i + 1,
  donationId: d.donationId,
  recruitFoodId: d.foodRecruitId,
  quantity: `${d.quantity}${d.unit}`,
}));

// 10. 参加可能地域 400件
const REGION_BY_MOD = { 0: 40, 1: 41, 2: 42, 3: 43, 4: 44 };
const userAvailableRegions = [];
for (let n = 1; n <= 400; n++) {
  userAvailableRegions.push({
    availableRegionsId: n,
    volunteerId: 6 + n, // user_id
    regionId: REGION_BY_MOD[n % 5],
    createdAt: NOW,
    updatedAt: NOW,
  });
}

// 11. 対応可能日時 400件
const userShifts = [];
for (let n = 1; n <= 400; n++) {
  userShifts.push({
    shiftId: n,
    volunteerId: 6 + n, // user_id
    dayId: ((n - 1) % 7) + 1,
    timeId: 10 + (n % 8),
    createdAt: NOW,
    updatedAt: NOW,
  });
}

// 12. ボランティア募集 80件（status 0=募集中 1=締切 2=中止）
const VR_TITLE = {
  0: "調理補助ボランティア募集", 1: "受付スタッフ募集", 2: "配膳サポート募集",
  3: "子どもの見守り募集", 4: "片付けボランティア募集",
};
const volunteerRecruits = [];
for (let n = 1; n <= 80; n++) {
  let status = 0;
  if (n % 15 === 0) status = 1;
  else if (n % 22 === 0) status = 2;
  volunteerRecruits.push({
    recruitId: n,
    shokudoId: ((n - 1) % 5) + 1,
    title: `${VR_TITLE[n % 5]} ${n}`,
    eventDate: addDaysTime("2026-07-10", "10:00:00", n),
    endDate: addDaysTime("2026-07-10", "15:00:00", n),
    location: `福岡市内会場 ${((n - 1) % 5) + 1}`,
    description: "当日の運営を一緒に支えてくださる方を募集しています。",
    capacity: 5 + (n % 10),
    deadline: addDaysTime("2026-07-01", "23:59:59", n),
    isUrgent: n % 10 === 0,
    currentCount: n % 5,
    status,
    createdAt: NOW,
    updatedAt: NOW,
    deleteFlag: false,
  });
}

// 13. ボランティア参加 150件
const VE_REMARKS = {
  0: "調理補助経験があります。", 1: "初参加です。よろしくお願いします。",
  2: "受付対応ができます。", 3: "",
};
const volunteerEntries = [];
for (let n = 1; n <= 150; n++) {
  volunteerEntries.push({
    entryId: n,
    volunteerRecruitId: ((n - 1) % 80) + 1,
    volunteerId: 6 + ((n - 1) % 400) + 1, // user_id
    attendedFlag: n % 3 === 0,
    healthCondition: "良好",
    remarks: VE_REMARKS[n % 4],
    createdAt: NOW,
    updatedAt: NOW,
    deleteFlag: false,
  });
}

// 14. 感謝メッセージ 100件（個人宛 volunteerId 設定）
const TM_MSG = {
  0: "本日はご協力ありがとうございました。子どもたちもとても喜んでいました。",
  1: "温かいご支援のおかげで、無事に食事を届けることができました。",
  2: "初めての参加とは思えないほど丁寧に対応していただきました。",
  3: "食材のご寄付、本当に助かりました。大切に使わせていただきます。",
  4: "また次回もぜひよろしくお願いいたします。",
};
const thanksMessages = [];
let messageId = 1;
for (let n = 1; n <= 100; n++) {
  thanksMessages.push({
    messageId: messageId++,
    shokudoId: ((n - 1) % 5) + 1,
    volunteerId: 6 + ((n - 1) % 400) + 1, // 個人宛（user_id）
    message: TM_MSG[n % 5],
    createdAt: NOW,
    updatedAt: NOW,
    imageUrl: null,
    deleteFlag: false,
  });
}
// 全体向け（volunteerId=null）感謝メッセージ。message-post の ALL 投稿で作られる種別。
// seed には個人宛しか無くポータルの感謝パネルが空になるため、デモ用に数件追加。
const PORTAL_TM = [
  [1, "地域の皆さまのご寄付・ご参加のおかげで、今月も無事に開催できました。心より感謝申し上げます。"],
  [2, "たくさんの新鮮なお野菜をいただきました。子どもたちの笑顔がいっぱいの食卓になりました。"],
  [3, "ボランティアの皆さん、いつも温かいご支援をありがとうございます。これからもよろしくお願いします。"],
  [4, "親子で楽しく過ごせる時間を作っていただき感謝しています。また遊びに来てくださいね。"],
  [5, "皆さまのご協力に支えられて活動を続けられています。本当にありがとうございます。"],
];
PORTAL_TM.forEach(([shokudoId, msg], i) => {
  thanksMessages.push({
    messageId: messageId++,
    shokudoId,
    volunteerId: null,
    message: msg,
    createdAt: addDaysTime(TODAY, "10:00:00", -(PORTAL_TM.length - i)),
    updatedAt: NOW,
    imageUrl: null,
    deleteFlag: false,
  });
});

// 15. 通知 100件
const NT_TITLE = { 0: "感謝メッセージが届きました", 1: "緊急募集のお知らせ", 2: "食材募集のお知らせ" };
const NT_MSG = {
  0: "あなたへの感謝メッセージが投稿されました。",
  1: "近くの食堂で緊急のボランティア募集があります。",
  2: "新しい食材募集が登録されました。",
};
const NT_TYPE = { 0: "THANKS", 1: "URGENT", 2: "INFO" };
const notifications = [];
for (let n = 1; n <= 100; n++) {
  notifications.push({
    notificationId: n,
    userId: 6 + ((n - 1) % 400) + 1,
    title: NT_TITLE[n % 3],
    message: NT_MSG[n % 3],
    notificationType: NT_TYPE[n % 3],
    foodRecruitId: n % 3 === 2 ? ((n - 1) % 400) + 1 : null,
    volunteerRecruitId: n % 3 === 1 ? ((n - 1) % 80) + 1 : null,
    messageId: n % 3 === 0 ? ((n - 1) % 100) + 1 : null,
    isRead: n % 4 === 0,
    notifiedAt: NOW,
    readAt: n % 4 === 0 ? NOW : null,
    createdByUserId: 1,
    createdAt: NOW,
    updatedAt: NOW,
    deleteFlag: false,
  });
}

const seed = {
  meta: { today: TODAY, generatedFrom: "teamD.sql (procedural) + synthesized masters" },
  // マスタ
  days,
  availableTimes,
  regions,
  handoffMethods,
  foods,
  images,
  badges,
  // 基本データ
  userAccounts,
  shokudos,
  kodomoShokudos,
  volunteerProfiles,
  // 食材
  foodRecruits,
  recruitFoods,
  foodDonations,
  donationDetails,
  // ボランティア
  volunteerRecruits,
  volunteerEntries,
  userShifts,
  userAvailableRegions,
  // 感謝・通知
  thanksMessages,
  notifications,
};

mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, "seed.json");
writeFileSync(outPath, JSON.stringify(seed, null, 2), "utf8");

const counts = Object.fromEntries(
  Object.entries(seed)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => [k, v.length])
);
console.log("seed.json generated:", outPath);
console.table(counts);
