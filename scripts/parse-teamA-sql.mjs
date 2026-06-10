/*
 * teamA「つばさ配送サービス」(tsubasa-delivery-app / sky_db) — SQL→seed.json 変換
 * ---------------------------------------------------------------------------
 * teamA.sql は素直なリテラル INSERT（複数行 VALUES）。本スクリプトで
 * 各 INSERT を解析し、列名 camelCase の JSON に変換して seed.json を生成する。
 *
 *   node scripts/parse-teamA-sql.mjs
 *   → public/team-apps/teamA/data/seed.json
 *
 * 値変換: NULL→null / TRUE,FALSE→真偽 / 数値→number / 'str'→string('' は ' に復元)
 * テーブル名: snake → camel（customer_allergens → customerAllergens）
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = resolve(__dirname, "../../team/teamA.sql");
const OUT_DIR = resolve(__dirname, "../public/team-apps/teamA/data");

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

function stripComments(sql) {
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
}

// 行 "(v1, v2, ...)" を、クォート・カッコを尊重して値配列へ
function splitValues(str) {
  const out = [];
  let cur = "";
  let inStr = false;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === "'") {
        if (str[i + 1] === "'") { cur += "'"; i++; }      // エスケープ ''
        else { inStr = false; cur += ch; }
      } else cur += ch;
    } else {
      if (ch === "'") { inStr = true; cur += ch; }
      else if (ch === ",") { out.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
  }
  if (cur.trim() !== "") out.push(cur.trim());
  return out;
}

function convert(raw) {
  const v = raw.trim();
  if (/^NULL$/i.test(v)) return null;
  if (/^TRUE$/i.test(v)) return true;
  if (/^FALSE$/i.test(v)) return false;
  if (/^'/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}

// "(...)" の塊を top-level で分割
function splitRows(body) {
  const rows = [];
  let depth = 0, inStr = false, start = -1;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === "'") {
        if (body[i + 1] === "'") i++;
        else inStr = false;
      }
      continue;
    }
    if (ch === "'") inStr = true;
    else if (ch === "(") { if (depth === 0) start = i + 1; depth++; }
    else if (ch === ")") { depth--; if (depth === 0) rows.push(body.slice(start, i)); }
  }
  return rows;
}

const sql = stripComments(readFileSync(SQL_PATH, "utf8"));

const seed = {};
const counts = {};
// INSERT INTO <t> ( <cols> ) VALUES <rows> ;
const re = /INSERT\s+INTO\s+([a-z_]+)\s*\(([^)]*)\)\s*VALUES\s*([\s\S]*?);/gi;
let m;
while ((m = re.exec(sql)) !== null) {
  const table = m[1];
  const cols = m[2].split(",").map((c) => camel(c.trim()));
  const rows = splitRows(m[3]);
  const key = camel(table);
  seed[key] = seed[key] || [];
  for (const row of rows) {
    const vals = splitValues(row);
    const obj = {};
    cols.forEach((c, i) => (obj[c] = convert(vals[i])));
    seed[key].push(obj);
  }
  counts[key] = seed[key].length;
}

seed.meta = { today: "2026-06-08", source: "teamA.sql (sky_db)" };

mkdirSync(OUT_DIR, { recursive: true });
const outPath = resolve(OUT_DIR, "seed.json");
writeFileSync(outPath, JSON.stringify(seed, null, 2), "utf8");
console.log("seed.json generated:", outPath);
console.table(counts);
