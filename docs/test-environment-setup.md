# LINE 與 Google 測試環境設定

更新日期：2026-11-03。此文件是設定順序與憑證保存規則；尚未建立雲端測試服務、填入憑證或完成 API 串接。

本輪使用既有的臺灣 LINE 官方帳號與 Google 個人帳號。Workspace 同樣納入研究、選型與支援規劃，目前因無法提供環境而延後實測。以下是本輪個人帳號的設定流程；未來接上 Workspace 時，另依組織政策與選用功能補充設定及驗收。框架研究與模擬測試可先做，實際 API 驗證前才需要完成以下設定。

## 已確認進度

使用者於 2026-11-03 回報 LINE Messaging API 已啟用，能在 LINE Developers Console 開啟既有 Channel，且 Allow bot to join group chats 已啟用，不需要重新建立 Channel。Webhook、收訊、回覆及主動通知尚未實測；Google 測試專案與 OAuth 設定狀態待確認。

## 公開 repo 可以放什麼

| 資料 | 保存位置 |
| --- | --- |
| 程式、設定欄位名稱、空白設定範本、合成測試資料 | 可提交到公開 repo。 |
| LINE Channel secret、Channel access token、Google OAuth client secret、模型 API key | 本機測試放在未追蹤的 `.env`；雲端放在託管平台的秘密管理服務。 |
| Google access token 與 refresh token | 由後端授權流程取得，放在受存取控制、加密保存的儲存空間。正式服務須能更新、撤銷及刪除。 |
| 真實郵件、附件、案件資料、群組與使用者識別碼、含個資的紀錄 | 使用受控資料庫或檔案空間；臨時本機資料放在 `.local/` 或 `private-test-data/`，不提交到 Git。 |

[Google 官方建議](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)將 client credentials 放入秘密管理服務，避免寫死在程式或提交到 repo；使用者權杖也必須妥善保存。

repo 已加入 `.gitignore` 與 [空白設定範本](../.env.example)。`.gitignore` 只協助排除未追蹤檔案，不提供加密，也不會移除已追蹤檔案或歷史紀錄中的內容。不要用 `git add -f` 加入被忽略的憑證。

目前沒有應用程式或 `.env` 載入機制；範本僅先列出預計使用的欄位。雲端部署時由執行環境注入密鑰，不把 `.env` 放進部署包或容器映像。GitHub Actions 的 secrets 用於工作流程；它們不會自動成為雲端服務的執行環境設定。

## 一起設定的順序

1. 先確認 Git 排除規則與合成測試資料。若要做本機測試，再將 `.env.example` 複製為 `.env`，由帳號持有人直接填值。不要把密鑰貼到對話、issue、文件或截圖。
2. 準備雲端測試服務與 HTTPS 網址。部署平台尚未定案；網址確認後，才能填入實際的 LINE webhook 與 Google OAuth 重新導向網址。也可以先準備帳號與 Google Cloud 專案，稍後再設定網址。
3. 若 Messaging API 尚未啟用，先確認 Provider 歸屬，再於既有 LINE 官方帳號啟用。本專案使用者已回報啟用，直接確認能管理既有 Channel。需要串接時，把 Channel secret 與 Channel access token 直接存入秘密管理服務。測試服務就緒後設定 webhook、驗證簽章及群組互動，先用私人測試群組驗證收訊、回覆與主動通知。[LINE 設定文件](https://developers.line.biz/en/docs/messaging-api/getting-started/)
4. 建立 Google Cloud 測試專案，啟用 Gmail API、Drive API 與 Calendar API。設定 External OAuth 同意畫面，將自己的個人帳號列為測試使用者。建立 Web application OAuth client，填入測試服務實際使用的重新導向網址。使用者 OAuth 與雲端服務的身分分開管理，詳細權限見 [Google 整合研究](google-integration-research.md)。
5. 在 Google 官方授權頁由帳號持有人同意存取；後端安全保存回傳的權杖。先用測試郵件、助理建立的資料夾與測試行事曆，逐項驗證讀信、取附件、歸檔及確認後建立活動。避免把真實案件資料帶入原型紀錄。

External 應用維持 Testing，並要求 Gmail 等非基本個人資料權限時，refresh token 會在七天後失效。因此本輪需要測試重新授權；持續運作前再確認發布狀態與驗證要求。[Google OAuth 說明](https://developers.google.com/identity/protocols/oauth2)

## 協作時如何確認設定

對話只回報「已填入哪個欄位」、「授權是否成功」及已移除敏感內容的錯誤訊息。檢查程式只輸出欄位是否存在，不輸出值；紀錄也不保存授權標頭、權杖、OAuth 授權碼或完整郵件內容。後台登入、同意授權與密鑰輸入由帳號持有人操作。

每次提交前檢查暫存內容，並可在 GitHub 啟用適用的 secret scanning 與 push protection，作為額外防線；它們不能保證辨識所有敏感資料。[GitHub 防洩漏建議](https://docs.github.com/en/code-security/how-tos/secure-your-secrets/prevent-future-leaks)

若密鑰曾公開，先在 LINE、Google 或對應平台撤銷並重發，再處理 Git 歷史、紀錄與部署設定。只刪除檔案或改為私人 repo，不能讓已流出的密鑰失效。[GitHub 處理方式](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
