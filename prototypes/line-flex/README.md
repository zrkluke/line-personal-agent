# LINE Flex 模擬歸檔

用三筆合成附件，驗證「查看待辦、核對案件、確認模擬歸檔」的 LINE 卡片流程。沒有連接 AI、Gmail 或 Drive，也沒有建立正式部署。本目錄可獨立執行，不用安裝 npm 套件。

需要 Node 24，本機已用 v24.22.1 與內建 `node:sqlite` 驗證。請先用 `node --version` 確認目前版本，再切到本目錄執行以下命令。

## 先跑離線示範

```powershell
node demo.mjs
```

這個命令不需要 `.env`、真實 user ID 或 LINE 憑證。它啟動只綁定 `127.0.0.1` 的臨時 HTTP 服務，以合成密鑰對原始中文 body 簽章，真的呼叫本機 `/webhook`，再用假的 LINE 傳輸接住回覆。終端機會輸出可複製的兩張 FlexMessage JSON，以及待處理數量 `3 → 2 → 1 → 0`。示範資料放在記憶體，結束後清除。

這只能證明本機流程可執行，不代表 LINE 官方格式驗證、Flex Simulator 畫面或真 LINE 帳號測試已通過。

## 查看兩張卡片

`exports/summary.flex.json` 是三筆待辦摘要。每筆附件都有獨立「處理這筆附件」按鈕。`exports/confirmation.flex.json` 是第一筆附件的確認卡，有「確認模擬歸檔」、「改選案件」與「查看來源」。兩張卡片都直接從同一份待辦記錄產生。

若之後要在 [LINE Flex Simulator](https://developers.line.biz/flex-simulator/) 預覽，可貼上 `exports/summary.bubble.json` 或 `exports/confirmation.bubble.json`。這兩份檔案只有 bubble 內容，不含外層 FlexMessage。

重新產生公開預覽檔案：

```powershell
node export.mjs
```

匯出使用固定合成時間與 `synthetic_action_` 開頭的預覽 actionId，沒有真實身分或密鑰。這些 ID 不會存進執行中的服務，不能拿來操作服務。正式執行路徑每次發卡都用密碼學亂數產生 actionId。

## 本機行為測試

```powershell
node --test
```

測試從實際 HTTP webhook 或公開儲存入口觀察結果，涵蓋以下行為：

- 原始中文 body 驗簽成功，改過的 body 與錯簽遭拒。
- 指定 owner 的私訊才能操作，其他使用者、群組、room 與缺少必要 ID 的事件不執行。
- 三筆摘要都能開啟並查看合成來源，確認後待辦依序減為零。
- 改選案件會先出新確認卡；舊卡被拒，按下新確認後才歸檔。
- 來源失效時拒絕操作，也不輸出舊信件；卡片到期仍保留待辦，重查後可繼續。
- 同一事件不重做或重回覆，不同事件重按同一完成確認也不重複歸檔。
- 重開服務保留進度、卡片版本與事件去重記錄。
- 回覆失敗仍保存結果，事件重送不再次使用 reply token。
- 提交前中斷會回滾；兩個 worker 使用獨立 SQLite 連線與共同起跑閘門，同時確認只完成一次。
- 匯出的 JSON 可解析，FlexMessage 與獨立 bubble 內容一致。這不等同官方 schema 驗證。

## 合成資料與操作方式

三個案件只有「範例客戶甲｜侵權行為」、「範例客戶甲｜返還借款」及「範例客戶乙｜租賃爭議」。三筆附件沿用先前互動原型的檔名、頁數與合成信件，不含真正 PDF 檔案。畫面上的「歸入」只更新本機記錄。

未來若接上指定測試帳號，傳「卡片測試」或「待處理」會收到摘要與第一筆確認卡。點摘要可切換附件；改選案件後要再確認；完成後會看到新摘要，歸零後可查看完成紀錄。

每個 postback 只帶 opaque actionId。後端保存並檢查 owner、動作、待辦版本、來源版本、案件與到期時間，不能靠修改卡片資料指定案件。只有真正完成的確認 actionId 能回報「已完成」，其他舊操作仍會被拒絕。到期的是卡片操作，待辦不會被自動刪除。

## 模組與儲存

`commands.mjs` 保存合成資料與純狀態轉換。`cards.mjs` 產生 LINE Flex JSON。`store.mjs` 用 SQLite transaction 完成讀取、判斷、狀態更新、新 action 與事件結果記錄。`server.mjs` 只處理 HTTP、原始 body HMAC、指定 owner 私訊白名單與固定的 LINE reply endpoint。

資料庫只在首次建立 owner 記錄時放入三筆資料，重啟不會重新播種。服務的本機資料位於 `.local/state.sqlite`；`.env`、`.dev.vars` 與 `.local/` 都由本目錄 `.gitignore` 排除。

`replaceSourceForSimulation` 和 `beforeCommit` 是本機測試接點，HTTP 沒有提供這些操作。`newActionId` 可供固定預覽使用，HTTP 正式啟動路徑不會覆寫亂數預設值。

reply token 最多嘗試一次。狀態提交後才回覆 LINE；若這時中斷或傳輸失敗，可能漏掉一則回覆。事件重送不補發，使用者可重新查待辦恢復畫面。此原型不保證訊息一定送達，不使用 push 補送，也沒有定期清理 action 或事件記錄。

## 日後手動接 LINE 的準備

這輪沒有選定雲端平台、部署公開 HTTPS webhook、切換既有 LINE webhook 或設定真憑證。下列設定只是為日後本機手動串接保留，不是執行示範與測試的必要步驟。

```powershell
Copy-Item .env.example .env
```

在 `.env` 填入測試頻道的 `LINE_CHANNEL_SECRET`、`LINE_CHANNEL_ACCESS_TOKEN`，以及唯一可操作的測試律師 `LINE_OWNER_USER_ID`。範例檔刻意留白，請勿提交真值。手動啟動入口：

```powershell
node --env-file=.env server.mjs
```

服務預設只監聽 `http://127.0.0.1:3000/webhook`。這個入口若帶真憑證啟動，收到合法事件後就會呼叫固定的 `https://api.line.me/v2/bot/message/reply`。離線示範與測試會替換此傳輸，不呼叫 LINE。

正式測試仍需另行決定平台與儲存方式、提供公開 HTTPS、確認測試頻道及 owner，再執行 LINE 官方驗證與真帳號點按。多位律師的案件權限、外部附件儲存、真實來源同步與 AI 分類都尚未實作。這裡只假設單一測試律師可查看三個合成案件。
