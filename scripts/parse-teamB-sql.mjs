// teamB（さくら野診療所 clinicmanager）SQL → seed.json 変換パーサ
//   入力 : ~/axis-2026-app/team/teamB.sql
//   出力 : public/team-apps/teamB/data/seed.json
//
// 対応するSQL構文:
//   - INSERT INTO t (cols) VALUES (...),(...);（複数行・PK明示/省略の自動採番）
//   - NULL / TRUE / FALSE / 数値 / '文字列'
//   - NOW() / CURRENT_DATE
//   - DATE_SUB(CURRENT_DATE|NOW(), INTERVAL n DAY|MONTH|YEAR)
//   - DATE_ADD(CURRENT_DATE|NOW(), INTERVAL n DAY|MONTH|YEAR)
//   - スカラサブクエリ (SELECT col FROM table WHERE whereCol = value) … 2パスで解決
//
// デモ基準日（CURRENT_DATE / NOW() の解決先）。db.js の TeamB.today() と必ず一致させること。
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = join(__dirname, "../../team/teamB.sql");
const OUT_PATH = join(__dirname, "../public/team-apps/teamB/data/seed.json");

const TODAY = "2026-06-11"; // ★ db.js と一致させる

// ---- テーブル定義（PK列・出力コレクション名） ----
const TABLES = {
  patients: { pk: "patient_id", coll: "patients" },
  patient_card_number_seq: { pk: "id", coll: "patientCardNumberSeq" },
  departments: { pk: "department_id", coll: "departments" },
  staffs: { pk: "staff_id", coll: "staffs" },
  appointments: { pk: "appointment_id", coll: "appointments" },
  medical_questionnaires: { pk: "questionnaire_id", coll: "medicalQuestionnaires" },
  symptoms: { pk: "symptom_id", coll: "symptoms" },
  questionnaire_symptoms: { pk: "questionnaire_symptom_id", coll: "questionnaireSymptoms" },
  medical_histories: { pk: "medical_history_id", coll: "medicalHistories" },
  questionnaire_medical_histories: { pk: "questionnaire_medical_history_id", coll: "questionnaireMedicalHistories" },
  questionnaire_allergies: { pk: "allergy_id", coll: "questionnaireAllergies" },
  questionnaire_medications: { pk: "medication_id", coll: "questionnaireMedications" },
  belonging_items: { pk: "item_id", coll: "belongingItems" },
  questionnaire_belongings: { pk: "questionnaire_belonging_id", coll: "questionnaireBelongings" },
  medical_records: { pk: "record_id", coll: "medicalRecords" },
  operation_logs: { pk: "log_id", coll: "operationLogs" },
};

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

// ---- 日付ユーティリティ（UTC正午基準でTZずれ回避） ----
function baseDate() {
  const [y, m, d] = TODAY.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}
function shift(date, n, unit, sign) {
  const dt = new Date(date.getTime());
  const k = sign * n;
  if (unit === "DAY") dt.setUTCDate(dt.getUTCDate() + k);
  else if (unit === "MONTH") dt.setUTCMonth(dt.getUTCMonth() + k);
  else if (unit === "YEAR") dt.setUTCFullYear(dt.getUTCFullYear() + k);
  return dt;
}
const fmtDate = (dt) =>
  `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
const fmtDateTime = (dt) => `${fmtDate(dt)} 00:00:00`;

// ---- 値トークンの変換 ----
function convVal(raw) {
  let tok = raw.trim();
  if (tok === "") return null;
  const up = tok.toUpperCase();
  if (up === "NULL") return null;
  if (up === "TRUE") return true;
  if (up === "FALSE") return false;
  if (up === "NOW()") return fmtDateTime(baseDate());
  if (up === "CURRENT_DATE" || up === "CURDATE()") return TODAY;
  if (tok[0] === "'") return tok.slice(1, -1).replace(/''/g, "'");

  let m = tok.match(/^DATE_(SUB|ADD)\s*\(\s*(CURRENT_DATE|NOW\(\))\s*,\s*INTERVAL\s+(\d+)\s+(DAY|MONTH|YEAR)\s*\)$/i);
  if (m) {
    const sign = m[1].toUpperCase() === "SUB" ? -1 : 1;
    const isNow = /NOW/i.test(m[2]);
    const dt = shift(baseDate(), Number(m[3]), m[4].toUpperCase(), sign);
    return isNow ? fmtDateTime(dt) : fmtDate(dt);
  }

  m = tok.match(/^\(\s*SELECT\s+(\w+)\s+FROM\s+(\w+)\s+WHERE\s+(\w+)\s*=\s*([\s\S]+?)\s*\)$/i);
  if (m) {
    return { __sub: { col: camel(m[1]), table: m[2], whereCol: camel(m[3]), whereVal: convVal(m[4]) } };
  }

  if (/^-?\d+(\.\d+)?$/.test(tok)) return Number(tok);
  return tok;
}

// ---- カンマ区切り（クォート・括弧ネストを尊重） ----
function splitTopLevel(s) {
  const out = [];
  let depth = 0, inStr = false, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      cur += c;
      if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === "(") { depth++; cur += c; continue; }
    if (c === ")") { depth--; cur += c; continue; }
    if (c === "," && depth === 0) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

// ---- VALUES部からトップレベルの行タプルを取り出す ----
function extractRows(valuesStr) {
  const rows = [];
  let depth = 0, inStr = false, cur = "";
  for (let i = 0; i < valuesStr.length; i++) {
    const c = valuesStr[i];
    if (inStr) {
      cur += c;
      if (c === "'") inStr = false;
      continue;
    }
    if (c === "'") { inStr = true; cur += c; continue; }
    if (c === "(") {
      depth++;
      if (depth === 1) { cur = ""; continue; }
      cur += c;
      continue;
    }
    if (c === ")") {
      depth--;
      if (depth === 0) { rows.push(cur); cur = ""; continue; }
      cur += c;
      continue;
    }
    if (depth >= 1) cur += c;
  }
  return rows;
}

// ---- 行コメント除去（クォート内の '--' は残す） ----
function stripLineComments(sql) {
  return sql
    .split("\n")
    .map((line) => {
      let inStr = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === "'") inStr = !inStr;
        else if (!inStr && c === "-" && line[i + 1] === "-") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

// ---- メイン ----
const sqlRaw = readFileSync(SQL_PATH, "utf8");
const sql = stripLineComments(sqlRaw);

const store = {}; // table -> rows[]
const counters = {}; // table -> next auto id
for (const t of Object.keys(TABLES)) { store[t] = []; counters[t] = 1; }

// INSERT文を順に処理
const insertRe = /INSERT\s+INTO\s+(\w+)\s*\(([\s\S]*?)\)\s*VALUES\s*([\s\S]*?);/gi;
let match;
while ((match = insertRe.exec(sql)) !== null) {
  const table = match[1];
  if (!TABLES[table]) continue;
  const cols = match[2].split(",").map((c) => c.trim());
  const camelCols = cols.map(camel);
  const pkCamel = camel(TABLES[table].pk);
  const hasPk = camelCols.includes(pkCamel);

  const rowTuples = extractRows(match[3]);
  for (const tuple of rowTuples) {
    const vals = splitTopLevel(tuple).map(convVal);
    if (vals.length !== camelCols.length) {
      throw new Error(`列数不一致: ${table} 期待${camelCols.length} 実際${vals.length}\n${tuple}`);
    }
    const row = {};
    camelCols.forEach((c, i) => { row[c] = vals[i]; });
    // PK採番
    if (hasPk && typeof row[pkCamel] === "number") {
      counters[table] = Math.max(counters[table], row[pkCamel] + 1);
    } else {
      row[pkCamel] = counters[table];
      counters[table] += 1;
    }
    store[table].push(row);
  }
}

// サブクエリ解決（2パス）
function resolveSub(sub) {
  const rows = store[sub.table] || [];
  const hit = rows.find((r) => r[sub.whereCol] === sub.whereVal);
  if (!hit) throw new Error(`サブクエリ解決失敗: ${JSON.stringify(sub)}`);
  const pkCamel = camel(TABLES[sub.table].pk);
  // SELECT対象列（pkなど）
  return hit[sub.col] !== undefined ? hit[sub.col] : hit[pkCamel];
}
for (const t of Object.keys(store)) {
  for (const row of store[t]) {
    for (const k of Object.keys(row)) {
      const v = row[k];
      if (v && typeof v === "object" && v.__sub) row[k] = resolveSub(v.__sub);
    }
  }
}

// 診察券番号トリガーの再現：card_number未設定の患者へ seq(10000開始) を採番（patient_id順）
const seqStart = (store.patient_card_number_seq[0]?.nextCardNumber) ?? 10000;
let nextCard = Number(seqStart);
store.patients
  .slice()
  .sort((a, b) => a.patientId - b.patientId)
  .forEach((p) => {
    if (p.cardNumber === null || p.cardNumber === undefined || p.cardNumber === "") {
      p.cardNumber = String(nextCard);
      nextCard += 1;
    }
  });
if (store.patient_card_number_seq[0]) store.patient_card_number_seq[0].nextCardNumber = nextCard;

// 出力（コレクション名へ）
const seed = { __today: TODAY };
for (const t of Object.keys(TABLES)) {
  seed[TABLES[t].coll] = store[t];
}

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(seed, null, 2), "utf8");

// サマリ
const summary = Object.keys(TABLES).map((t) => `${TABLES[t].coll}=${store[t].length}`).join(" ");
console.log("teamB seed.json 生成完了:", OUT_PATH);
console.log("today =", TODAY);
console.log(summary);
