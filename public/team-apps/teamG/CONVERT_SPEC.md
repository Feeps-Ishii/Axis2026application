# teamG 変換仕様（サブエージェント共通）

「ひだまり支援センター 事務作業管理システム」(訪問介護 / teamG_project) の Spring/Thymeleaf 画面を
**静的HTML+JS** に変換し、`window.TeamG`(js/db.js) + localStorage で動かす。Vercel/iframe 前提。

## 入出力
- 元テンプレート: `~/axis-2026-app/team/teamG/src/main/resources/templates/helps/<NAME>.html`
- 出力先: `~/axis-2026-app/Axis2026application/public/team-apps/teamG/<file>.html`
- **各HTMLは自己完結**。`<head>` で `<link rel="stylesheet" href="./css/style.css">`（元 `@{/css/style.css}` 相当, 全画面共通の巨大CSS。コピー済み）。
- 元テンプレに `<style>`/`<script>` があれば**そのまま保持**。`@{/css/style.css}`→`./css/style.css`、`@{/images/x}`→`./images/x`。
- フラグメントは存在しない。各ページが `<header class="site-header">`(ログインユーザ名+ログアウト) と `<main>` と `<footer>` を**インラインで持つ**。元のヘッダー markup をそのまま残す。

## ページ骨格（共通）
元の構造を保ったまま、Thymeleaf を JS 描画に置換:
```html
<body class="...(元のbodyクラスを保持)">
  <header class="site-header"> …元のヘッダー（ユーザ名 span は id 付与して JS で埋める）…
     <form class="logout-form" onsubmit="return false;"><button type="submit" class="logout-button" onclick="TeamG.logout()">ログアウト</button></form>
  </header>
  <main ...> …本文… </main>
  <footer class="footer"><small>© 2026 TeamG ひだまり支援センター</small></footer>
  <script src="./js/db.js"></script>
  <script>
    TeamG.init().then(function () {
      const sess = TeamG.requireLogin(); if (!sess) return;
      if (!TeamG.requireRole(sess, [/* 許可ロール */])) return;  // 必要な画面のみ
      // ヘッダーのユーザ名を埋める（例）
      // …本文描画…
    });
  </script>
</body>
```
- ログアウト: 元の `<form th:action="@{/logout}" method="post">` は `onclick="TeamG.logout()"` のボタンに（`TeamG.logout()` がセッション破棄→login.html）。
- ヘッダーのユーザ名 `${session.loginUserName}` 等 → `TeamG.session().loginUserName`（家族画面は「○○様のご家族」）。

## ロール（roleType）と遷移先
- 1=管理者(admin)→admin_dashboard / 2=スタッフ・ヘルパー(helper)→helper_dashboard / 3=利用者・家族(family)→careuser_dashboard。
- `TeamG.homeUrl(roleType)` を使う。`TeamG.requireRole(sess,[1])` 等で権限ガード（不足は login.html へ＝元 `redirect:/login`）。
- 元の `redirect:/login` ガードはこのモックでも login.html へ。

## ファイル名対応表（リンク先・フラット命名）
- 認証/共通: login.html / complete.html
- ダッシュボード: admin_dashboard.html(admindashboard) / helper_dashboard.html(helperdashboard) / careuser_dashboard.html(careuserdashboard)
- 利用者: careuser_list.html / careuser_detail.html / careuser_edit.html / careuser_register.html
- スタッフ: staff_list.html / staff_detail.html / staff_edit.html / staff_register.html
- プラン: plan_list.html(planlist) / plan_detail.html(plandetail) / plan_edit.html(planedit) / plan_register.html(planregist)
- 訪問報告: visitreport_list.html / visitreport_detail.html
- 全報告登録: report_register.html(reportregist) / report_confirm.html(reportconfirm)
- 請求: billing.html
- 家族報告: familyreport_list.html / familyreport_detail.html / familyreport_edit.html
- 未承認報告: unapproval_report_list.html(unapprovalreportlist)
- 承認: approval.html
- 申し送り: handover_list.html / handover_detail.html
- 家族連絡: familycontact_list.html / familycontact_detail.html

URL → .html 読み替え（PathVariable/RequestParam はクエリへ）。主要対応:
- `/admin/careuser/list`→careuser_list / `/admin/careuser/detail/{id}`→careuser_detail.html?careUserId= / `/admin/careuser/edit/{id}`→careuser_edit.html?careUserId= / `/admin/careuser/register`→careuser_register
- `/admin/staff/list`→staff_list / `/admin/staff/detail/{id}`→staff_detail.html?staffId= / `/admin/staff/edit/{id}`→staff_edit.html?staffId= / `/admin/staff/register`→staff_register
- `/plans`→plan_list / `/plans/detail/{id}`→plan_detail.html?planId= / `/plans/update/{id}`→plan_edit.html?planId= / `/plans/register`→plan_register
- `/visitreport/list`→visitreport_list / `/visitreport/detail/{id}`→visitreport_detail.html?visitRecordId=
- `/allreport/regist`→report_register / 確認→report_confirm
- `/billing`→billing
- `/family/reports`→familyreport_list / `/family/reports/{id}`→familyreport_detail.html?familyReportId= / `/family/reports/{id}/edit`→familyreport_edit.html?familyReportId=
- `/family-reports/unapproved`→unapproval_report_list / `/family-reports/{id}/approval`→approval.html?familyReportId=
- `/helper/handovers`→handover_list / `/helper/handovers/{id}`→handover_detail.html?handoverNoteId=
- `/helper/familycontacts`(+`/admin/familycontacts`)→familycontact_list / `/helper/familycontacts/{id}`(+admin)→familycontact_detail.html?contactId=

## ステータス・ラベル（厳密準拠）
- approvalStatus(visitRecord/approval): 1=未承認, 2=承認済み, 3=差し戻し。`TeamG.approvalLabel(n)`。
- importance: high=高, normal/middle=中, low/row=低（家族フォームは低に "row" を使う）。`TeamG.importanceLabel(s)`。
- familyContact.confirmStatus は **Boolean**(true=確認済み/false=未確認)。`TeamG.confirmLabel(b)`。handoverNote.confirmStatus は **文字列** 'unconfirmed'/'confirmed'。
- gender: 登録/編集フォームは Integer(1=男性,2=女性,3=その他)。DB/表示は文字列。`TeamG.GENDER_MAP`。
- 利用者負担=feeAmount×0.1, 保険請求=feeAmount×0.9（`TeamG.userCharge/insuranceCharge`）。
- 日付: visitDate "2026-06-03"、startTime/endTime/nextVisitDate "2026-06-03 09:00:00"。`fmtDate`(yyyy/MM/dd), `fmtDateTime`, `fmtTime`(HH:mm), 入力用 `toDateInput`/`toTimeInput`/`toLocalInput`。

## 入力→確認→完了 / 一覧の動き
- ページネーション: 元はサーバ側 or JS。一覧テンプレ内の既存ページングJS（dashboard等）はそのまま保持してよい。サーバページングの一覧（visitreport/familyreport/unapproval）は **全件描画でよい**（件数が少ない）。`currentPage/totalPages` 表示は簡略化可。
- complete.html: クエリ `?title=&message=&backUrl=&backText=&dashboardUrl=&dashboardText=` で表示（または sessionStorage 下書き 'complete'）。各登録/更新/削除の完了後はこの complete.html に必要パラメータを付けて遷移。
- 全報告登録: report_register（入力, 担当利用者=`TeamG.assignedCareUsers(staffId)`, プラン=`TeamG.plans()`(active)）→ `TeamG.setDraft('allReport', form)` → report_confirm（`getDraft`表示）→「登録」`TeamG.registerAllReport(draft, staffId)` → complete(type=create, back=visitreport_list, dashboard=helper_dashboard)。「修正」で入力へ戻る。
- 利用者登録: careuser_register（バリデーション, パスワード一致, `TeamG.loginIdExists`）→ `TeamG.careUserRegister(form)` → complete。編集: careuser_edit → `TeamG.careUserUpdate(careUserObj,userObj)` → complete。削除/停止: careuser_list の各行ボタン → `TeamG.careUserDelete(id)` / `careUserStop(id)`。
- スタッフ登録: staff_register → `TeamG.staffRegister(form)`。編集: staff_edit（担当割当 assigned/unassigned, main指定）→ `TeamG.staffUpdate(staffObj,userObj,assignedCsv,mainCsv)`。退職: staff_detail/list → `TeamG.staffDelete(id)`。
- プラン: plan_register→`planRegister`、plan_edit→`planUpdate`、一覧の停止/開始→`planSetActive(id,false/true)`、削除→`planDelete(id)`（`planVisitCount(id)>0`なら削除不可エラー表示）。
- 承認: approval（`TeamG.familyReportDetailByRole(id,1,null,null)` 表示）→「承認」`TeamG.approveReport(id, sess.staffId)` / 「差戻し」(理由必須)`TeamG.rejectReport(id, reason, sess.staffId)` → unapproval_report_list へ。
- 家族報告編集(差戻し再提出, ヘルパー): familyreport_edit → `TeamG.resubmitFamilyReport(id, form, sess.staffId)` → helper_dashboard。
- 申し送り詳細/家族連絡詳細を開くと確認済みになる（`handoverDetailByRole`/`familyContactDetail` が副作用で更新）。

## TeamG API（抜粋, js/db.js 参照）
- セッション: `session()`/`login(id,pw)`/`logout()`/`requireLogin()`/`requireRole(sess,roles[])`/`homeUrl(roleType)`
- 表示: `esc`,`fmtDate`,`fmtDateTime`,`fmtTime`,`toDateInput`,`toTimeInput`,`toLocalInput`,`approvalLabel`,`importanceLabel`,`confirmLabel`,`GENDER_MAP`,`ROLE_LABEL`
- マスタ: `staffList/staff/staffName`,`careUsers/careUser/careUserName`,`plans/plan/planName`,`assignedCareUsers/unassignedCareUsers(staffId)`,`assignedHelpers/assignedHelperStaff(careUserId)`,`isAssigned`
- ダッシュボード: `countUnapprovedReports()`,`countUnconfirmedContactsForStaff(staffId)`,`unapprovedReportListForDashboard()`(行:{visitRecordId,visitDate,careUserName,staffName}),`unconfirmedContactListForDashboard(staffId)`,`unreadFamilyContactsForHelper(staffId)`,`rejectedFamilyReportsForHelper(staffId)`,`latestFamilyReportForCareUser(careUserId)`,`sendFamilyContact(senderCareUserId,form{receiverValue,contactCategory,importance,contactContent})`
- 訪問報告: `searchVisitReports(roleType,staffId,{careUserName,visitDate,helperName})`,`visitReportDetail(visitRecordId,roleType,staffId)`(フルvisitRecord+名前),`registerAllReport(draft,staffId)`
- 請求: `billingList(startDate,endDate)`(行に feeAmount/userChargeAmount/insuranceChargeAmount)
- 家族報告: `familyReportListByRole(kw,roleType,staffId,careUserId)`,`familyReportDetailByRole(id,roleType,staffId,careUserId)`(rejectReason含),`unapprovalReportList(kw,visitDate,serviceContent)`,`approveReport(id,staffId)`,`rejectReport(id,reason,staffId)`,`resubmitFamilyReport(id,form,staffId)`,`familyReportView(f)`
- 申し送り: `handoverListByRole(kw,importance,roleType,staffId)`,`handoverDetailByRole(id,roleType,staffId)`
- 家族連絡: `familyContactsForHelper(staffId)`,`familyContactDetail(contactId,staffId)`
- プラン: `searchActivePlans(kw)`,`searchStoppedPlans(kw)`,`planRegister/planUpdate/planSetActive/planDelete/planVisitCount`,`userCharge/insuranceCharge(fee)`
- 利用者: `searchCareUsers(kw,isActive)`,`loginIdExists(loginId)`,`careUserRegister/careUserUpdate/careUserStop/careUserDelete`
- スタッフ: `searchStaff(kw,roleType,isActive)`,`staffRole(staffObj)`,`loginStaffName(accountId)`,`staffRegister/staffUpdate/staffDelete`
- 下書き: `setDraft/getDraft/clearDraft`

## 注意
- 文字列は必ず `TeamG.esc()` でエスケープ。
- 元テンプレの CSS クラス・構造・body クラスを忠実に保持（巨大CSSはクラス依存）。
- `unapprovalreportlist_old.html` は変換不要（未使用）。
- PDF/CSV出力ボタンは擬似（CSVは簡易生成して `Blob` ダウンロード、PDFは alert か無効化でよい）。
- 写真アップロードは擬似（input表示のみ、保存しない）。
- 参考: 既に変換済みの `login.html` / `complete.html` と同じ流儀に合わせる。
