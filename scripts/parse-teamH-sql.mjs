import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// teamH「進捗マルわかりシステム」(マルセイ精密工業) の SQL → seed.json 変換。
// SQL は CREATE TABLE + INSERT。INSERT は PK 列(AUTO_INCREMENT)を省略するため、
// テーブルごとに登録順で連番IDを採番する。CURRENT_TIMESTAMP / 省略された created_at は
// デモ用固定値(基準日 2026-06-09)に置換する。

const SQL_PATH = join(homedir(), "axis-2026-app/team/teamH.sql");
const OUT = "public/team-apps/teamH/data/seed.json";
const NOW = "2026-06-09T09:00:00"; // CURRENT_TIMESTAMP / created_at 既定の固定値（デモ基準日）

let sql = readFileSync(SQL_PATH, "utf8");
sql = sql.replace(/﻿/g, "").replace(/​/g, ""); // BOM/ゼロ幅スペース除去
sql = sql.replace(/--[^\n]*/g, ""); // SQL行コメント除去（VALUES間に挟まる）

const camel = (s) =>
  s.trim().toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function parseBare(tok) {
  const t = tok.trim();
  if (/^null$/i.test(t)) return null;
  if (/^current_timestamp$/i.test(t)) return NOW;
  if (/^true$/i.test(t)) return true;
  if (/^false$/i.test(t)) return false;
  if (/^-?\d+$/.test(t)) return Number(t);
  if (/^-?\d+\.\d+$/.test(t)) return Number(t);
  return t;
}

// タプル本体を型付き値の配列に分割（クォート文字列を尊重）
function splitTuple(body) {
  const out = [];
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i++;
    if (i >= body.length) break;
    if (body[i] === "'") {
      i++;
      let s = "";
      for (; i < body.length; i++) {
        if (body[i] === "'") {
          if (body[i + 1] === "'") { s += "'"; i++; }
          else { i++; break; }
        } else s += body[i];
      }
      out.push(s);
      while (i < body.length && body[i] !== ",") i++;
      i++;
    } else {
      let tok = "";
      while (i < body.length && body[i] !== ",") { tok += body[i]; i++; }
      i++;
      out.push(parseBare(tok));
    }
  }
  return out;
}

// VALUES 以降のタプル群を読む（次が '(' でなければ停止 → ';' で自然終了）
function readTuples(str, startIdx) {
  const tuples = [];
  let i = startIdx;
  while (i < str.length) {
    while (i < str.length && /[\s,]/.test(str[i])) i++;
    if (str[i] !== "(") break;
    let depth = 0, inStr = false, start = i;
    for (; i < str.length; i++) {
      const ch = str[i];
      if (inStr) {
        if (ch === "'") { if (str[i + 1] === "'") i++; else inStr = false; }
      } else if (ch === "'") inStr = true;
      else if (ch === "(") depth++;
      else if (ch === ")") { depth--; if (depth === 0) { i++; break; } }
    }
    tuples.push(splitTuple(str.slice(start + 1, i - 1)));
  }
  return tuples;
}

const tables = {};
const re = /INSERT\s+INTO\s+`?(\w+)`?\s*\(([^)]*)\)\s*VALUES/gi;
let m;
while ((m = re.exec(sql)) !== null) {
  const table = m[1].toLowerCase();
  const cols = m[2].split(",").map(camel);
  const tuples = readTuples(sql, re.lastIndex);
  const rows = tuples.map((vals) => {
    const o = {};
    cols.forEach((c, idx) => { o[c] = vals[idx] === undefined ? null : vals[idx]; });
    return o;
  });
  tables[table] = (tables[table] || []).concat(rows);
}

// 登録順で連番ID採番（PK列が無いテーブル用）+ 省略された created_at/updated_at を補完
function withId(rows, idField, start = 1) {
  return (rows || []).map((r, i) => {
    if (r[idField] == null) r[idField] = start + i;
    if (r.createdAt == null) r.createdAt = NOW;
    if (r.updatedAt == null) r.updatedAt = NOW;
    return r;
  });
}

const seed = {
  users: withId(tables.users, "userId"),
  machines: withId(tables.machines, "machineId"),
  workOrders: withId(tables.work_orders, "workOrderId"),
  workOrderProcesses: withId(tables.work_order_processes, "workOrderProcessId"),
  progressReports: withId(tables.progress_reports, "progressReportId"),
  progressReportProcesses: withId(tables.progress_report_processes, "progressReportProcessId"),
  handoverNotes: withId(tables.handover_notes, "handoverNoteId"),
  skillContents: withId(tables.skill_contents, "skillContentsId"),
  skillContentsFiles: withId(tables.skill_contents_files, "skillContentsFilesId"),
};

mkdirSync("public/team-apps/teamH/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(seed, null, 2));

console.log("=== 件数 ===");
Object.entries(seed).forEach(([k, v]) => console.log(`${k}: ${v.length}`));
console.log("\n=== サンプル ===");
for (const k of Object.keys(seed)) {
  console.log(`${k}[0]:`, JSON.stringify(seed[k][0]));
}
