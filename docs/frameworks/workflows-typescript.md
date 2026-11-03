# 工作流框架與 TypeScript 選項比較

查證日期為 2026-11-03。專案基準為 `bd6b7b8cb577a0c80fe5d8ddc56d3877e5a70a82`。本輪比較 Microsoft Agent Framework、LangGraph、LangChain deepagents 與 Vercel AI SDK，目的是選出適合雲端 LINE 法務助理的執行方式。沒有安裝候選套件、建立金鑰、連接私人資料或執行 API 測試。

需求與驗收依 [共同需求](../requirements-and-acceptance.md)、[LINE 限制](../line-api-research.md) 與 [Google 授權前提](../google-integration-research.md)。本文是選型說明，結論包含取捨，不代表任何候選已通過正式驗收。

## 證據怎麼看

- 「官方確認」指實際開過的官方文件或原始碼直接支持的能力。
- 「設計推論」指依本專案需求選擇的架構與順位，尚未實作。
- 「待實測」指必須用合成案件、重啟或錯誤注入確認的行為。

原始碼來源以查證日的 `main` 分支為範圍。文件網站以當日的現行頁面為範圍，沒有把套件安裝到本專案，也沒有把 `main` 當成固定正式版。文中個別版本代表官方明列的版本邊界。進入原型前，仍須固定每個 SDK、儲存套件與部署平台的相容版本。

## 四者能承擔的工作不同

以下順位是設計推論，只限這四個選項，不代替其他候選的比較。

| 候選 | 適合本案的採用方式 | 優先考慮的條件 | 降順位的主要原因 |
| --- | --- | --- | --- |
| LangGraph | 明確工作流加持久 checkpointer，模型只處理辨識、摘要與回答。 | 要看得清楚每個步驟、等待確認與重啟恢復，並保留雲端選擇。 | 自己部署開源套件時，工作接收、排程、啟動恢復與權限仍需補齊。 |
| Microsoft Agent Framework | .NET 或 Python 工作流，按需要搭 Durable Extension 與託管儲存。 | 團隊熟悉 .NET 或 Azure，願意採用 Azure 的執行及監控服務。 | SDK、checkpoint、Durable Task 與 Foundry 是不同層，需要確認實際組合。 |
| Vercel AI SDK | TypeScript 模型與工具層，加明確的背景工作與持久工作流。 | TypeScript 是主要語言，想自行控制案件資料與 LINE 工具。 | AI SDK 本身不等於背景工作引擎。若搭 Vercel Workflows，增加平台資料保存與版本管理問題。 |
| LangChain deepagents | 放在受限的文件研究步驟，外層保留明確案件工作流。 | R13 文件研究確實需要多步規劃、檔案工作區與子 Agent。 | 首版多為固定流程，檔案、Shell、技能與自主規劃增加不必要的操作範圍。 |

四者都不能直接取得「案件權限已正確」、「Google 授權已處理」或「外部操作只會發生一次」的保證。儲存對話、保存執行進度與記錄外部操作結果，應分開驗收。

## Microsoft Agent Framework

### 官方能力與實際缺口

| 面向 | 官方確認 | 對本案的設計推論與缺口 |
| --- | --- | --- |
| 語言、授權、成熟度 | 官方原始碼為 MIT，主要支援 Python 與 C#/.NET。[M1] 官方於 2026-04-03 公告兩者達 1.0，承諾穩定 API 與長期支援。[M2] 現行概覽另列 Go public preview。[M3] | 不把核心 SDK 統稱預覽版，也不把核心 1.0 推論成每個擴充套件都正式。此輪以 Python、.NET 為主要候選，不以 Go 作第一版。 |
| 工具與 MCP | 有函式工具、MCP、middleware 及多模型客戶端。[M3] `ApprovalRequiredAIFunction` 或 Python `approval_mode="always_require"` 可要求確認。[M4] | 工具內仍須查律師、案件與目標權限。MCP 是呼叫介面，不能代替 Google 授權或案件隔離。 |
| 人工確認 | Agent 遇到確認會結束本次呼叫，由宿主收集決定，再以相同 session 接續。[M4] | LINE Postback 需由應用程式轉成對應確認，保存操作 ID、內容版本與有效期限。不能把群組任意成員按鈕視為律師同意。 |
| Session 與長期記憶 | `AgentSession` 保存對話狀態，可序列化及還原。服務端 session ID 不等於終端使用者的授權邊界。[M5] Context provider 能提供額外資訊；`FileMemoryProvider` 配合固定 scope 與持久 file store 可跨 session 保存記憶。[M6] | 保存 session 可恢復對話。案件事實、來源失效、刪除及跨 session 偏好仍放在受控資料庫，經 context provider 取用。模型自寫的記憶須另作核准與來源管理。 |
| 工作流 checkpoint | 在 superstep 完成時保存 executor、待送訊息、待回應請求與共享狀態。可用 checkpoint 還原新的工作流實例。Python 1.13.0 增加輸入與回應的 entry checkpoint。[M7] | 單一 executor 中的外部 API 呼叫仍可能處於結果未存下的空窗。F02 需要獨立操作紀錄與結果核對。 |
| 持久儲存與恢復 | 文件列有記憶體、檔案及 Cosmos DB 儲存。Cosmos DB 適合跨程序 checkpoint。重建工作流要維持相容的 executor 身分，.NET 的 `Name` 與 `Id` 變更會影響恢復。[M7] | 雲端正式環境不採記憶體或臨時磁碟。部署時需固定圖結構與識別方式，測試舊 checkpoint。Python 自訂序列化型別也要核准，不能讀取不可信 checkpoint。 |
| Durable engine 與排程 | Durable Extension 以 Durable Task 基礎設施提供跨 worker 持久執行，支援 C#、Python 的 Azure Functions 或自有 worker。可以等待外部事件，並整合 trigger、queue 與 timer。[M8] | Azure Functions 加 Durable Task Scheduler 是符合雲端前提的候選。單用工作流 checkpoint 仍要安排工作由誰接收、何時啟動及由誰恢復。 |
| 部署與綁定 | SDK 可搭不同模型服務。[M3] Durable Extension 與 Foundry 託管是不同部署途徑。[M8] | 使用 Microsoft SDK 不等於必須把所有模型放 Azure。採 Durable Task Scheduler、Cosmos DB 或 Foundry 後，資料與運維會各自依賴該服務。 |
| Trace | 支援 OpenTelemetry，可選 exporter。敏感資料包含提示、回答、工具參數與結果。Python `ENABLE_SENSITIVE_DATA` 預設為 `false`。[M9] | 正式環境保留工作 ID、耗時及錯誤類型，避免案件正文進 trace。關閉敏感 trace 不會自動清除 checkpoint 或模型服務紀錄。 |

M7 的重點是工作流狀態恢復，M5 的重點是對話狀態，M8 則負責分散式持久執行。三者不能互相替代。官方頁面有些範例仍帶 `--pre` 或 `--prerelease`，因此本研究不替所有套件背書為正式版；原型須列出實際套件清單與版本。

### 何時採用，何時重新考慮

設計推論上，它適合把 R01、R02、R05、R10、R15 寫成可追查的明確步驟。已有 .NET 或 Azure 維運經驗時，Durable Extension 是實質加分，不應只因不是 TypeScript 就排除。

若團隊最後選擇全 TypeScript，或不願維護 Azure 持久執行服務，順位降低。若合成案例證明跨程序確認恢復比其他方案少補大量程式，且部署成本、資料區域與套件相容性可接受，應提高順位。待實測項目是 F02、F04、F09、部署後舊 checkpoint 恢復，以及 standing approval 不會跨案件沿用。

## LangGraph

### 官方能力與實際缺口

| 面向 | 官方確認 | 對本案的設計推論與缺口 |
| --- | --- | --- |
| 語言、授權、成熟度 | Python 與 JavaScript/TypeScript 有各自官方專案，採 MIT。[L1][L2] v1 文件明確說明核心 graph API 與執行模型以穩定為重點。[L3] | 可公平比較兩種語言，不假設 Python 新功能已同步到 TypeScript。相容性要連 checkpointer 套件一起固定。 |
| 模型與工具 | LangGraph 可獨立使用，LangChain 整合是可選的。[L1] LangChain MCPAdapter 可把 MCP 工具轉成 Agent 工具。[L4] | 用一般節點包裝模型或 REST 工具即可。選可替換模型介面，工具只收受控的案件與操作 ID。圖的條件邊不是使用者權限檢查。 |
| Checkpointer | Checkpointer 保存單一 thread 的圖狀態，Store 保存跨 thread 的應用資料。記憶體 saver 重啟會失去資料。[L5] | 正式採託管 PostgreSQL 等持久儲存，thread ID 由伺服器分配並對應案件及操作者。跨案件共用 thread 不可作預設。 |
| 人工確認與序列化 | `interrupt()` 需要 checkpointer、穩定 `thread_id` 與 JSON 可序列化內容。使用 `Command(resume=...)` 接續，恢復時會重跑該節點在 interrupt 前的程式。[L6] TypeScript 文件同樣明列此語意。[L7] | 把待確認資料先存好，再暫停。外部寫入置於確認後的獨立步驟，重新檢查來源版本與權限。不得在 interrupt 前先發通知。 |
| 落盤與故障恢復 | `sync` 在下一步前完成 checkpoint；`async` 有落盤空窗；`exit` 不保存中途進度。官方有 PostgreSQL 等獨立 saver 套件。[L8] | F09 原型先用 `sync`。這仍不能消除 Google 成功、結果尚未落盤的 F02 空窗。每個外部動作需要業務操作 ID 與核對流程。 |
| 排程與啟動恢復 | Agent Server 提供 cron，可在原 thread 執行或每次新建 thread，排程以 UTC 解讀。[L9] LangSmith Deployment 提供持久執行及託管擴展。[L10] | 單用開源 LangGraph 函式庫時，另接雲端排程、佇列與 worker 啟動恢復。checkpointer 不會自行在明早掃 Gmail。排程要換算 Asia/Taipei，不要無理由再疊另一套 durable engine。 |
| 託管與服務授權 | LangSmith Cloud 管理部署，現行文件要求 Plus 以上。獨立 Agent Server 要 PostgreSQL、Redis 與 LangSmith license。[L10] | MIT 的 LangGraph 不等於所有 Agent Server 部署模式都免費。可選雲端容器直接跑開源套件，代價是自己補背景工作服務。 |
| Trace | LangSmith 提供輸入、輸出隱藏與轉換，可對 Python、TypeScript 設定。[L11] | 託管 trace 是另一條資料流。案件正文、附件文字、Google token 都不能因除錯方便而直接記錄。需另外清理 checkpoint、Store、向量索引與衍生摘要。 |

官方 `durable-execution` 舊網址在本輪已導向 `persistence`，詳細落盤模式位於 `checkpointers`。本研究引用實際開啟後的頁面。`interrupt` 的「恢復」不是把整個程序的記憶體接回去，而是依 checkpoint 與圖程式重建執行。[L5][L6][L8]

### 何時採用，何時重新考慮

設計推論上，它是這四者中最值得先做固定流程原型的選項。R06 案件歧義、R10 行事曆確認與 F09 重啟等待，都能直接對應圖狀態與中斷。R14 則可使用獨立 Store 或案件資料庫，不必把全部記憶塞進聊天紀錄。

若流程最後只有少量固定 REST 呼叫，圖、reducer 與 checkpoint 管理可能增加維護負擔，應與一般工作流加薄模型層比較。若託管 Agent Server 的成本、資料位置或授權不合適，也須重考部署方式。待實測項目包含同 thread 並行、重複 resume、節點變更後恢復、來源收回後拒絕舊確認，以及 F02 操作核對。

## LangChain deepagents

### 官方能力與實際缺口

| 面向 | 官方確認 | 對本案的設計推論與缺口 |
| --- | --- | --- |
| 語言、授權、定位 | Python 與 TypeScript 有官方專案，採 MIT。它建立在 LangChain Agent 與 LangGraph 上，加入規劃、檔案、子 Agent、技能及上下文管理。[D1][D2] | 適合多步文件研究。固定掃信、歸檔與 Calendar 建立不需要先引入完整自主 Agent。 |
| 成熟度 | backend 文件記載 Python `0.5.2`、TypeScript `1.9.1` 的 Runtime 介面變更，並列未來移除的相容方式。[D3] 導覽把 Managed Deep Agents 標為 Beta。[D4] | 語言版本號不同，不能據此推論成熟度相同。以 API 仍有遷移與託管 Beta 作具體風險，不以人氣推論可靠性。 |
| 模型與 MCP | 官方說明可用支援 tool calling 的模型、自訂函式與 MCP 工具。[D1] | 模型可替換，但多步規劃品質、中文文件辨識與成本仍要同一組案件測試。MCP 伺服器需限縮工具與權限。 |
| Backend 差異 | `StateBackend` 的檔案在 graph state，範圍是 thread；`StoreBackend` 透過 LangGraph Store 跨 thread 保存；`CompositeBackend` 依路徑分派。`FilesystemBackend` 使用宿主檔案系統。[D3] | 雲端容器的臨時磁碟不當正式儲存。選持久 Store 或受控物件儲存 backend，清楚分開暫存文件與核准記憶。 |
| 隔離與工具權限 | `StoreBackend` 支援 namespace factory。`LocalShellBackend` 直接在宿主執行 shell，並非 sandbox。[D3] Permissions 支援檔案路徑與操作限制。[D5] | namespace 由伺服器帶入事務所、案件與權限，不讓模型自訂。若無執行程式需求，關閉 Shell；檔案 permission 仍不能替代 Google、LINE 的資源權限。 |
| 人工確認 | `interrupt_on` 可讓指定工具接受核准、修改或拒絕，需要 checkpointer。子 Agent 可以有不同設定。[D4] | 採持久 checkpointer 才能過 F09。修改後的參數要產生新的待確認內容版本。每個子 Agent 都要檢查，不假設主 Agent 的政策完整涵蓋。 |
| Session 與長期記憶 | Memory 以 backend 檔案保存，官方分 Agent 共用與使用者隔離兩種範圍。[D6] | 本案優先案件及律師範圍，避免共用 Agent 記憶累積不同客戶資訊。自動寫下的摘要先作候選資料，不能直接變成核准案件事實。 |
| 持久執行、排程與部署 | 恢復能力來自 LangGraph。[D1] LangSmith Deployment 文件將 Deep Agents 託管導向 Managed Deep Agents。[L10] | backend 解決檔案存放，不等於排程器或工作佇列。可在雲端容器跑 SDK 加持久 saver，或另查託管方案。R15 仍需明確指定啟動服務。 |
| Trace | 使用 LangSmith 追蹤時，可套用輸入輸出隱藏。[L11] | 檔案讀取內容、子 Agent 訊息、工具輸出與自動摘要均列入資料盤點。不能只遮主 Agent 最後的回答。 |

### 何時採用，何時重新考慮

設計推論上，它適合 R13 的長文件整理與研究，也可能協助 R06 複雜附件辨識。外層仍以固定工作流控制案件範圍、人工確認、歸檔與通知。

第一版降順位的原因是需求多為可預先列出的步驟，尚無證據需要自主 Shell、技能寫入或多 Agent 規劃。這不是否定它的恢復能力，該能力可由 LangGraph 提供。若同一組 R06、R13 合成文件測試顯示明顯收益，且關閉不必要工具後仍能完成，應重新提高順位。待實測重點是跨案件 namespace 隔離、所有子 Agent 的工具限制、F03 記憶失效與 F09 持久恢復。

## Vercel AI SDK

### 官方能力與實際缺口

| 面向 | 官方確認 | 對本案的設計推論與缺口 |
| --- | --- | --- |
| 語言、授權、成熟度 | TypeScript toolkit，可用 Node.js 等執行環境。原始碼是 Apache-2.0。[V1][V2] 現行官方文件標示 AI SDK v7。[V3] | 適合 TypeScript 團隊。現行文件不是專案已固定的套件版本，進原型前須選定版本及 Node.js 相容範圍。 |
| 模型替換 | 提供統一 provider 介面，可直接使用供應商套件，也可選 AI Gateway。[V1] | AI Gateway 是可選服務。直接用模型供應商可減少一個資料轉送服務，仍要比較功能與成本，不能假設所有模型的工具能力相同。 |
| 工具與確認 | `inputSchema` 驗證參數，`toolApproval` 控制本地執行工具。`needsApproval` 已標 deprecated。供應商端執行的工具不受此本地設定控制。[V3] | 對 LINE、Drive、Calendar 寫入採自己的伺服器工具。確認前後都檢查操作者、資源、內容版本與外部操作紀錄。 |
| 確認與跨程序恢復 | 工具確認是多次呼叫間傳遞確認資料的流程。[V3] 官方聊天保存範例由應用程式提供 `saveChat`，載入帶工具的訊息時要驗證。[V4] | 完整保存確認請求與訊息可做跨請求接續，但不能據此宣稱任意執行中的工具會自動 checkpoint。F09 要持久資料庫；F02 要操作紀錄及核對。 |
| Session 與長期記憶 | AI SDK 提供訊息資料與保存範例。[V4] | Session 訊息、核准事實、文件索引及待辦由應用程式管理。這增加實作工作，也讓案件權限與刪除規則較容易集中。 |
| MCP 與 OAuth | MCP client 可連接工具，提供 OAuth client provider 介面，包含 callback issuer 與 authorization server URL 驗證。[V5] | 這不是替律師完成 Google OAuth 的託管憑證庫。仍要做同意頁、token 保存更新、撤銷、帳號及案件對應。 |
| Trace | v7 註冊 telemetry integration 後，支援的呼叫會產生事件，預設記錄輸入輸出，可用 `recordInputs`、`recordOutputs` 關閉。[V6] | 不沿用舊版「預設未啟用所以不會記錄」的假設。查清註冊設定、exporter 與模型 provider 的資料去向。 |

### AI SDK、Workflow SDK 與 Vercel 平台分開決定

官方確認，Vercel Workflows 使用另外的 Workflow SDK，把執行、佇列與持久資料交給 Vercel 平台。`WorkflowAgent` 可將 AI SDK 的 Agent 迴圈放入持久工作流。等待外部事件及跨部署恢復是這個組合的能力，不能全算在 AI SDK 套件上。[V7]

Workflow SDK 現行文件為 v5。部署到其他雲端可選其他 World 實作或自行建立，官方部署頁將這些途徑列為社群維護或自行實作。[V8] 因此「開源、可換平台」與「換平台不必維運」是不同判斷。本案若選 Vercel Workflows，應接受其平台依賴；若選別的持久引擎，也要列出該服務與費用。

平台限制與保存規則會直接影響 R04、R15。

| 官方確認 | 本案影響 |
| --- | --- |
| 現行 Functions 表列 Hobby 最長 300 秒；Pro、Enterprise 通常最長 800 秒。延長到 1,800 秒仍為 Beta，受 runtime 與部分網路設定限制。[V9] | 不用一條 HTTP 請求等待律師數小時。附件下載、OCR 與模型處理拆成可恢復步驟。Workflow 總等待時間與單次 Function 執行上限不能混為一談。 |
| Vercel Cron 執行失敗不會自動重試。[V10] | Cron 只負責啟動工作，另外保存掃信游標、工作狀態與補跑規則。單有 cron 不足以完成 R15。 |
| Workflows 記錄執行輸入、輸出、事件及 stream，平台另列計量與限制。[V7][V11] | 成本不能只估模型 token 或一般網頁請求。需估事件、寫入量、保留資料與 Function 資源。 |
| Workflows 預設 Node.js runtime 每次執行上限為 25,000 事件、10,000 steps；payload 上限 50 MB，個別 step 仍受 Functions 限制。QuickJS 的部分事件與步數限制另有例外。[V11] | 不建立永久不結束、持續累積所有信件的單一工作流。附件放受控儲存，工作流保存來源 ID，批次工作定期完成。 |
| 執行中的工作會保留資料，完成後 payload 的可讀期間依方案為 1、7、30 天；最晚刪除時間更長。Metadata 有獨立保存期，官方要求不要放敏感資料。[V12] | 工作流紀錄不能當永久案件資料庫，也不能當成即時刪除保證。長期待確認工作要設到期與清理規則，案件正文盡量只存受控來源 ID。 |

### 何時採用，何時重新考慮

設計推論上，AI SDK 適合 R06、R08、R09、R13 的模型處理，以及 R01、R10 的結構化欄位擷取。搭配清楚的工具與資料庫，也能完成其餘功能；代價是應用程式要負責更多狀態與背景工作。

若團隊已選 TypeScript，且能用一套持久引擎處理 R15、F02、F09，應提高順位，不因「沒有內建完整案件記憶」就淘汰。若只打算部署一般 serverless API、存聊天紀錄並加 cron，則不足以支援本案。重新考慮的條件是 Workflow 組合的資料區域、保存、版本遷移與成本都可接受。待實測包含程序在工具執行中中斷、重複確認、逾期確認，以及不同 provider 的工具行為。

## Google OAuth 的共同缺口

官方 Google Web Server OAuth 流程包含同意、callback、交換 token 與更新存取權，支援可安全保管憑證的伺服器應用。[G1] 框架能呼叫 Google 工具，不表示已完成上述流程，也不表示律師 Google 帳號已與 LINE 身分綁定。

以下是設計推論，四個候選一律要納入實作及驗收。

| 工作 | 四個框架都需要補的內容 |
| --- | --- |
| 帳號與同意 | 先登入並核准律師，綁 LINE Provider 與 user ID，再授權 Google。保存 Google 帳號與授權者關係。 |
| Token 生命週期 | 在受控儲存中加密保存 refresh token，避免同時更新衝突。失效時暫停依賴授權的工作，通知重新授權，保留原工作 ID。 |
| Scopes | 依 Google 前置研究選最小權限，確認個人 Gmail、Workspace 管理政策與正式應用驗證條件。模型供應商的 Google API key 不是 Gmail OAuth。 |
| 實際資料範圍 | Gmail `message ID`、同步游標、Drive 檔案授權、Calendar ID 與案件關係由應用層保存，不能只放 prompt。 |
| MCP | 選定 MCP server 後，確認其 OAuth client、工具範圍、token 保存與部署地點。沿用前置研究的 2026-11-11 Workspace MCP 新要求，不能把支援 MCP 當成已符合要求。 |
| 撤銷與刪除 | 案件資料、checkpoint、對話、長期記憶、附件快取與 trace 各自盤點。撤銷 OAuth 不會自動清除這些副本。 |

四者的實際連接方式可用自訂工具或 MCP，但本輪沒有證據證明任何一個框架會自動完成本案全部身分、資料範圍與撤銷要求。這是待補工作清單，不是宣稱框架完全沒有 Google 整合套件。

## 對共同 R、F 案例的適用性

下表是設計推論。可支援表示存在可用的組件與實作路徑，不代表測試通過。

| 案例 | Microsoft Agent Framework | LangGraph | deepagents | Vercel AI SDK |
| --- | --- | --- | --- | --- |
| R01、R02、R03、R12 案件及關係 | 明確工作流與工具。 | 明確節點及案件資料庫。 | 可以工具完成，但首版無須自主規劃。 | 受控工具加案件服務。 |
| R04 文件接收 | 先由 webhook 下載，再啟動工作流。 | 同左，節點只處理已保存來源。 | backend 可供後續閱讀，不代替 LINE 及時下載。 | 背景工作處理附件，避免 Function 逾時。 |
| R05、R07、R08、R09、R15 掃信與主動通知 | Durable Extension 或另接排程與 worker。 | 持久 saver 加工作啟動機制，或 Agent Server。 | 外接排程，底層使用 LangGraph 恢復。 | AI SDK 加持久工作流及排程。 |
| R06、R13 辨識與知識庫 | 模型步驟加受控檢索。 | 條件分支、人工中斷與受控檢索。 | 適合較複雜研究，但須限制工具及檔案。 | 結構化輸出與受控檢索。 |
| R10、R11 確認後寫入及轉發 | approval 加持久 checkpoint。 | interrupt 加持久 saver。 | interrupt_on 加持久 saver。 | toolApproval 加保存的確認資料，或 Workflow。 |
| R14 長期記憶 | context provider 加受控資料庫。 | Store 或案件資料庫。 | 持久 backend 加核准及失效規則。 | 自建事實資料與檢索工具。 |
| F01、F02、F05 重送與結果不明 | 四者均需操作 ID、去重紀錄、API 重試分類與結果核對。 | 同左。 | 同左。 | 同左。 |
| F03、F09 來源變更與重啟確認 | 保持 checkpoint 可恢復，另驗來源版本。 | 中斷恢復時重新驗證版本。 | 記憶、子 Agent 與檔案副本也要失效。 | 持久確認紀錄與工作流接續分開測。 |
| F04、F06、F08 授權、額度、接收失敗 | 四者均需 Google token 管理與 LINE 錯誤分類，不能以工具成功文字當交付證據。 | 同左。 | 同左。 | 同左。 |
| F07、F10 冒充與跨案件 | 四者均需在工具及檢索前核對權限，不讓模型決定授權。 | 同左。 | 另測 backend 及子 Agent 隔離。 | 同左。 |
| F11 來源權限撤銷 | 四者均需讓快取、索引、衍生摘要及記憶停止供檢索，另依保存規則清理。 | 同左。 | 另處理 backend 中的文件副本。 | 同左。 |
| F12 驗簽或事件保存失敗 | 四者都只能接收已驗簽並持久保存的事件；前置失敗不得啟動工具或背景工作。 | 同左。 | 同左。 | 同左。 |

F02 的必要設計是先保存操作意圖與穩定識別碼，再執行 API。程序恢復後，若不知道外部結果，就依 API 支援核對，必要時轉人工。LINE Retry Key 等平台能力另依前置研究使用。不以任何候選宣稱跨資料庫與 Google、LINE 的 exactly-once。

## 下一輪必須留下的實測證據

目前四個框架的實測狀態均為未執行。優先做以下共同測試，才能縮小最終候選。

1. R10、F09。保存同一待確認活動，終止程序，再以另一個雲端實例接續。確認內容、操作者與到期條件不能改變。
2. F02。模擬 Calendar 已建立、結果尚未落盤便中斷。恢復後不得無條件再建立。
3. F03、F11。待確認來源更新、收回或撤銷權限後，舊按鈕失效。摘要與 R14 記憶不能繼續提供失效資料。
4. R05、R15、F04。沒有新 LINE 訊息也會掃信。OAuth 失效時停在可恢復狀態，重新授權後不漏信、不重發。
5. F07、F10。使用範例客戶甲、範例客戶乙及範例律師甲，測群組冒充、同名客戶、跨案件檢索及子 Agent 工具繞過。
6. 資料與成本。記錄 checkpoint、檔案、trace、模型請求與平台日誌實際保存哪些資料。比較相同案例的模型費、平台費與維護步驟，不只比套件下載量。
7. F12。驗簽失敗或事件無法落盤時，不啟動任何候選框架。保存失敗回非成功並告警，日誌不記敏感正文。

本輪已完成需求對照、官方文件查證、四項取捨與來源整理。尚未完成套件相容性固定、API 實測、雲端成本試算及資料區域合約確認。

## 官方來源與版本範圍

以下連結均於 2026-11-03 實際開啟。除明列版本或公告日期外，均為當日現行文件，不是歷史快照。每個來源只支持本文相鄰的有限主張，不把產品宣傳當作驗收結果。

| 代號 | 官方來源 | 本輪版本或範圍 |
| --- | --- | --- |
| M1 | [Microsoft Agent Framework 原始碼](https://github.com/microsoft/agent-framework) | `main`，MIT，Python 與 .NET。 |
| M2 | [Microsoft Agent Framework 1.0 公告](https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/) | 2026-04-03 公告，核心 1.0。 |
| M3 | [Agent Framework 概覽](https://learn.microsoft.com/en-us/agent-framework/overview/) | 現行文件，Go 明列 public preview。 |
| M4 | [工具人工確認](https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval) | 現行 .NET、Python 章節。 |
| M5 | [Session](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/session) | 現行 session 序列化與身分範圍。 |
| M6 | [Context providers](https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/context-providers) | 現行文件。 |
| M7 | [Workflow checkpoints](https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints?pivots=programming-language-python) | 現行文件，包含 Python 1.13.0 行為變更。 |
| M8 | [Durable Extension](https://learn.microsoft.com/en-us/agent-framework/hosting/durable-extension) | 現行 C#、Python 部署方式。 |
| M9 | [Observability](https://learn.microsoft.com/en-us/agent-framework/agents/observability) | 現行敏感資料與 exporter 設定。 |
| L1 | [LangGraph Python 原始碼](https://github.com/langchain-ai/langgraph) | `main`，MIT。 |
| L2 | [LangGraph.js 原始碼](https://github.com/langchain-ai/langgraphjs) | `main`，MIT。 |
| L3 | [LangGraph v1](https://docs.langchain.com/oss/python/releases/langgraph-v1) | v1 穩定核心說明。 |
| L4 | [LangChain MCP](https://docs.langchain.com/oss/python/langchain/mcp) | 現行 MCPAdapter 文件。 |
| L5 | [LangGraph persistence](https://docs.langchain.com/oss/python/langgraph/persistence) | 現行 checkpointer 與 Store 分工。 |
| L6 | [Python interrupts](https://docs.langchain.com/oss/python/langgraph/interrupts) | 現行中斷與節點重跑規則。 |
| L7 | [TypeScript interrupts](https://docs.langchain.com/oss/javascript/langgraph/interrupts) | 現行文件，response schema 另明列最低 `1.4.16`，本文不依賴此新功能。 |
| L8 | [Checkpointers](https://docs.langchain.com/oss/python/langgraph/checkpointers) | 現行 durability modes 與持久 saver。 |
| L9 | [Agent Server cron](https://docs.langchain.com/langsmith/cron-jobs) | 現行平台 API。 |
| L10 | [LangSmith Deployment](https://docs.langchain.com/langsmith/deployment) | 現行 Cloud、獨立 server 及授權範圍。 |
| L11 | [Trace 敏感資料處理](https://docs.langchain.com/langsmith/mask-inputs-outputs) | 現行 Python、TypeScript SDK 設定。 |
| D1 | [deepagents 原始碼](https://github.com/langchain-ai/deepagents) | `main`，MIT。 |
| D2 | [deepagents.js 原始碼](https://github.com/langchain-ai/deepagentsjs) | `main`，MIT。 |
| D3 | [Deep Agents backends](https://docs.langchain.com/oss/python/deepagents/backends) | 現行文件，包含 Python 0.5.2、TypeScript 1.9.1 遷移註記。 |
| D4 | [Deep Agents 人工確認](https://docs.langchain.com/oss/python/deepagents/human-in-the-loop) | 現行文件，託管產品導覽標 Beta。 |
| D5 | [Deep Agents permissions](https://docs.langchain.com/oss/python/deepagents/permissions) | 現行檔案操作限制。 |
| D6 | [Deep Agents memory](https://docs.langchain.com/oss/python/deepagents/memory) | 現行檔案記憶與範圍。 |
| V1 | [Vercel AI SDK 原始碼](https://github.com/vercel/ai) | `main`，provider 與執行環境。 |
| V2 | [AI SDK 授權](https://raw.githubusercontent.com/vercel/ai/main/LICENSE) | `main`，Apache-2.0。 |
| V3 | [AI SDK tool calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) | v7 現行文件，toolApproval。 |
| V4 | [聊天訊息保存](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence) | v7 現行文件。 |
| V5 | [AI SDK MCP](https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools) | v7 現行 OAuth client provider。 |
| V6 | [AI SDK telemetry](https://ai-sdk.dev/docs/ai-sdk-core/telemetry) | v7 現行註冊及輸入輸出紀錄規則。 |
| V7 | [Vercel Workflows](https://vercel.com/docs/workflows) | 現行平台文件，WorkflowAgent、持久執行與平台組成。 |
| V8 | [Workflow SDK 部署](https://workflow-sdk.dev/docs/deploying) | v5 現行文件，其他 World 的維護責任。 |
| V9 | [Functions 上限](https://vercel.com/docs/functions/limitations) | 當日方案上限，1,800 秒延長功能為 Beta。 |
| V10 | [Cron 管理](https://vercel.com/docs/cron-jobs/manage-cron-jobs) | 當日錯誤與重試規則。 |
| V11 | [Workflows 計費與限制](https://vercel.com/docs/workflows/pricing) | 當日平台計量，未作帳號報價。 |
| V12 | [Workflows 資料保存](https://vercel.com/docs/workflows/retention) | 當日 payload 與 metadata 保存條件。 |
| G1 | [Google Web Server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server) | 當日 OAuth 流程，產品限制另依專案 Google 前置研究。 |

[M1]: https://github.com/microsoft/agent-framework
[M2]: https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-version-1-0/
[M3]: https://learn.microsoft.com/en-us/agent-framework/overview/
[M4]: https://learn.microsoft.com/en-us/agent-framework/agents/tools/tool-approval
[M5]: https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/session
[M6]: https://learn.microsoft.com/en-us/agent-framework/concepts/agents/conversations/context-providers
[M7]: https://learn.microsoft.com/en-us/agent-framework/workflows/checkpoints?pivots=programming-language-python
[M8]: https://learn.microsoft.com/en-us/agent-framework/hosting/durable-extension
[M9]: https://learn.microsoft.com/en-us/agent-framework/agents/observability
[L1]: https://github.com/langchain-ai/langgraph
[L2]: https://github.com/langchain-ai/langgraphjs
[L3]: https://docs.langchain.com/oss/python/releases/langgraph-v1
[L4]: https://docs.langchain.com/oss/python/langchain/mcp
[L5]: https://docs.langchain.com/oss/python/langgraph/persistence
[L6]: https://docs.langchain.com/oss/python/langgraph/interrupts
[L7]: https://docs.langchain.com/oss/javascript/langgraph/interrupts
[L8]: https://docs.langchain.com/oss/python/langgraph/checkpointers
[L9]: https://docs.langchain.com/langsmith/cron-jobs
[L10]: https://docs.langchain.com/langsmith/deployment
[L11]: https://docs.langchain.com/langsmith/mask-inputs-outputs
[D1]: https://github.com/langchain-ai/deepagents
[D2]: https://github.com/langchain-ai/deepagentsjs
[D3]: https://docs.langchain.com/oss/python/deepagents/backends
[D4]: https://docs.langchain.com/oss/python/deepagents/human-in-the-loop
[D5]: https://docs.langchain.com/oss/python/deepagents/permissions
[D6]: https://docs.langchain.com/oss/python/deepagents/memory
[V1]: https://github.com/vercel/ai
[V2]: https://raw.githubusercontent.com/vercel/ai/main/LICENSE
[V3]: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
[V4]: https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence
[V5]: https://ai-sdk.dev/docs/ai-sdk-core/mcp-tools
[V6]: https://ai-sdk.dev/docs/ai-sdk-core/telemetry
[V7]: https://vercel.com/docs/workflows
[V8]: https://workflow-sdk.dev/docs/deploying
[V9]: https://vercel.com/docs/functions/limitations
[V10]: https://vercel.com/docs/cron-jobs/manage-cron-jobs
[V11]: https://vercel.com/docs/workflows/pricing
[V12]: https://vercel.com/docs/workflows/retention
[G1]: https://developers.google.com/identity/protocols/oauth2/web-server
