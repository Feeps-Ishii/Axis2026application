import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// teamG「ひだまり支援センター 事務作業管理システム」(訪問介護) SQL → seed.json。
// CREATE TABLE + INSERT。INSERT は PK 列を明示（最後の staff だけ省略→auto採番）。
// NOW() / CURRENT_TIMESTAMP はデモ用固定値(基準日 2026-06-09)に置換。

const SQL_PATH = join(homedir(), "axis-2026-app/team/teamG.sql");
const OUT = "public/team-apps/teamG/data/seed.json";
const NOW = "2026-06-09T09:00:00";

let sql = readFileSync(SQL_PATH, "utf8");
sql = sql.replace(/﻿/g, "").replace(/​/g, "");
sql = sql.replace(/--[^\n]*/g, "");

// teamG の SQL 列名は既に camelCase なので小文字化せずそのまま使う（スネークケースなら従来通り変換）
const camel = (s) => {
  const t = s.trim();
  return /_/.test(t) ? t.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase()) : t;
};

function parseBare(tok) {
  const t = tok.trim();
  if (/^null$/i.test(t)) return null;
  if (/^now\(\)$/i.test(t)) return NOW;
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
  const table = m[1];
  const cols = m[2].split(",").map(camel);
  const tuples = readTuples(sql, re.lastIndex);
  const rows = tuples.map((vals) => {
    const o = {};
    cols.forEach((c, idx) => { o[c] = vals[idx] === undefined ? null : vals[idx]; });
    return o;
  });
  tables[table] = (tables[table] || []).concat(rows);
}

function withId(rows, idField) {
  let max = (rows || []).reduce((mx, r) => Math.max(mx, Number(r[idField]) || 0), 0);
  return (rows || []).map((r) => {
    if (r[idField] == null) r[idField] = ++max;
    return r;
  });
}

const seed = {
  userAccounts: withId(tables.userAccount, "accountId"),
  staff: withId(tables.staff, "staffId"),
  careUsers: withId(tables.careUser, "careUserId"),
  helperAssignments: withId(tables.helperAssignment, "assignmentId"),
  servicePlans: withId(tables.servicePlan, "planId"),
  visitRecords: withId(tables.visitRecord, "visitRecordId"),
  familyReports: withId(tables.familyReport, "familyReportId"),
  handoverNotes: withId(tables.handoverNote, "handoverNoteId"),
  familyContacts: withId(tables.familyContact, "contactId"),
  approvals: withId(tables.approval, "approvalId"),
  billingSupports: withId(tables.billingSupport, "billingId"),
  notifications: withId(tables.notification, "notificationId"),
};

mkdirSync("public/team-apps/teamG/data", { recursive: true });
writeFileSync(OUT, JSON.stringify(seed, null, 2));

console.log("=== 件数 ===");
Object.entries(seed).forEach(([k, v]) => console.log(`${k}: ${v.length}`));
console.log("\n=== サンプル ===");
for (const k of Object.keys(seed)) console.log(`${k}[0]:`, JSON.stringify(seed[k][0]));
