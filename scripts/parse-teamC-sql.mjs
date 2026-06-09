import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// teamC「進学ゼミナール松風」学習管理支援システムの SQL → seed.json 変換。
// CREATE TABLE は INSERT 正規表現に一致しないため自然にスキップされる。
// 各 INSERT は PK 列を明示的に含むため ID 採番は不要。CURRENT_TIMESTAMP は固定値に置換。

const SQL_PATH = join(homedir(), "axis-2026-app/team/teamC.sql");
const OUT = "public/team-apps/teamC/data/seed.json";
const NOW = "2026-06-09T10:00:00";

let sql = readFileSync(SQL_PATH, "utf8");
sql = sql.replace(/﻿/g, "").replace(/​/g, "");
sql = sql.replace(/--[^\n]*/g, ""); // 行コメント除去

const camel = (s) =>
  s
    .trim()
    .toLowerCase()
    .replace(/_([a-z])/g, (_, c) => c.toUpperCase());

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
          if (body[i + 1] === "'") {
            s += "'";
            i++;
          } else {
            i++;
            break;
          }
        } else s += body[i];
      }
      out.push(s);
      while (i < body.length && body[i] !== ",") i++;
      i++;
    } else {
      let tok = "";
      while (i < body.length && body[i] !== ",") {
        tok += body[i];
        i++;
      }
      i++;
      out.push(parseBare(tok));
    }
  }
  return out;
}

function readTuples(str, startIdx) {
  const tuples = [];
  let i = startIdx;
  while (i < str.length) {
    while (i < str.length && /[\s,]/.test(str[i])) i++;
    if (str[i] !== "(") break;
    let depth = 0,
      inStr = false,
      start = i;
    for (; i < str.length; i++) {
      const ch = str[i];
      if (inStr) {
        if (ch === "'") {
          if (str[i + 1] === "'") i++;
          else inStr = false;
        }
      } else if (ch === "'") inStr = true;
      else if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
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
    cols.forEach((c, idx) => {
      o[c] = vals[idx] === undefined ? null : vals[idx];
    });
    return o;
  });
  tables[table] = (tables[table] || []).concat(rows);
}

const seed = {
  users: tables.t_user || [],
  classrooms: tables.t_classroom || [],
  subjects: tables.t_subject || [],
  scheduleSlots: tables.t_scheduleslot || [],
  eventPeriods: tables.t_event_period || [],
  teachers: tables.t_teacher || [],
  students: tables.t_student || [],
  teacherSubjects: tables.t_teachersubject || [],
  teacherShifts: tables.t_teachershift || [],
  studentShifts: tables.t_studentshift || [],
  reservations: tables.t_reservation || [],
  classRecords: tables.t_classrecord || [],
  homeworks: tables.t_homework || [],
  notices: tables.t_notice || [],
  grades: tables.t_grade || [],
};

mkdirSync("public/team-apps/teamC/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(seed, null, 2));

console.log("=== 件数 ===");
Object.entries(seed).forEach(([k, v]) => console.log(`${k}: ${v.length}`));
console.log("\n=== サンプル ===");
for (const k of [
  "users",
  "classrooms",
  "subjects",
  "scheduleSlots",
  "teachers",
  "students",
  "reservations",
  "classRecords",
  "homeworks",
  "notices",
  "grades",
]) {
  console.log(`${k}[0]:`, JSON.stringify(seed[k][0]));
}
