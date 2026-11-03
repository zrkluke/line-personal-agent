# Google 整合的授權與部署前提

查證日期：2026-11-03。證據程度為官方文件確認，尚未連接測試帳號。

Google 個人帳號與 Workspace 都納入研究、選型與支援規劃，未來很可能需要串接 Workspace。使用者已確認本輪先用個人帳號實測，目前無法提供 Workspace 測試環境。Workspace 的相容性仍須納入縮選；只延後實測，不移除整合需求，也不以個人帳號結果宣稱 Workspace 已驗證。這份文件補充法務助理的外部服務前提，不替框架評分，也不表示特定帳號已取得權限。

## 本輪測試環境

使用個人 Gmail、My Drive 與個人 Calendar，資料採合成案件、測試郵件與測試活動。先驗證使用者 OAuth、權杖更新與撤銷、文件歸檔、受控分享及確認後建立活動。

Workspace 的組織內應用、管理員政策、網域委派與共用雲端硬碟持續研究，確認各方案的適用條件與所需調整。這些能力是否採用，依正式需求與版本決定；不預設全部都必須啟用。目前無法實測的項目保留在驗收清單，具備環境後補做，不要求使用者為本輪原型另行申請 Workspace。個人帳號結果不能代表 Workspace 已通過。

## 兩種帳號的差異

| 項目 | 個人 Gmail | Google Workspace |
| --- | --- | --- |
| 使用者授權 | 使用者 OAuth，同意助理存取指定服務。 | 可使用使用者 OAuth，另受管理員政策影響。 |
| OAuth 應用對象 | 研究 External 與個人使用的驗證例外。 | 組織擁有的專案可研究 Internal，限組織內使用者。客戶在 LINE 互動不等於取得 Google 存取權。 |
| 無人值守 | 授權後保存並更新 refresh token，仍須處理撤銷與失效。 | 同樣需要處理權杖生命週期及管理員限制，不因 Workspace 就自動永久有效。 |
| 服務帳號 | 不把服務帳號當作直接讀取個人 Gmail 的替代方式。 | 管理員可授予網域委派，但權限較大，第一版不預設採用。 |
| 文件所有權 | 個人 My Drive，需規劃帳號交接。 | 可研究適用版本的共用雲端硬碟與組織管理。 |

OAuth 的 Internal 條件與驗證例外以 [Google 驗證文件](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) 為準。這份文件列出個人使用及組織內使用等例外，但不能直接推論未來對外服務都免驗證。服務帳號與網域委派參見 [伺服器授權文件](https://developers.google.com/identity/protocols/oauth2/service-account)。共用雲端硬碟須確認 [Workspace 版本與管理條件](https://developers.google.com/workspace/drive/api/guides/manage-shareddrives)。

## 最小必要權限

| 需求 | 優先研究的權限 | 限制與處理方式 |
| --- | --- | --- |
| 讀信、摘要與取附件 | `gmail.readonly` | 屬 Restricted scope，`gmail.metadata` 不能讀正文，不足以完成案件辨識。暫不要求寄信、修改或刪信權限。 |
| 建立案件文件與資料夾 | `drive.file` | 適用於 App 建立或經使用者授予 App 存取的檔案，不代表能搜尋整個既有 Drive。 |
| 搜尋既有知識庫 | 先指定或選取可存取的檔案與資料夾 | 驗證選取資料夾後的子檔案可見範圍，不能先假設 `drive.file` 自動涵蓋所有子檔案。若擴大權限，另說明理由與審查影響。 |
| 建立開庭活動 | 研究 `calendar.events.owned` 或獨立助理行事曆 | 依實際要寫入的行事曆決定，不直接要求管理所有行事曆與分享權限。 |
| 查衝突 | 研究 FreeBusy 或必要的事件讀取權限 | 區分只查忙碌時間與讀取完整活動內容。 |

來源為 [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)、[Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) 與 [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth)。以上為候選權限，需在測試帳號逐一驗證完整流程後才定案。

Gmail 的 Restricted scope 是否需要驗證或安全評估，取決於應用對象、例外資格及資料是否在伺服器儲存或傳輸。公開提供多個事務所使用時需重新評估，不能把個人用途的例外沿用到對外產品。[官方條件](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)

## 長期運作不能停在測試授權

External 且 Publishing status 為 Testing 時，要求 Gmail 等非基本個人資料 scopes 的 refresh token 會在七天後失效。改成 Production 也不代表權杖永久有效，仍要處理撤銷、密碼變更及其他失效原因。[OAuth 權杖說明](https://developers.google.com/identity/protocols/oauth2)

因此，部署驗收包含重新授權通知、待處理工作保存與授權恢復後接續。雲端服務帳號只負責雲端資源存取，使用者的 Google 授權另外保存與管理。

## 定時掃信與 Gmail Push 的分工

第一版保留使用者要求的定時掃信。以信箱及 message ID 去重，記錄同步進度，不把「未讀」當作唯一待處理標記，避免律師先讀信後助理漏掉。

若改用 Gmail Push，通知透過 Cloud Pub/Sub，帶信箱與 `historyId`，並非信件全文。收到後仍須同步信件。Watch 至少每七天續訂，官方建議每日更新。[Gmail Push](https://developers.google.com/workspace/gmail/api/guides/push)

增量同步的 `startHistoryId` 太舊時可能回傳 404，需重新同步並沿用去重紀錄，避免重發案件通知。[同步文件](https://developers.google.com/workspace/gmail/api/guides/sync)

`//檢查信件` 的「今天」先以 `Asia/Taipei` 當日範圍計算。Gmail 搜尋日期字串以 PST 午夜解讀，實作時使用明確時間戳記查詢並驗證邊界。[搜尋與時區](https://developers.google.com/workspace/gmail/api/guides/filtering)

## 文件連結與長期記憶的界線

LINE 不能直接發送 PDF，因此研究以文件連結通知客戶。Drive 權限有 `user`、`group`、`domain` 與 `anyone` 等類型；客戶能收到 LINE 訊息不代表已能讀取 Drive 檔案。[Drive 分享](https://developers.google.com/workspace/drive/api/guides/manage-sharing)

先研究逐位授權及必要的受控下載方式，不將案件資料夾改為任何知道連結的人都可存取。客戶是否有 Google 帳號、群組成員變動與 Workspace 外部分享政策，保留為待確認事項。

長期記憶優先保存經核准的結構化案件資料、偏好與來源 ID。Google 使用者資料及衍生內容的保存、模型處理與刪除規則需符合 [Workspace 使用者資料政策](https://developers.google.com/workspace/workspace-api-user-data-developer-policy)。不能把郵件內容當作可無限保存或供共用模型訓練的資料。知識庫與快取的保存期限另外驗證。

來源權限撤銷、檔案刪除或授權失效後，相關快取、索引與衍生摘要停止供檢索，並依確認的保存規則清理。來源 ID 只供追溯，不代表目前仍有權限。此項列入 F11 驗收。

## REST 與官方 MCP 分開評估

研究起點以明確的 Google REST 工具與程式端權限檢查為主，MCP 作為另一路線比較，不能以「框架支援 MCP」推論 Google 授權已完成。

官方於 2026-10-12 公告，2026-11-11 起 Workspace MCP 將拒絕未標示為 AI Agent 的 OAuth client。此為查證日之後即將生效的要求，不能寫成已生效。公告也區分只呼叫 REST API 的整合，並要求混合用途分開 client。[發布紀錄](https://developers.google.com/workspace/release-notes#october_12_2026)

## 尚待驗證

- [ ] Google 個人帳號的實際 OAuth 同意、更新及撤銷流程。
- [ ] 正式用途是否符合驗證例外，或需要額外驗證與安全評估。
- [ ] 既有 Drive 知識庫的選取、子檔案與搬移權限。
- [ ] 客戶開啟文件連結的身分、授權與撤銷流程。
- [ ] Calendar 權限、指定行事曆、時區與重複建立防護。
- [ ] Gmail 同步、附件、信箱中斷與歷史游標失效後的恢復。
- [ ] 個人帳號使用的各 API 現行配額與適用計費。
- [ ] Workspace 專屬的版本、管理員政策與授權差異，持續納入相容性研究與選型。實測延後至具備環境後補做，未完成前不得標示 Workspace 已驗收。
- [ ] 模型供應商的資料處理、紀錄與保存設定，及其與 Google 政策的相容性。

本次沒有讀取任何私人郵件、Drive 或 Calendar 資料。
