# 跨平台部署與搬移成本研究

查證與評估日期：2026-11-09。狀態為官方文件研究與設計判斷，尚未建立新原型、部署或演練搬移。既有月費試算沿用 2026-11-06 的假設，本輪沒有重新查價。

## 目前結論與第一個原型

使用者要求把未來能搬到不同平台部署的彈性納入選型。必要功能、權限與恢復條件通過後，須同時比較初次部署、日常維護與離開平台的成本。客戶持有帳號與帳單能處理資源歸屬，但不能證明程式、資料與未完成任務能搬走。

目前不再把 Cloudflare Workers、Workflows 與 D1 的完整組合列為第一個原型。它仍適合比較託管流程的便利性，但搬到通用容器時，需要處理執行環境、資料庫及流程恢復三種差異。是否值得承擔這些差異，尚無實測證據。

下一輪暫先驗證 TypeScript、Node.js、LangGraph 核心套件、Postgres 與 Docker。先在 Render 部署，再把同一套程式、固定套件與資料搬到 Cloud Run。選 Render 作起點是減少第一輪容器部署設定的研究判斷，不代表其費用或維運必定優於其他平台。這個原型仍須自行接好 LINE、Google、派送與排程，不能把框架保存進度視為整套業務已完成。

LangGraph 作為主要流程恢復機制，Postgres 分別保存框架 checkpoint 與案件、權限、待確認及外部操作紀錄。使用核心套件，不預設採用託管 Agent Server。Vercel AI SDK 與 Pydantic AI 保留為工具層候選，不為保留原組合而同時堆疊多套框架。若 LangGraph 帶來的維護負擔高於收益，再用相同驗收比較較簡單的業務狀態做法。

Render 到 Cloud Run 的搬移測試固定使用 TypeScript、同一框架與相容的 Postgres 版本，避免把換語言、換框架與換平台混在一起。原本 Cloudflare 加 AI SDK、Cloud Run 加 LangGraph、Render 加 Pydantic AI 的表格只代表不同架構方向，不能當作同一套程式可搬移的證據。

## 官方能力與仍需驗證的部分

以下來源均於 2026-11-09 查閱。連結為滾動文件，原型前另固定 Node.js、框架、儲存套件、Postgres 與映像版本。

| 部分 | 官方文件確認 | 本案判斷與待驗證事項 |
| --- | --- | --- |
| Workers 執行環境 | Workers 提供部分 Node.js API，部分相容實作呼叫時仍可能失敗。[Node.js 相容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/) | 使用 TypeScript 不等於能原封不動搬到 Node.js。需盤點平台綁定與實際套件呼叫。 |
| Workflows | 工作定義使用 `WorkflowEntrypoint` 與 step API，執行個體有暫停、恢復與重啟等管理操作。[Workers API](https://developers.cloudflare.com/workflows/build/workers-api/) | 本輪未取得能把內部執行歷史匯入另一套流程引擎的證據。先按「由業務狀態重建未完成工作」估算，不能把平台內恢復當成跨平台搬移。 |
| D1 | 可匯出資料結構與資料的 SQL；文件指出 SQLite 與 Postgres 的型別、語法不同，不能直接互相匯入。執行匯出會阻擋其他資料庫請求，虛擬資料表另有限制。[匯入與匯出](https://developers.cloudflare.com/d1/best-practices/import-export-data/) | 有匯出能力，但轉到 Postgres 仍須轉換、核對與重建索引；大整數、時間、JSON、限制條件與交易語意需逐項驗證。 |
| Workers 加外部 Postgres | Hyperdrive 提供連接外部資料庫的能力。[Hyperdrive](https://developers.cloudflare.com/hyperdrive/) | 可減少 D1 轉換的工作，但不會消除 Workflows 與執行環境的差異；費用、驅動、交易及網路另測。 |
| Render 與 Cloud Run 容器 | Render 可建置 Dockerfile 或執行既有映像；Cloud Run 容器須符合連接埠、請求時限與生命週期要求。[Render Docker](https://render.com/docs/docker)、[Cloud Run 容器契約](https://docs.cloud.google.com/run/docs/container-contract) | 共用映像是可比較的起點，不保證背景工作直接相容。派送、排程與服務授權仍有平台差異。 |
| LangGraph 保存與確認 | TypeScript 套件提供 Postgres checkpointer；interrupt 可保存狀態，按 thread 接續執行。[Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers)、[Interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) | 固定套件與圖版本後，測試搬移 checkpoint 與待確認內容。節點仍可能重跑，外部操作防重複另由操作紀錄處理，不宣稱 checkpoint 能跨任意版本相容。 |
| Postgres 資料搬移 | `pg_dump` 與 `pg_restore` 提供邏輯匯出還原；Render 也提供對應方式。[PostgreSQL 18 文件](https://www.postgresql.org/docs/18/app-pgdump.html)、[Render 備份](https://render.com/docs/postgresql-backups) | 仍須核對版本、擴充、角色權限與資料完整性。單次匯出不會自動涵蓋之後的新寫入，也不會連同雲端密鑰與排程一起搬走。 |

## 各方案的搬移成本

下表是工作範圍的相對判斷，並非工時或報價。低代表主要改設定與重新驗證；中代表需替換平台串接及演練交接；高代表還要轉換資料結構或重建流程狀態。真正成本須用原型的修改紀錄與計時確認，不能從程式行數推算人力。

| 起點與目標 | 可保留部分 | 主要搬移工作 | 相對成本與缺口 |
| --- | --- | --- | --- |
| Workers、AI SDK、Workflows、D1 到 Node.js 容器與 Postgres | 與平台分開的案件規則、Google 工具、模型呼叫與資料內容。AI SDK 有 [Node.js 用法](https://ai-sdk.dev/docs/getting-started/nodejs)。 | 改入口與綁定、替換主要流程恢復機制、轉換 D1 資料、重建待確認工作，重接排程與秘密管理。 | 高。不是把同一個部署包換個平台；未實測。 |
| Workers、Workflows、外部 Postgres 到容器與同版 Postgres | 案件資料結構、獨立業務邏輯與部分工具。 | 改執行環境與派送，替換 Workflows 並交接執行中的任務，處理資料庫網路與密鑰。 | 中至高。外部資料庫降低資料轉換量，流程綁定仍在；未實測。 |
| Worker 僅作入口，主要處理在 LangGraph 容器與 Postgres | 容器內的流程、工具、資料與 checkpoint。 | 改入口、轉送驗證與重送處理；主要處理平台搬移仍須交接派送、排程與資料。 | 入口搬移較少，但整體仍有中等交接工作，並增加雙平台維護；未實測。 |
| Render 上的 Node.js、LangGraph、Postgres 到 Cloud Run | 同一語言、圖、模型與工具、容器及相容版本的資料和 checkpoint。 | 部署與 IAM、資料庫連線、派送與排程串接、入口切換及停止舊執行端。 | 中。目標是不改案件規則與圖；Cloud Run 的執行方式必須另驗證，不能只搬 Web Service；未實測。 |

Cloud Run 先研究由 Cloud Tasks 啟動有時限的處理請求，等待確認時保存進度並結束請求。Render 工作者與 Cloud Tasks 的啟動方式只傳遞固定工作 ID，案件及圖的處理函式保持共用。未派送工作必須能從持久紀錄補送，不能把佇列內容當成唯一進度。這是待驗證的責任分工，尚未寫程式。[Cloud Run 計費與執行方式](https://docs.cloud.google.com/run/docs/configuring/billing-settings)

### 費用與工時怎麼記錄

搬移成本分成一次性投入與搬移後的月費，不用原本的平台月費代表搬移成本。

| 類別 | 原型必須記錄的項目 |
| --- | --- |
| 程式修改 | 入口、資料存取、流程引擎、派送、排程、密鑰與部署設定的修改檔案、原因、實作及驗證工時。案件規則或圖有變動時，另列為可攜性未達標的原因。 |
| 資料與工作交接 | 匯出、轉換、匯入、重建索引、核對 checkpoint、加密權杖交接及結果不明操作的人工核對工時。 |
| 雲端支出 | 新舊環境重疊天數與按各服務計價方式計算的費用、測試模型與 API 用量、備份儲存、跨區傳輸、建置與紀錄。 |
| 服務影響 | 停止寫入與無法服務的時間、排隊事件數、人工補處理量、測試集中的遺失或重複操作數。 |
| 搬移後維護 | 新平台月費、監控、備份與還原、派送與排程的維護步驟，以及仍需依賴舊平台的服務。 |

一次性總費用以「各項實作與驗證工時乘上約定費率，加雲端重疊、傳輸、測試與人工處理費」列式。未知費率、資料量與工時先標待測，不填推測的天數或總價。2026-11-06 的 Render Pro 月費包含共同管理條件，但當時的框架與資源是假設組合；新的 LangGraph 容器記憶體、派送與資料庫規格仍要重估，不能直接沿用為新方案報價。

## 搬移驗收與演練順序

正式驗收以 [M01 至 M08](requirements-and-acceptance.md#跨平台搬移驗收) 為準，與原有 R01 至 R15、F01 至 F12 一起使用。第一輪以相同合成案件與模擬工具執行；具備隔離帳號後，再測真實 LINE 與 Google API。模擬通過不能代替雲端或 API 驗收。

1. 固定來源與目標的程式 commit、套件鎖定檔、圖版本、映像雜湊、資料庫與結構版本，以及平台設定清單。先建立案件、權限、文件引用、失效來源與長期記憶等合成資料。
2. 同時準備已完成、待執行、等待確認、已過期、等待重試及外部結果不明的工作。每種狀態均有可核對的操作 ID、預期結果與來源版本。
3. 先只換運算平台並保留測試資料庫，驗證相同程式能運作。再把資料與 checkpoint 匯入目標的獨立 Postgres，完成整套搬移，避免只證明程式仍連回原資料庫。
4. 演練停止舊派送、排程與工作領取，等待已開始的操作結束或登記為結果不明，再取得一致資料。切換期間不對未持久保存的事件回成功；需持續接收時，另設持久緩衝並驗證重送及保存期限。
5. 新資料庫先以唯讀方式核對。核對通過並確認舊工作者與排程已停止、在途操作已完成或列入結果不明清單後，才開放目標寫入與派送，切換 LINE webhook、Google 回呼設定及目標排程。無法確認舊端已停止時，不啟用新端外部操作；結果不明的操作不因換平台而重新執行。
6. 測試舊卡片、重送事件、到期提醒及 F02 結果不明情境，再演練回復舊平台。新環境已有寫入時，先停止新執行端並核對增量及外部結果；禁止直接還原舊快照後重跑。
7. 在移除舊平台存取權的測試條件下重跑搬移後必要流程，確認案件服務不再依賴舊平台。保存各項成本、計時、差異與未通過項目，再判斷可否正式採用。

初期先採可控的短暫停止寫入，不把零停機當成已確認需求。正式搬移前需確認可接受的停機時間與恢復時間，未確認前只回報實測值，不宣稱達標。對已回覆接收成功的事件與已保存操作，驗收要求不遺失；外部結果不明時保留待核對狀態，不以自動重做湊出成功率。

## Cloudflare 何時可以提高順位

Cloudflare 保留三種對照：原本 Workflows 與 D1 組合、改用外部 Postgres 的組合，以及僅用 Worker 作入口、主要處理仍在可搬移容器的組合。後者是新架構，需要額外計算雙平台維護與費用，不能沿用原本 US$5 的平台估算。

若能提供可重現的搬移工具與 M01 至 M08 證據，證明程式修改、資料轉換、工作交接及維護的總負擔可接受，且託管流程的好處足以抵銷這些工作，再提高 Cloudflare 順位。現階段不為可攜性先寫多套資料庫或流程抽象，也不宣稱容器方案已通過；先用兩平台的真實差異決定需要哪些串接。
