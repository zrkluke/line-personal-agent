# LINE API 限制與驗證計畫

官方文件查證日期：2026-11-03。

狀態：完成部分官方文件查證，尚未建立測試帳號或執行實際 API 驗證。帳號方案、地區費用及未列明的限制仍待查證。

本文件是 [框架與雲端部署研究計畫](research-plan.md) 的前置研究。表中的產品處理方式是根據官方限制提出的設計方向，尚未完成實作。

## 已查證的限制與設計影響

| 項目 | 官方文件確認的限制 | 對法務助理的影響與設計方向 |
| --- | --- | --- |
| 加入群組 | 必須開啟允許加入群組的設定，同一群組同時只能有一個 LINE Official Account。[群組文件](https://developers.line.biz/en/docs/messaging-api/group-chats/) | 先確認既有群組是否已有官方帳號，不能假設本助理能直接加入。 |
| 群組通知範圍 | 發到群組的訊息會顯示給全體成員。[群組文件](https://developers.line.biz/en/docs/messaging-api/group-chats/) | 律師內部摘要發到已綁定的私訊或另設的內部群組。 |
| 文字保存 | 文字由 webhook 傳入，收到後沒有 API 可重新取得。[接收訊息](https://developers.line.biz/en/docs/messaging-api/receiving-messages/) | 定時彙整依賴收到時保存的資料，不設計成定時回 LINE 抓完整對話。 |
| 附件接收 | 可依 message ID 取得使用者傳來的圖片、影片、音訊與檔案，但內容會在一段時間後自動刪除。[接收訊息](https://developers.line.biz/en/docs/messaging-api/receiving-messages/) | 優先下載再歸檔，不假設固定保留天數或延後數日仍可取得。 |
| PDF 傳送 | Messaging API 不能直接傳送 PDF。[官方 FAQ](https://developers.line.biz/en/faq/tags/messaging-api/) | 信件附件轉發先評估受控的 Drive 或下載連結，另驗證客戶能否開啟。 |
| 回覆時效 | reply token 只能使用一次，應在收到 webhook 後一分鐘內使用，且官方要求儘早使用，不依賴期限邊界。[API 參考](https://developers.line.biz/en/reference/messaging-api/nojs/#send-reply-message) | 分開設計快速回覆與背景完成通知，不讓耗時的 OCR 或 Agent 長任務依賴原 token。 |
| 主動私訊 | 可推播給好友、已加入的群組，或最近七天內曾私訊官方帳號的非好友；群組互動不等同已具備私訊條件。[API 參考](https://developers.line.biz/en/reference/messaging-api/nojs/#send-push-message) | 律師綁定需確認好友與私訊條件。處理封鎖、退群與重新綁定。 |
| 成員名單 | 群組成員 ID 清單 API 僅供 verified 或 premium 帳號使用。[API 參考](https://developers.line.biz/en/reference/messaging-api/nojs/#get-group-chat-member-user-ids) | 不以取得完整名單作為白名單功能的唯一前提，另研究 webhook 身分與綁定方式。 |
| Webhook 可靠性 | 官方建議非同步處理與驗證簽章。重送預設未啟用，且不保證事件必定送達。[接收訊息](https://developers.line.biz/en/docs/messaging-api/receiving-messages/) | 研究事件持久化、去重、佇列與錯誤監控，不把重送當成可靠性保證。 |
| 月額度與群組計數 | Push 計入方案額度，Reply 不計入。群組按收件人數計數，額度超過時無法發送。[計費文件](https://developers.line.biz/en/docs/messaging-api/pricing/) | 估算案件進度與每日摘要的收件人數，設計用量監控及額度不足的處理流程。 |
| 收回訊息 | 官方建議尊重收回意圖，避免該訊息繼續被看到或使用。[接收訊息](https://developers.line.biz/en/docs/messaging-api/receiving-messages/) | 研究來源文字、摘要、待辦與檢索資料的更新或刪除方式，另確認必要保存規則。 |
| 送達與已讀 | API 不能確認個別訊息已讀。封鎖者可能得到 HTTP 200 但不會收到訊息，已發送訊息也不能用 API 收回。[官方 FAQ](https://developers.line.biz/en/faq/tags/messaging-api/) | 記錄已接受與使用者已確認兩種狀態，重要通知考慮明確回覆確認。 |

例如，若群組有五位收件人，一次 Push 即使包含多個訊息物件，官方範例仍計五則。[計數方式](https://developers.line.biz/en/docs/messaging-api/sending-messages/) 群組規模與通知頻率必須納入成本估算。

「不能補抓完整歷史對話」是根據接收 API 的設計提出的產品限制。這次查證直接確認的是文字無法在 webhook 接收後重新取得。機器人加入前紀錄的匯入方式仍須另外研究，不把它列為 Messaging API 已支援能力。

## 後續必查項目

- [ ] 確認實際帳號地區、認證資格、Messaging API 設定與群組使用條件。
- [ ] 查實際地區的官方帳號方案、加購條件、額度 API 與費用，不套用其他地區價目。
- [ ] 查各端點速率限制、訊息長度、單次訊息數量、附件與媒體限制，記錄日期與來源。
- [ ] 驗證事件身分缺漏、同一人跨私訊與群組的綁定，以及不同 Provider 的 user ID 關係。
- [ ] 查舊群組紀錄、相簿、記事本與訊息引用的 API 範圍，提出人工匯入或其他替代方式。
- [ ] 查訊息編輯事件、收回事件與衍生資料更新，對照法務助理的保存需求。
- [ ] 查推播失敗、重送、順序、retry key、錯誤碼與憑證輪替的處理方式。
- [ ] 查群組與私訊的按鈕、Postback、Flex Message、Rich Menu 與載入提示限制，避免依賴無法顯示的操作介面。
- [ ] 評估是否需要 LIFF 進行綁定、上傳或確認，並驗證登入與文件權限，不先假設一定需要。
- [ ] 查官方開發規範與資料處理要求，記錄對記憶、文件保存及第三方模型處理的影響。

## 測試帳號驗證案例

| 案例 | 要留下的證據 |
| --- | --- |
| 官方帳號加入測試群組 | 設定、事件與群組對應，包含群組已有其他官方帳號的情境。 |
| 私訊綁定與律師白名單 | 正常操作、非白名單拒絕，以及缺少身分資訊時的結果。 |
| 檔案接收與 Drive 歸檔 | PDF、圖片與其他實際需要的格式，記錄下載及保存失敗情境。 |
| 長任務回覆 | 快速回覆、背景完成後 Push，以及 reply token 無法使用的處理。 |
| PDF 連結與權限 | 目標客戶能開啟，未授權者無法讀取，連結不意外公開案件資料。 |
| 事件重送與服務重啟 | 同一事件不重複歸檔、建活動或發通知。 |
| 收回與編輯 | 摘要、待辦與檢索結果不繼續使用已失效的內容。 |
| 封鎖、移除與額度不足 | 不把 HTTP 200 當成已讀，不無限重試無法發送的通知。 |
| 群組通知成本 | 比對測試前後用量與收件人數，記錄估算與實際差異。 |
| 重要提醒的使用者確認 | Postback 或回覆能辨識律師與對應任務，不能由其他成員代為確認。 |

測試只使用測試帳號、合成案件與指定接收者，不向真實客戶群組發送研究訊息。無法安全觸發的額度與錯誤情境，先模擬並明確標記尚未完成實際 API 驗證。
