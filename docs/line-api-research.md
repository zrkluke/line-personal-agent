# LINE API 限制與驗證計畫

官方文件查證日期：2026-11-03。

狀態：完成本輪官方文件可行性盤點，尚未建立測試帳號或執行實際 API 驗證。使用者已有臺灣官方帳號，尚未設定 Messaging API。帳號資格、實際費用與客戶端行為仍需驗證。

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

## 臺灣帳號起步與身分綁定

既有官方帳號可從 Official Account Manager 啟用 Messaging API。Provider 選定後不能更換或解除，應選擇事務所控制的 Provider。[啟用流程](https://developers.line.biz/en/docs/messaging-api/getting-started/) 本次只研究，不代替使用者啟用帳號。

同一使用者在同 Provider 的不同 channel 有相同 user ID，跨 Provider 則不同。[取得 user ID](https://developers.line.biz/en/docs/messaging-api/getting-user-ids/) 資料鍵保留 Provider，律師顯示名稱只作顯示。

官方 account linking 需要先加好友，將已登入的服務帳號與 LINE 身分綁定。Link token 單次、十分鐘有效，nonce 必須不可預測且單次使用。[綁定流程](https://developers.line.biz/en/docs/messaging-api/linking-accounts/) 設計上先核准律師帳號，再做綁定。綁定只證明帳號關係，不證明律師資格。

群組來源的 user ID 可能省略，不能依事件範例推論每個事件都有操作者。缺值時拒絕律師限定動作，不用群組 ID、文字署名或被標記的人代替。[資料同意條件](https://developers.line.biz/en/docs/messaging-api/user-consent/)

群組成員名單的認證資格與付費方案不同，購買 Premium ID 也不等於 premium account。[名詞說明](https://developers.line.biz/en/glossary/#premium-account) 第一版不依賴完整成員名單運作。

## 接收與送出規格分開處理

影音內容準備中可能回 202，須查轉碼狀態；無法取得內容可能回 404 或 410。失敗不能顯示歸檔成功，並應提供補傳方式。[內容 API](https://developers.line.biz/en/reference/messaging-api/nojs/#get-content)

送出文字上限為 5,000 個 UTF-16 code units，單次 messages 最多五個物件。一般圖片原圖上限 10 MB、預覽 1 MB，影片與音訊各 200 MB。這些是送出規格，不是接收一般檔案的大小限制。[訊息規格](https://developers.line.biz/en/reference/messaging-api/nojs/#message-objects)、[計字規則](https://developers.line.biz/en/docs/messaging-api/text-character-count/)

接收一般檔案的通用大小上限本輪未查明。產品可接受格式、掃毒、OCR 與大小需另外設定及實測。LINE 也可能處理或縮小內容，不宣稱保存結果必定與使用者裝置檔案逐位元相同。

公開群組 API 沒有加入前歷史、相簿或記事本讀寫端點。這是公開 API 範圍盤點的結論，不是實測。[群組 API 範圍](https://developers.line.biz/en/docs/messaging-api/group-chats/) 必要舊資料改為重傳或受控匯入。

## 雲端接收與通知恢復

Webhook 要使用原始 request body 做 HMAC-SHA256 簽章驗證，不能先解析再重新序列化。LINE 不公開來源 IP，不能只靠 IP 白名單。[驗簽說明](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)

事件可能重複或亂序，重送不能保證送達。[重送規則](https://developers.line.biz/en/docs/messaging-api/receiving-messages/#webhook-redelivery) 設計上先驗簽並持久保存，再回成功。驗簽失敗拒絕處理，保存失敗回非成功且不進入背景工作。兩種失敗都留下不含敏感正文的錯誤紀錄。背景工作獨立恢復，以事件 ID 去重，建檔、建活動與發通知再各自保存操作識別碼。服務無法接收事件時需告警及補救，不能只期待平台重送。

支援的 Push 等 API 從第一次要求就使用 `X-Line-Retry-Key`，同 key 的接收者與內容不可變更。有效期為首次請求起二十四小時。已接受後重試回 409，Reply 不支援此 key。逾時或 5xx 依規則退避，2xx、409 不再重送；4xx 先處理原因。超過有效期而結果不明時停止自動重發，交由人工處理，不換新 key 無條件重送。[重試文件](https://developers.line.biz/en/docs/messaging-api/retrying-api-request/)

| 相關 API | 官方呼叫上限 |
| --- | --- |
| Reply、Push、內容下載、quota 等一般端點 | 各每秒 2,000 次。 |
| Loading animation | 每秒 100 次。 |
| Multicast | 每秒 200 次。 |
| Broadcast、Narrowcast、webhook endpoint test | 各每小時 60 次。 |

限制按 channel 與 endpoint 計算。429 還可能涉及月額度或對同一使用者大量發送，必須分類。[限流與錯誤](https://developers.line.biz/en/reference/messaging-api/nojs/#rate-limits) 此表不是 LINE 傳入 webhook 的速率保證。

## 編輯、收回與操作版本

目前事件表支援群組限定的編輯事件，一對一與舊多人聊天室不適用。事件直接帶更新文字，message ID 沿用原 ID。[適用事件表](https://developers.line.biz/en/docs/messaging-api/receiving-messages/#webhook-events-for-chats)、[Edit event](https://developers.line.biz/en/reference/messaging-api/nojs/#edit-event)

設計上編輯更新來源，舊摘要、待辦與待確認內容失效，不自動當作新指令執行。收回建立失效狀態，避免後到原文復活。法務保存規則另外確認，不預設所有內容永久保存。

## 群組與私訊互動介面

| 功能與來源 | 使用限制與設計方向 |
| --- | --- |
| [Rich menu](https://developers.line.biz/en/docs/messaging-api/rich-menus-overview/) | 不作群組底部選單的前提，桌面版不顯示。私訊保留文字指令。 |
| [Quick reply](https://developers.line.biz/en/docs/messaging-api/using-quick-reply/) | 最多十三個、支援手機，群組有新訊息時可能消失。僅用於即時補問。 |
| [Flex](https://developers.line.biz/en/docs/messaging-api/using-flex-messages/) 與 [Postback](https://developers.line.biz/en/reference/messaging-api/nojs/#postback-action) | 可作摘要與確認卡片。按鈕只帶短操作 ID，伺服器核對身分、案件、到期與內容版本。 |
| [Loading](https://developers.line.biz/en/docs/messaging-api/use-loading-indicator/) | 僅一對一且使用者正在看聊天室，五至六十秒。不用於群組或長任務進度。 |

LIFF 先不列第一版必要條件，需要複雜表單或文件入口再加入。LIFF 不能建立在 Messaging API channel。[LIFF 起步](https://developers.line.biz/en/docs/liff/getting-started/)

後端驗證 LIFF token，不能相信前端傳來的 profile。[安全身分使用](https://developers.line.biz/en/docs/liff/using-user-profile/) `getContext()` 已不提供群組 ID，群組綁定仍由 Messaging API webhook 建立。`sendMessages()` 有環境與權限限制，Flex 與 Template 不產生 webhook。[LIFF 參考](https://developers.line.biz/en/reference/liff/) 不以 LIFF 取代背景 Push。

## 臺灣訊息成本

以下為新臺幣未稅，依 2026-11-01 生效公告，非帳單實測。

| 方案 | 月費 | 每月包含則數 | 加購 |
| --- | ---: | ---: | --- |
| 輕用量 | 0 元 | 200 | 不可。 |
| 中用量 | 1,000 元 | 3,000 | 不可。 |
| 高用量 | 1,400 元 | 6,000 | 前 50,000 則加購各 0.2 元，後續各 0.15 元，累進計算。 |

來源為 [臺灣官方調價公告](https://tw.linebiz.com/column/LINEOA-2026-Price-Plan/)。加購級距以扣除包含則數後的加購量計算，不以全部發送量計算。稅率、帳單進位與實付金額另確認，不沿用舊版月費。

例如十個群組、每組四位收件人、每天兩次通知、每月二十二天，加律師每日一則摘要，推估 `10 × 4 × 2 × 22 + 22 = 1,782` 則，對照中用量方案。這是示例用量推算，不是實測，未包含其他後台訊息、模型與雲端費用。

quota 可取得目標上限，consumption 為近似用量，包含官方帳號後台發送訊息，不是本系統精確帳本。[額度 API](https://developers.line.biz/en/reference/messaging-api/nojs/#get-quota)

## 本輪可行性分類

| 功能 | 結論與前提 |
| --- | --- |
| 群組訊息彙整、定時提醒 | 可實作，需要接收時保存、排程、編輯與收回處理。 |
| 白名單律師指令 | 可實作，需要服務端核准、LINE 綁定及案件權限。 |
| 群組文件轉 Drive | 可實作，需及時下載，格式與大小待實測。 |
| 信件及 PDF 轉發群組 | 需受控連結替代，並驗證客戶權限。 |
| 背景通知 | 可實作，需要 Push、群組綁定及額度預警。 |
| 加入前紀錄、相簿、記事本 | 無公開 Messaging API 方式，採重傳或人工匯入。 |
| 完整成員 ID 清單 | 需要帳號資格，不作第一版必要前提。 |
| 逐人已讀確認 | 不支援此種自動查詢，另做明確確認操作。 |

臺灣官網的內建 AI 聊天機器人業種限制，不直接當成自建 Messaging API 助理被禁止的證據。正式使用仍需確認適用產品條款。[官方帳號產品說明](https://tw.linebiz.com/service/account-solutions/line-official-account/)

## 文件研究與實測進度

- [x] 官方帳號、Provider、群組、身分與綁定流程的文件查證。
- [x] 臺灣新版方案、加購與計數方式的文件查證。
- [x] 回覆、Push、重試、限流、訊息及媒體規格的文件查證。
- [x] 歷史資料、編輯、收回與群組互動介面的範圍盤點。
- [x] LIFF 的必要性與限制評估，現階段不列必要元件。
- [ ] 實際帳號認證、Provider、既有機器人與客戶端可用性確認。
- [ ] 接收一般檔案大小、原件差異與處理限制驗證。
- [ ] 編輯、收回亂序與缺少 user ID 的拒絕流程驗證。
- [ ] 憑證輪替、用量、稅額、帳單進位與正式資料處理規則確認。

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
