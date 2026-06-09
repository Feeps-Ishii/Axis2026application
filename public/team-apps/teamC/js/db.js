/*
 * teamC「進学ゼミナール松風」学習管理支援システム — 擬似データ層
 * --------------------------------------------------------------
 * 本物の Spring + MySQL の代わりに seed.json を localStorage に取り込み、
 * JSON データだけでアプリを動かします。ページからは window.TeamC 経由。
 *
 *   <script src="./js/db.js"></script>
 *   <script>
 *     TeamC.init().then(() => { ... });
 *   </script>
 *
 * seed.json のキー（エンティティ名キャメル）:
 *   users            t_user        (userId, loginId, password, role[教室長/講師/生徒], name, email, tel, isActive)
 *   classrooms       t_classroom   (classroomId, roomName, roomType[教室/自習室], capacity, location, isActive)
 *   subjects         t_subject     (subjectId, subjectName, subjectType)
 *   scheduleSlots    t_scheduleslot(scheduleSlotId, dayOfWeek[月..日], slotName, slotType[通常講習/イベント講習], startTime, endTime, isActive)
 *   eventPeriods     t_event_period(eventPeriodId, eventName, startDate, endDate, isActive)
 *   teachers         t_teacher     (teacherId, userId, classroomId, teacherName, teacherKana, tel, email, hireDate, ...)
 *   students         t_student     (studentId, userId, classroomId, studentName, studentKana, schoolName, grade, guardian*, lessonStyle, targetSchool, ...)
 *   teacherSubjects  t_teachersubject (teacherSubjectId, teacherId, subjectId)
 *   teacherShifts    t_teachershift(shiftId, teacherId, scheduleSlotId, shiftDate, isAvailable, memo)
 *   studentShifts    t_studentshift(studentShiftId, studentId, scheduleSlotId, subjectId, lessonStyle, priority)
 *   reservations     t_reservation (reservationId, studentId, teacherId, subjectId, classroomId, scheduleSlotId, reservationRole, reservationDate, lessonType, status, memo)
 *   classRecords     t_classrecord (classRecordId, reservationId, classroomId, scheduleSlotId, teacherId, studentId, subjectId, classDate, content, comment, unit, understandingLevel, ...)
 *   homeworks        t_homework    (homeworkId, classRecordId, studentId, teacherId, subjectId, homeworkContent, dueDate, submissionStatus, resultStatus, score, comment)
 *   notices          t_notice      (noticeId, userId, title, content, targetRole, isPublished, startDate, endDate)
 *   grades           t_grade       (gradeId, studentId, subjectId, testType, testName, testDate, score, maxScore, deviationValue, testRank, ...)
 */
(function (global) {
  "use strict";

  const NS = "teamC:";
  const SEED_FLAG = NS + "seeded";

  const COLLECTIONS = [
    "users", "classrooms", "subjects", "scheduleSlots", "eventPeriods",
    "teachers", "students", "teacherSubjects", "teacherShifts", "studentShifts",
    "reservations", "classRecords", "homeworks", "notices", "grades",
  ];

  function read(key, fallback) {
    try {
      const raw = global.localStorage.getItem(NS + key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    global.localStorage.setItem(NS + key, JSON.stringify(value));
    return value;
  }
  async function init(force) {
    if (!force && global.localStorage.getItem(SEED_FLAG)) return;
    const res = await fetch("./data/seed.json", { cache: "no-store" });
    const seed = await res.json();
    COLLECTIONS.forEach((c) => write(c, seed[c] || []));
    global.localStorage.setItem(SEED_FLAG, "1");
  }
  function reset() {
    Object.keys(global.localStorage)
      .filter((k) => k.indexOf(NS) === 0)
      .forEach((k) => global.localStorage.removeItem(k));
  }
  function nextId(list, idField) {
    return list.reduce((mx, x) => Math.max(mx, x[idField] || 0), 0) + 1;
  }
  const num = (v) => (v == null ? null : Number(v));

  const TeamC = {
    init, reset,

    // ---- コレクション参照 ----
    users: () => read("users", []),
    classrooms: () => read("classrooms", []),
    subjects: () => read("subjects", []),
    scheduleSlots: () => read("scheduleSlots", []),
    eventPeriods: () => read("eventPeriods", []),
    teachers: () => read("teachers", []),
    students: () => read("students", []),
    teacherSubjects: () => read("teacherSubjects", []),
    teacherShifts: () => read("teacherShifts", []),
    studentShifts: () => read("studentShifts", []),
    reservations: () => read("reservations", []),
    classRecords: () => read("classRecords", []),
    homeworks: () => read("homeworks", []),
    notices: () => read("notices", []),
    grades: () => read("grades", []),

    // ---- 単体取得 ----
    user: (id) => TeamC.users().find((x) => x.userId === num(id)) || null,
    classroom: (id) => TeamC.classrooms().find((x) => x.classroomId === num(id)) || null,
    subject: (id) => TeamC.subjects().find((x) => x.subjectId === num(id)) || null,
    slot: (id) => TeamC.scheduleSlots().find((x) => x.scheduleSlotId === num(id)) || null,
    teacher: (id) => TeamC.teachers().find((x) => x.teacherId === num(id)) || null,
    student: (id) => TeamC.students().find((x) => x.studentId === num(id)) || null,
    reservation: (id) => TeamC.reservations().find((x) => x.reservationId === num(id)) || null,
    classRecord: (id) => TeamC.classRecords().find((x) => x.classRecordId === num(id)) || null,
    homework: (id) => TeamC.homeworks().find((x) => x.homeworkId === num(id)) || null,
    notice: (id) => TeamC.notices().find((x) => x.noticeId === num(id)) || null,
    grade: (id) => TeamC.grades().find((x) => x.gradeId === num(id)) || null,

    teacherByUserId: (uid) => TeamC.teachers().find((t) => t.userId === num(uid)) || null,
    studentByUserId: (uid) => TeamC.students().find((s) => s.userId === num(uid)) || null,

    // ---- 結合ビュー ----
    reservationView: (id) => {
      const r = TeamC.reservation(id); if (!r) return null;
      return TeamC._resView(r);
    },
    _resView: (r) => ({
      reservation: r,
      student: TeamC.student(r.studentId),
      teacher: TeamC.teacher(r.teacherId),
      subject: TeamC.subject(r.subjectId),
      classroom: TeamC.classroom(r.classroomId),
      slot: TeamC.slot(r.scheduleSlotId),
    }),
    classRecordView: (id) => {
      const c = TeamC.classRecord(id); if (!c) return null;
      return {
        record: c,
        student: TeamC.student(c.studentId),
        teacher: TeamC.teacher(c.teacherId),
        subject: TeamC.subject(c.subjectId),
        classroom: TeamC.classroom(c.classroomId),
        slot: TeamC.slot(c.scheduleSlotId),
      };
    },
    teacherView: (id) => {
      const t = TeamC.teacher(id); if (!t) return null;
      const subjIds = TeamC.teacherSubjects()
        .filter((ts) => ts.teacherId === num(id))
        .map((ts) => ts.subjectId);
      return {
        teacher: t,
        user: TeamC.user(t.userId),
        classroom: TeamC.classroom(t.classroomId),
        subjects: subjIds.map((sid) => TeamC.subject(sid)).filter(Boolean),
      };
    },
    studentView: (id) => {
      const s = TeamC.student(id); if (!s) return null;
      return { student: s, user: TeamC.user(s.userId), classroom: TeamC.classroom(s.classroomId) };
    },

    // ---- フィルタ ----
    reservationsByStudent: (sid) =>
      TeamC.reservations().filter((r) => r.studentId === num(sid)),
    reservationsByDate: (date) =>
      TeamC.reservations().filter((r) => String(r.reservationDate) === date),
    reservationsByTeacher: (tid) =>
      TeamC.reservations().filter((r) => r.teacherId === num(tid)),
    reservationsInRange: (fromDate, toDate) =>
      TeamC.reservations().filter(
        (r) => r.reservationDate >= fromDate && r.reservationDate <= toDate
      ),
    classRecordsByStudent: (sid) =>
      TeamC.classRecords().filter((c) => c.studentId === num(sid)),
    homeworksByStudent: (sid) =>
      TeamC.homeworks().filter((h) => h.studentId === num(sid)),
    gradesByStudent: (sid) =>
      TeamC.grades().filter((g) => g.studentId === num(sid)),
    studentsByClassroom: (cid) =>
      TeamC.students().filter((s) => s.classroomId === num(cid)),
    teachersByClassroom: (cid) =>
      TeamC.teachers().filter((t) => t.classroomId === num(cid)),
    activeStudents: () => TeamC.students().filter((s) => s.isActive),
    activeTeachers: () => TeamC.teachers().filter((t) => t.isActive),
    // 公開中かつ対象ロールに合致するお知らせ
    noticesFor: (role) =>
      TeamC.notices().filter(
        (n) => n.isPublished &&
          (n.targetRole === "全員" || !role || n.targetRole === role)
      ),

    // ---- 予約 availability カスケード（ReservationController API 相当） ----
    // ログインユーザーの所属校舎の location 文字列
    userLocation: (user) => {
      if (!user) return "";
      if (user.role === "教室長" || user.role === "講師") {
        const t = TeamC.teacherByUserId(user.userId);
        if (t) { const c = TeamC.classroom(t.classroomId); return c ? c.location : ""; }
        // 教室長で teacher 行が無い場合は最初の校舎を既定とする
        return "";
      }
      if (user.role === "生徒" || user.role === "生徒・保護者") {
        const s = TeamC.studentByUserId(user.userId);
        if (s) { const c = TeamC.classroom(s.classroomId); return c ? c.location : ""; }
      }
      return "";
    },
    // 対象日が有効なイベント講習期間内なら期間オブジェクト、なければ null
    eventPeriodFor: (date) => {
      if (!date) return null;
      return TeamC.eventPeriods().find(
        (e) => e.isActive && String(e.startDate) <= date && String(e.endDate) >= date
      ) || null;
    },
    slotMode: (date) => (TeamC.eventPeriodFor(date) ? "event" : "normal"),
    slotsByMode: (mode) =>
      TeamC.scheduleSlots().filter(
        (s) => s.isActive &&
          s.slotType === (mode === "event" ? "イベント講習" : "通常講習")
      ),
    availableClassrooms: (lessonType, location) =>
      TeamC.classrooms().filter(
        (c) => c.isActive &&
          c.location === location &&
          (lessonType === "自習室" ? c.roomType === "自習室" : c.roomType === "教室")
      ),
    // 対面: 講師シフト(勤務可)がある日付。自習室: 制限なし→[]（呼び出し側で任意日扱い）
    availableDates: (lessonType, location) => {
      if (lessonType === "自習室") return [];
      const dates = new Set();
      TeamC.teacherShifts().forEach((sh) => {
        if (!sh.isAvailable || !sh.shiftDate) return;
        const t = TeamC.teacher(sh.teacherId);
        if (!t) return;
        const c = TeamC.classroom(t.classroomId);
        if (c && c.location === location) dates.add(String(sh.shiftDate));
      });
      return Array.from(dates).sort();
    },
    // その日・校舎で選べるコマ
    availableSlots: (lessonType, date, location) => {
      if (lessonType === "自習室") {
        const mode = TeamC.slotMode(date);
        const dow = TeamC.dayOfWeek(date);
        return TeamC.slotsByMode(mode).filter((s) => s.dayOfWeek === dow);
      }
      const slotIds = new Set();
      TeamC.teacherShifts().forEach((sh) => {
        if (!sh.isAvailable || String(sh.shiftDate) !== date) return;
        const t = TeamC.teacher(sh.teacherId);
        if (!t) return;
        const c = TeamC.classroom(t.classroomId);
        if (c && c.location === location) slotIds.add(sh.scheduleSlotId);
      });
      return TeamC.scheduleSlots().filter((s) => slotIds.has(s.scheduleSlotId));
    },
    // その日・コマ・校舎で勤務可能な講師
    availableTeachers: (date, scheduleSlotId, location) => {
      const ids = new Set();
      TeamC.teacherShifts().forEach((sh) => {
        if (!sh.isAvailable) return;
        if (String(sh.shiftDate) !== date) return;
        if (sh.scheduleSlotId !== num(scheduleSlotId)) return;
        const t = TeamC.teacher(sh.teacherId);
        if (!t) return;
        const c = TeamC.classroom(t.classroomId);
        if (c && c.location === location) ids.add(sh.teacherId);
      });
      return TeamC.teachers().filter((t) => ids.has(t.teacherId));
    },
    // 講師の担当科目
    availableSubjects: (teacherId) => {
      const ids = TeamC.teacherSubjects()
        .filter((ts) => ts.teacherId === num(teacherId))
        .map((ts) => ts.subjectId);
      return TeamC.subjects().filter((s) => ids.includes(s.subjectId));
    },

    // ---- 更新系（localStorage 保存） ----
    addReservation: (res) => {
      const list = TeamC.reservations();
      res.reservationId = nextId(list, "reservationId");
      res.status = res.status || "予約済";
      res.createdAt = res.createdAt || isoNow();
      res.updatedAt = isoNow();
      list.push(res); write("reservations", list); return res;
    },
    updateReservation: (id, patch) => {
      const list = TeamC.reservations();
      const r = list.find((x) => x.reservationId === num(id));
      if (r) { Object.assign(r, patch, { updatedAt: isoNow() }); write("reservations", list); }
      return r;
    },
    deleteReservation: (id) => {
      write("reservations", TeamC.reservations().filter((x) => x.reservationId !== num(id)));
    },
    addClassRecord: (rec) => {
      const list = TeamC.classRecords();
      rec.classRecordId = nextId(list, "classRecordId");
      rec.createdAt = rec.createdAt || isoNow(); rec.updatedAt = isoNow();
      list.push(rec); write("classRecords", list); return rec;
    },
    updateClassRecord: (id, patch) => {
      const list = TeamC.classRecords();
      const r = list.find((x) => x.classRecordId === num(id));
      if (r) { Object.assign(r, patch, { updatedAt: isoNow() }); write("classRecords", list); }
      return r;
    },
    deleteClassRecord: (id) => {
      write("classRecords", TeamC.classRecords().filter((x) => x.classRecordId !== num(id)));
    },
    addHomework: (hw) => {
      const list = TeamC.homeworks();
      hw.homeworkId = nextId(list, "homeworkId");
      hw.submissionStatus = hw.submissionStatus || "未提出";
      hw.createdAt = hw.createdAt || isoNow(); hw.updatedAt = isoNow();
      list.push(hw); write("homeworks", list); return hw;
    },
    updateHomework: (id, patch) => {
      const list = TeamC.homeworks();
      const h = list.find((x) => x.homeworkId === num(id));
      if (h) { Object.assign(h, patch, { updatedAt: isoNow() }); write("homeworks", list); }
      return h;
    },
    deleteHomework: (id) => {
      write("homeworks", TeamC.homeworks().filter((x) => x.homeworkId !== num(id)));
    },
    addGrade: (g) => {
      const list = TeamC.grades();
      g.gradeId = nextId(list, "gradeId");
      g.maxScore = g.maxScore || 100;
      g.createdAt = g.createdAt || isoNow(); g.updatedAt = isoNow();
      list.push(g); write("grades", list); return g;
    },
    updateGrade: (id, patch) => {
      const list = TeamC.grades();
      const g = list.find((x) => x.gradeId === num(id));
      if (g) { Object.assign(g, patch, { updatedAt: isoNow() }); write("grades", list); }
      return g;
    },
    deleteGrade: (id) => {
      write("grades", TeamC.grades().filter((x) => x.gradeId !== num(id)));
    },
    addNotice: (n) => {
      const list = TeamC.notices();
      n.noticeId = nextId(list, "noticeId");
      n.isPublished = n.isPublished == null ? 1 : n.isPublished;
      n.createdAt = n.createdAt || isoNow(); n.updatedAt = isoNow();
      list.push(n); write("notices", list); return n;
    },
    updateNotice: (id, patch) => {
      const list = TeamC.notices();
      const n = list.find((x) => x.noticeId === num(id));
      if (n) { Object.assign(n, patch, { updatedAt: isoNow() }); write("notices", list); }
      return n;
    },
    deleteNotice: (id) => {
      write("notices", TeamC.notices().filter((x) => x.noticeId !== num(id)));
    },
    // 生徒・講師（ユーザーも併せて作成/更新）
    addStudent: (stu, userPatch) => {
      const users = TeamC.users();
      const uid = nextId(users, "userId");
      users.push(Object.assign({ userId: uid, role: "生徒", isActive: 1 }, userPatch || {}));
      write("users", users);
      const list = TeamC.students();
      stu.studentId = nextId(list, "studentId");
      stu.userId = uid; stu.isActive = 1;
      stu.createdAt = isoNow(); stu.updatedAt = isoNow();
      list.push(stu); write("students", list); return stu;
    },
    updateStudent: (id, patch) => {
      const list = TeamC.students();
      const s = list.find((x) => x.studentId === num(id));
      if (s) { Object.assign(s, patch, { updatedAt: isoNow() }); write("students", list); }
      return s;
    },
    deleteStudent: (id) => {
      const list = TeamC.students();
      const s = list.find((x) => x.studentId === num(id));
      if (s) { s.isActive = 0; s.updatedAt = isoNow(); write("students", list); }
      return s;
    },
    addTeacher: (tch, userPatch, subjectIds) => {
      const users = TeamC.users();
      const uid = nextId(users, "userId");
      users.push(Object.assign({ userId: uid, role: "講師", isActive: 1 }, userPatch || {}));
      write("users", users);
      const list = TeamC.teachers();
      tch.teacherId = nextId(list, "teacherId");
      tch.userId = uid; tch.isActive = 1;
      tch.createdAt = isoNow(); tch.updatedAt = isoNow();
      list.push(tch); write("teachers", list);
      TeamC.setTeacherSubjects(tch.teacherId, subjectIds || []);
      return tch;
    },
    updateTeacher: (id, patch) => {
      const list = TeamC.teachers();
      const t = list.find((x) => x.teacherId === num(id));
      if (t) { Object.assign(t, patch, { updatedAt: isoNow() }); write("teachers", list); }
      return t;
    },
    deleteTeacher: (id) => {
      const list = TeamC.teachers();
      const t = list.find((x) => x.teacherId === num(id));
      if (t) { t.isActive = 0; t.updatedAt = isoNow(); write("teachers", list); }
      return t;
    },
    setTeacherSubjects: (teacherId, subjectIds) => {
      const remain = TeamC.teacherSubjects().filter((ts) => ts.teacherId !== num(teacherId));
      (subjectIds || []).forEach((sid) => {
        remain.push({
          teacherSubjectId: nextId(remain, "teacherSubjectId"),
          teacherId: num(teacherId), subjectId: num(sid),
        });
      });
      write("teacherSubjects", remain);
    },

    // ---- 擬似セッション ----
    login: (loginId, password) => {
      const u = TeamC.users().find(
        (x) => x.loginId === loginId && String(x.password) === String(password) && x.isActive
      );
      if (!u) return null;
      write("session", { user: u });
      return u;
    },
    session: () => read("session", null),
    loginUser: () => { const s = TeamC.session(); return s ? s.user : null; },
    logout: () => global.localStorage.removeItem(NS + "session"),
    requireLogin: () => {
      const s = TeamC.session();
      if (!s) { global.location.href = "./login.html"; return null; }
      return s;
    },
    isManager: (u) => u && u.role === "教室長",
    isTeacher: (u) => u && u.role === "講師",
    isStaff: (u) => u && (u.role === "教室長" || u.role === "講師"),
    isStudent: (u) => u && (u.role === "生徒" || u.role === "生徒・保護者"),
    // ログイン生徒の studentId（生徒ロール時）
    loginStudentId: () => {
      const u = TeamC.loginUser();
      if (!u) return null;
      const s = TeamC.studentByUserId(u.userId);
      return s ? s.studentId : null;
    },

    // ---- 確認画面への一時データ受け渡し（sessionStorage） ----
    setPending: (kind, obj) => {
      global.sessionStorage.setItem(NS + "pending:" + kind, JSON.stringify(obj));
      return obj;
    },
    getPending: (kind) => {
      try {
        const raw = global.sessionStorage.getItem(NS + "pending:" + kind);
        return raw ? JSON.parse(raw) : null;
      } catch (e) { return null; }
    },
    clearPending: (kind) => global.sessionStorage.removeItem(NS + "pending:" + kind),

    // デモ上の「今日」（seed の予約日が 2026年6月中心）
    today: () => "2026-06-09",
  };

  function isoNow() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return (
      d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
      "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
    );
  }

  // ---- 表示ヘルパ ----
  TeamC.esc = (s) =>
    String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  TeamC.fmtDate = (d) => (d ? String(d).slice(0, 10).replace(/-/g, "/") : "");
  TeamC.fmtDateTime = (iso) =>
    iso ? String(iso).replace("T", " ").slice(0, 16).replace(/-/g, "/") : "";
  TeamC.fmtTime = (t) => (t ? String(t).slice(0, 5) : "");
  const DOW = ["日", "月", "火", "水", "木", "金", "土"];
  // "YYYY-MM-DD" → 短い曜日（月..日）。ReservationController.toShortJapaneseDayOfWeek 相当。
  TeamC.dayOfWeek = (date) => {
    if (!date) return "";
    const dt = new Date(String(date).slice(0, 10) + "T00:00:00");
    return DOW[dt.getDay()];
  };
  TeamC.fmtJpDate = (date) => {
    if (!date) return "";
    const dt = new Date(String(date).slice(0, 10) + "T00:00:00");
    return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日（${DOW[dt.getDay()]}）`;
  };
  // コマのラベル「月曜 通常1限（13:00〜14:20）」。ReservationController.createSlotLabel 相当。
  TeamC.slotLabel = (slot) => {
    if (!slot) return "";
    return slot.dayOfWeek + "曜 " + slot.slotName +
      "（" + TeamC.fmtTime(slot.startTime) + "〜" + TeamC.fmtTime(slot.endTime) + "）";
  };

  global.TeamC = TeamC;
})(window);
