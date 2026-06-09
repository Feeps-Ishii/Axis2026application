# teamH 変換仕様（サブエージェント共通）

「進捗マルわかりシステム」(マルセイ精密工業 / progress_maruwakari) の Spring/Thymeleaf 画面を
**静的HTML+JS** に変換し、`window.TeamH`(js/db.js) + localStorage で擬似的に動かす。Vercel/iframe 前提。

## 入出力
- 元テンプレート: `~/axis-2026-app/team/teamH/src/main/resources/templates/maruwakaries/<NAME>.html`
- 出力先: `~/axis-2026-app/Axis2026application/public/team-apps/teamH/<file>.html`
- **各HTMLは自己完結**。`<head>` で `<link rel="stylesheet" href="./css/common.css">`（元 commonCss 相当）。
  元テンプレの `<style>` 中身は**そのままコピーして保持**（重複した CSS 断片も気にせず移植してよい）。
- 元テンプレの画像パス `/maruwakari/images/xxx` は `./images/xxx` に直す。

## ページ骨格（管理画面=ヘッダー+サイドバー付き）
```html
<body>
  <div id="teamH-header"></div>
  <div class="layout">
    <div id="teamH-sidebar"></div>
    <main class="main"> …本文… </main>
  </div>
  <script src="./js/db.js"></script>
  <script src="./js/header.js"></script>
  <script>
    TeamH.init().then(function () {
      const sess = TeamH.requireLogin();
      if (!sess) return;
      // 役割ガード（必要な画面のみ。下記参照）
      TeamHNav.render("<active>"); // dashboard|workOrders|progress|knowledge|"" のいずれか
      // …描画…
    });
  </script>
</body>
```
- `TeamHNav.render(active)` がヘッダー(ロール別配色/時計/管理者通知/ログアウト)とサイドバー(ロール別メニュー)を注入する。**自分でヘッダー/サイドバーのHTMLを書かない**。
- **参照実装**（同じ書き方に合わせる）: `progress_list.html`(検索+グループ開閉), `todo.html`(フィルタ/モーダル), `progress_detail.html`(JS描画), `admin_dashboard.html`。`login.html` は素のフォーム例。

## 役割ガード（元 LoginRoleInterceptor 準拠）
本文描画前に session.role を見て弾く。弾く場合 `location.href="./login.html?authError=true"`（権限なし画面に飛ばす元実装もあるが authError でよい）。
- 管理者専用: 作業指示書系すべて(`work_*`)、ユーザー登録(`regist_user*`)、技能継承の編集フォーム入口は admin/craftsman、削除は admin のみ。
- 職人専用: `todo`, `progress_update`(職人版), `worker_navigation`。
- 技能継承一覧/詳細/ファイルは全ロール可。`canEditKnowledge = role==admin||craftsman`、`canDeleteKnowledge = role==admin`。
- 権限不足で操作不可な場合は `no_permission.html?message=...&backUrl=...` に飛ばす（元 NoPermission 相当）。

## ファイル名対応表（リンク先・フラット命名）
- 認証/共通: login.html / complete.html / no_permission.html
- 管理者: admin_dashboard.html
- 職人: todo.html / worker_navigation.html
- 進捗: progress_list.html / progress_detail.html / progress_update.html / progress_report_edit.html / progress_report_edit_confirm.html
- 作業指示書: work_orders.html / work_order_form.html / work_order_form_confirm.html / work_orders_edit.html / work_orders_edit_confirm.html / work_orders_delete.html / work_instruction_detail.html
- 技能継承: knowledge_list.html / knowledge_detail.html / knowledge_file.html / knowledge_form.html / knowledge_create_confirm.html / knowledge_edit.html / knowledge_edit_confirm.html / knowledge_delete.html / knowledge_delete_confirm.html
- ユーザー登録: regist_user.html / regist_user_confirm.html

元の `@{/...}` URL → 上記 .html へ読み替える（PathVariable/RequestParam はクエリ文字列に）。例:
`@{/knowledge-detail/{id}(id=5)}`→`./knowledge_detail.html?id=5`、
`@{/admin/work-orders/{id}/edit(id=3)}`→`./work_orders_edit.html?id=3`、
`@{/worker/navigation(workOrderProcessId=2)}`→`./worker_navigation.html?workOrderProcessId=2`。

## ステータス・ラベル（厳密準拠）
- 工程 progressStatus / currentStatus: `not_started`=未着手, `preparing`=段取り中, `processing`=加工中, `inspecting`=検査中, `completed`=完了。
  （TodoService/ProgressService の switch に一致。`TeamH.statusLabel(s)` を使える）
- 作業指示書 status: not_started / active(=進行中) / cancelled / completed。
- ロール: admin=管理者, craftsman=職人, sales=営業（`TeamH.ROLE_LABEL`）。
- フィールドは camelCase（orderNo, partName, clientName, dueDate, machineNo, machineId, processOrder, processName,
  workOrderProcessId, progressReportId, progressReportProcessId, machineNoActual, assignedUserId, expectedEndTime,
  handoverScheduledAt, actualStart, actualEnd, registeredByName, targetPart, targetProcess, workContent, isDeleted など）。

## 入力 → 確認 → 完了 フロー（重要）
元実装はセッションに一時保存して確認画面へ遷移する。静的版は **sessionStorage 下書き** で受け渡す:
- 入力ページ: バリデーション後 `TeamH.setDraft('<key>', data)` → `location.href='./<confirm>.html'`。
- 確認ページ: `const d = TeamH.getDraft('<key>')`（無ければ入力へ戻す）を表示。
  - 「確定/登録する/更新する」→ `TeamH.add*/update*/delete*` を呼び、`TeamH.clearDraft('<key>')` → `location.href='./complete.html?type=create|update|delete'`。
  - 「修正/戻る」→ 入力ページへ（下書きは保持）。
- フロー対応:
  - 作業指示書登録: work_order_form(draft 'workOrder') → work_order_form_confirm → `TeamH.addWorkOrder(form, processList)` → complete?type=create。
  - 作業指示書編集: work_orders_edit(draft 'workOrderEdit') → work_orders_edit_confirm → `TeamH.updateWorkOrder(id, dto)` → complete?type=update。
  - 進捗管理書編集: progress_report_edit(draft 'reportEdit') → progress_report_edit_confirm → `TeamH.reportUpdate(...)` → 元は edit へ戻るが complete?type=update に統一してよい。
  - 技能継承登録: knowledge_form(draft 'knowledge') → knowledge_create_confirm → `TeamH.addSkillContent(form)` → complete?type=create。
  - 技能継承編集: knowledge_edit(draft 'knowledgeEdit', skillId をクエリ保持) → knowledge_edit_confirm → `TeamH.updateSkillContent(id, form)` → complete?type=update。
  - ユーザー登録: regist_user(draft 'registUser') → regist_user_confirm → `TeamH.addUser(name,loginId,password,role)` → complete?type=create。重複は `TeamH.loginIdExists(loginId)` で入力画面にエラー表示。
- 削除フロー（確認画面で実行）:
  - 技能継承削除: knowledge_delete(ステップ1) → knowledge_delete_confirm(ステップ2, 同意チェックで活性化) → `TeamH.deleteSkillContent(id)` → complete?type=delete。
  - 作業指示書削除: work_orders_delete(同意チェック) → `TeamH.deleteWorkOrder(id)` → complete?type=delete。
- **ファイルアップロードは擬似**: input[type=file] は表示だけ。確認/詳細では「添付なし」または選択ファイル名(`input.files[0].name`)を draft に入れて表示する程度でよい。新規登録時に実ファイルは保存しない（addSkillContent はファイル無しで作る）。プレビュー領域は「プレビューできません」等のままでよい。

## TeamH API（js/db.js 抜粋・必要分のみ使用）
- セッション: `session()`/`login(id,pw)`/`logout()`/`requireLogin()`/`homeUrl(role)`
- 表示: `esc(s)`, `fmtDate(v)`, `fmtDateTime(v)`, `fmtTimeHM(v)`, `toLocalInput(v)`(datetime-local用), `statusLabel(s)`, `ROLE_LABEL`
- マスタ: `users()`, `user(id)`, `userName(id)`, `craftsmen()`, `machines()`, `machine(id)`, `machineByNo(no)`, `machineNo(id)`
- 作業指示書: `searchWorkOrders(keyword,status)`, `workOrder(id)`, `activeProcess(woId)`(machine付),
  `distinctOrderNo()/distinctPartName()/distinctClientName()`,
  `workInstructionByProcess(wopId)` / `workInstructionByWorkOrder(woId)`(作業指示書詳細 view),
  `workOrderEditData(woId)`(編集用 dto: {orderNo,partName,clientName,quantity,dueDate,processes:[{workOrderProcessId,processOrder,processName,machineId,assignedUserId,assignedUserName,currentStatus}]}),
  `workOrderDeleteData(woId)`({workOrder, processes(machine/assignedUser付), reports(workOrderProcess/assignedUser付)}),
  `addWorkOrder(form,processList)`→woId, `updateWorkOrder(woId,dto)`, `deleteWorkOrder(woId)`, `existsDuplicateWorkOrder(form,processList)`
- 進捗更新: `progressPage(wopId,isAdmin)`({selectedItem, processList[{...,updatable}]}),
  `updateProgress(wopId,status,actualStart,expectedEndTime,actualEnd,handoverScheduledAt,comment)`,
  `startProgress(wopId)`, `finishProgress(wopId)`
- 進捗管理書編集: `progressReport(id)`, `prpByReport(reportId)`(view要素は `prpView`), `prpView(p)`,
  `reportEditTarget(reportId,processId)`, `reportEditValidate(reportId,processId)`(エラー文字 or null),
  `reportUpdate(prpId,machineNoActual,assignedUserId,progressStatus,actualStart,expectedEndTime,actualEnd,handoverScheduledAt,comment)`
- 移動先選択: `navigationItem(wopId)`({workOrderProcessId,orderNo,partName,processName})
- 技能継承: `searchSkillCards(keyword,targetProcess,loginUserId)`→cards, `groupSkillCards(cards)`→Map(工程→cards[]),
  `skillContent(id)`, `skillFiles(scId)`, `skillFile(fileId)`, `detailViewerType(fileType)`, `previewInfo(fileType)`,
  `addSkillContent(form)`, `updateSkillContent(id,form)`, `deleteSkillContent(id)`
- ユーザー登録: `loginIdExists(loginId)`, `addUser(name,loginId,password,role)`
- 下書き: `setDraft/getDraft/clearDraft`

## 注意
- 文字列は必ず `TeamH.esc()` でエスケープしてテンプレートリテラルに埋める。
- ログアウトボタンはヘッダー(TeamHNav)が処理。個別実装不要。
- `<input type="datetime-local">` の value は `TeamH.toLocalInput(v)`。表示テキストは `fmtDateTime`。
- 元テンプレ冒頭に紛れたゴミ文字（"prgressList.html" や Gemini 宣伝文）は出力しない。
- 余計な機能追加はしない。元テンプレの項目・見た目・CSSクラスを忠実に。
- 技能継承のサムネ/ビューアはファイル実体が無いため、`previewType/viewerType` に応じてアイコン(📎📚📝)やプレースホルダを出す（`knowledge-file-open` 画像/動画/PDFは出せないので file-icon フォールバックでよい）。
