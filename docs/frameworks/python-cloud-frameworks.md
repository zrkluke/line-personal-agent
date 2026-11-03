# Google ADK、Pydantic AI 與 Strands Agents 比較

查證日期為 2026-11-03，專案基準為 `bd6b7b8cb577a0c80fe5d8ddc56d3877e5a70a82`。本文件比較三個 Python 路線能替雲端 LINE 法務助理省下哪些工作，以及哪些責任仍留在應用程式。需求以 [R01 至 R15 與 F01 至 F12](../requirements-and-acceptance.md) 為準。

本輪只有官方文件與公開原始碼研究，沒有安裝框架、建立金鑰、部署、呼叫模型或連接私人 Google 資料。以下「適合」都是設計判斷，不是驗收通過。工作完成條件是三項比較、全部需求對照、來源與待測缺口皆有記錄。

## 比較結論

在這三項之中，Pydantic AI 適合先做小型驗證，原因是型別化資料、延後工具確認與可恢復的執行的分工明確。Google ADK 適合已有 Google Cloud 維運方向的團隊，但內建工具確認與持久化 Session 的文件限制，必須先解決。Strands 適合已有 AWS 維運能力，或準備採用 AgentCore 的團隊。三者都可在其他雲端執行，不能直接把框架品牌當成部署限制。

這是本分組的條件式排序，不是全部候選框架的最終排名。此時沒有延遲、費用、辨案正確率或維護工時的實測數字，不能宣稱其中一項較快或較便宜。

## 查證範圍與維護狀態

所有連結均於 2026-11-03 實際開啟。官方網站是查證日的滾動文件，原始碼使用表列 `main` 分支，不代表已安裝或已發布的套件版本。正式驗證前必須鎖定套件版本與原始碼 commit，再重查功能交集。

| 框架 | 語言、授權與維護證據 | 本輪適用範圍 |
| --- | --- | --- |
| Google ADK | Google 官方 Python 專案，Apache-2.0。`main` 的套件設定要求 Python 3.11 以上，README 已以 ADK 2.0 命名。文件另有 TypeScript、Go、Java、Kotlin，但本輪不把其他語言的功能算進 Python。[原始碼](https://github.com/google/adk-python)、[套件設定](https://raw.githubusercontent.com/google/adk-python/main/pyproject.toml) | `google/adk-python` 的 `main` 與 `adk.dev` 查證日內容。功能頁的「Supported in v…」是起始版本提示，不是最新版本。 |
| Pydantic AI | Python、MIT。官方版本政策列 V2.0 於 2026-06-23 穩定發布，套件設定標為 Production/Stable。核心與 Harness 分開看，Harness 的 Google Workspace 頁仍標 0.x 可有相容性變更。[套件設定](https://raw.githubusercontent.com/pydantic/pydantic-ai/main/pyproject.toml)、[版本政策](https://pydantic.dev/docs/ai/project/version-policy/) | `pydantic/pydantic-ai` 的 `main` 與 `pydantic.dev/docs/ai`。本文採查證日 V2 介面，不套用舊教學的 V1 類別名稱。 |
| Strands Agents | Python 與 TypeScript、Apache-2.0。Python 套件設定列作者 AWS、Python 3.10 以上、Production/Stable，另有正式版本政策。[套件設定](https://raw.githubusercontent.com/strands-agents/harness-sdk/main/strands-py/pyproject.toml)、[版本政策](https://strandsagents.com/docs/user-guide/sdk/versioning-and-support/) | 原 `strands-agents/sdk-python` 會轉到 `strands-agents/harness-sdk`。本輪採 `main/strands-py` 與 SDK 文件，不把另一層完整 Harness 的功能當成 SDK 預設能力。[專案](https://github.com/strands-agents/harness-sdk) |

維護證據表示官方仍提供現行原始碼與版本政策，不代表付費支援、服務 SLA 或本案已取得相容性保證。開源授權也不包含模型、雲端及追蹤服務的使用費與條款。

## Google ADK

### 官方文件確認的能力與限制

| 面向 | 已確認內容與本案影響 |
| --- | --- |
| 工具與 MCP | `McpToolset` 可用 `tool_filter` 限制交給模型的工具，官方也建議明列必要工具。這是工具曝光控制，案件與操作者權限仍須在執行工具前檢查。[MCP tools](https://adk.dev/tools-custom/mcp-tools/) |
| 人工確認 | `FunctionTool(require_confirmation=True)` 可要求確認，也能收結構化回覆。REST 回覆須對應工具呼叫 ID；啟用 Resume 時還須對應 `invocation_id`。此功能仍標 Experimental，Known limitations 明列不支援 `DatabaseSessionService`、`VertexAiSessionService`。[Action confirmations](https://adk.dev/tools-custom/confirmation/) |
| 暫停與恢復 | Resume 保存工作事件及完成狀態，可接續未完成步驟。官方明說工具至少執行一次，恢復時可能重跑，也不支援停止後變更工作流程再恢復。因此不能用它證明 F02 的外部操作只發生一次。[Resume Agents](https://adk.dev/runtime/resume/) |
| Session | `DatabaseSessionService` 能把 Session 保存到 PostgreSQL、MySQL 或 SQLite，重啟後仍存在。它與工具確認的相容性是另一個問題，不能因 Session 可持久化，就推論待確認流程可直接恢復。[Session](https://adk.dev/sessions/session/) |
| 長期記憶 | Memory 服務與 Session 分開。`VertexAiMemoryBankService` 可產生、查詢與直接寫入記憶；直接寫入可控制保存的事實。案件來源、核准者、失效與刪除傳播仍須自行建立。[Memory](https://adk.dev/sessions/memory/) |
| Google 工具 | `main` 的 `google_api_tool` 匯出包含 `GmailToolset`、`CalendarToolset`，未列 `DriveToolset`。這只證明該模組的具名匯出範圍，不代表整個 ADK 無法接 Drive，也不證明 Gmail 與 Calendar 各項需求已完整覆蓋。[模組原始碼](https://raw.githubusercontent.com/google/adk-python/main/src/google/adk/tools/google_api_tool/__init__.py) |
| OAuth | ADK 有驗證設定與互動式授權流程協助。官方仍要求應用處理使用者授權及權杖管理，並提醒把 refresh token 放入 Session 有風險。Cloud IAM 的服務身分與律師 Google 帳號授權不同。[Authentication](https://adk.dev/tools-custom/authentication/) |
| 雲端 | 官方提供 Cloud Run 與 Google Cloud Agent Runtime 部署路徑。後者需 Google Cloud 專案及相關 API。容器執行與託管 Session、Memory 是不同選擇，不需要一次全選。[Cloud Run](https://adk.dev/deploy/cloud-run/)、[Agent Runtime](https://adk.dev/deploy/agent-runtime/deploy/) |
| 模型替換 | 除 Gemini 路線，也有 LiteLLM 介面。替換供應商可行，但模型工具呼叫、結構化輸出與用量行為須重新測試，不保證只改名稱就相同。[LiteLLM](https://adk.dev/agents/models/litellm/) |
| 追蹤 | ADK 使用 OpenTelemetry，可送 OTLP 後端或 Cloud Trace，記錄 Agent、工具與模型呼叫資訊。案件資料若進入自訂欄位、日誌或底層模型追蹤，仍可能外流。須實際檢查匯出內容，而非把使用 OTel 視為已去識別。[Traces](https://adk.dev/observability/traces/) |

### 設計推論、採用條件與待測事項

本案可用 Cloud Run 接 webhook，另用資料庫保存案件、Google 授權參照、來源版本與待確認動作。Cloud Scheduler 負責固定啟動，Cloud Tasks 負責把背景工作交給工作處理服務。這些服務不是 ADK 自動提供的法務助理排程。Scheduler 本身也可能重送，應以信箱、排程時間及工作 ID 去重。[Cloud Scheduler](https://docs.cloud.google.com/scheduler/docs/overview)、[Cloud Tasks](https://docs.cloud.google.com/tasks/docs/dual-overview)

綁定程度取決於選用元件。容器與自管資料庫的搬遷範圍較清楚；使用 Google 託管 Session、Memory、IAM 與排程後，搬雲端就要逐一替換這些服務。這是部署設計的取捨，不是 ADK 開源授權的限制。

採用理由是 Google Cloud 部署與 Session、Memory 路線集中，已有 Google 工具設定可參考。降順位理由是 R10、F09 很重要，而內建確認與常用持久化 Session 的文件限制直接撞到此需求。改採應用程式自己的待確認資料表可以研究，但必須承認這是額外實作，不能算 ADK 已完成。

重考條件是鎖定版本後，官方文件與實測都證明選定 Session 後端能跨重啟恢復確認，或獨立待確認流程通過 F02、F03、F09。需要另測 Google 工具的實際端點、最小 scope、Drive 歸檔及受控分享。若改用 Google 託管 Session 或 Memory，也要驗證資料區域、刪除、保留與搬遷方式。

## Pydantic AI

### 官方文件確認的能力與限制

| 面向 | 已確認內容與本案影響 |
| --- | --- |
| 資料與工具權限 | 型別化依賴可把服務與使用者範圍傳入工具，適合讓程式掌握律師、案件與來源版本。型別驗證不等於授權，工具仍須核對該律師能否操作指定案件。[Dependencies](https://pydantic.dev/docs/ai/core-concepts/dependencies/) |
| MCP | `MCP` 能使用 URL、用戶端或工具組，預設由應用端處理 MCP，也有依模型供應商支援的原生模式。兩種模式的權杖與資料流向不同，需要明確選定，不能把原生模型代呼叫與後端代呼叫視為同一信任範圍。[MCP capability](https://pydantic.dev/docs/ai/capabilities/mcp/) |
| 人工確認與序列化 | 延後工具支援 `ApprovalRequired` 與外部執行。可結束本輪，保存待確認狀態，再以 `DeferredToolResults` 開始後續執行。確認回覆要對應工具呼叫 ID；本案仍須額外驗證律師身分、內容版本與到期時間。[Deferred tools](https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/) |
| Session 與記憶 | 官方以 `Conversation` 保存訊息、用量、對話 ID 與待處理的延後工具，透過 `ConversationTypeAdapter` 序列化。只存 messages 不足以完整恢復延後要求。跨對話記憶與執行持久化分開，資料庫後端仍需選擇或實作。[Persistence](https://pydantic.dev/docs/ai/core-concepts/persistence/) |
| 可靠執行 | 有 Temporal、DBOS、Prefect 等可恢復的執行整合。官方明分「保存對話」與「程序中斷後恢復同一次執行」。選定引擎後，仍要確認哪些工具呼叫由引擎記錄。[Durable execution](https://pydantic.dev/docs/ai/capabilities/durable_execution/overview/) |
| Temporal 條件 | `TemporalDurability` 只在 Temporal workflow 內執行才有耐久效果。普通 HTTP 端點直接 `agent.run()` 不會因此變成可恢復的工作。還需要 Temporal Server、Worker，以及啟動或通知 workflow 的入口。[Temporal](https://pydantic.dev/docs/ai/capabilities/durable_execution/temporal/) |
| Google 整合 | Harness 有 `GoogleWorkspace` 介面接 Google 託管 MCP，支援選擇 Gmail、Drive、Calendar 等產品。它仍要求自行登記 OAuth client、取得和保存 refresh token、每輪供應 access token，不會自動更新 token。預設會曝光所選產品的工具，包括修改與刪除；需工具篩選、最小 scopes 及確認。[Google Workspace](https://pydantic.dev/docs/ai/harness/google-workspace/) |
| 雲端與模型 | 核心不是整套託管 LINE 服務，可與應用後端一起部署，再接所選工作流程引擎。模型介面包含 OpenAI、Anthropic、Google、Bedrock 等，沒有強制使用 Logfire 或單一模型雲端。[Production](https://pydantic.dev/docs/ai/production/)、[Models](https://pydantic.dev/docs/ai/models/overview/) |
| 追蹤 | 可用 Logfire 與 OpenTelemetry。`include_content=False` 排除提示、回答與工具參數、結果等內容，但不涵蓋自行加入的 metadata、span 或另行擷取的 HTTP body。必須一起檢查才可判斷郵件與案件內容未進追蹤。[Observability](https://pydantic.dev/docs/ai/integrations/logfire/) |

### 設計推論、採用條件與待測事項

第一版可先把 Agent 當成有型別輸入輸出的判讀元件。案件登記、授權與通知狀態由一般後端掌握，排程由雲端排程服務啟動。若工作需跨日等待、逐步恢復，再比較 Temporal 託管服務或 DBOS 等方案，並將 Worker 放在雲端。不能把選了工作流程引擎等同已經解決 OAuth、案件權限與 LINE 送達。

核心框架的雲端綁定較少，但工作流程引擎的工作歷史、重試設定與等待事件會形成另一種搬遷成本。Logfire 是追蹤選項，不是排程或完整應用託管服務。正式方案仍須選雲端執行環境、資料庫及持續執行 Worker 的方式。

採用理由是資料驗證、工具依賴、人工確認及恢復方式容易分開檢查，適合先驗證 R06、R10 與 F09。降順位理由是須自行整合後端、資料庫、排程與工作流程引擎；使用 Harness 新整合還多一層版本變動。這些是工程範圍判斷，不是已量測的開發時間。

重考條件是團隊不打算維護 Python 後端，或實測發現雲端 Worker 與工作流程引擎維運成本超過需求。反之，若單一雲端容器、託管資料庫與排程已能通過共同故障測試，無須為了框架宣傳額外加入 workflow 引擎。採 GoogleWorkspace MCP 前，還須檢查 Google 帳號適用條件及本專案 Google 研究所列即將生效的 OAuth client 要求。

## Strands Agents

### 官方文件確認的能力與限制

| 面向 | 已確認內容與本案影響 |
| --- | --- |
| 工具與權限 | SDK 支援自訂工具與 MCP。正式環境文件建議明列工具，限制工具權限並驗證輸入。工具白名單可減少模型能做的事，但無法代替案件級授權。[Production](https://strandsagents.com/docs/user-guide/sdk/deploy/operating-agents-in-production/)、[MCP tools](https://strandsagents.com/docs/user-guide/sdk/tools/mcp-tools/) |
| 人工確認 | 可在工具或 hook 發出 interrupt，等待回覆再接續。`BeforeToolCallEvent` 可攔單一呼叫，`BeforeToolsEvent` 可攔整批。文件提醒同批並行工具的行為，不能假設某工具暫停就能攔住其他已開始的工具。[Interrupts](https://strandsagents.com/latest/documentation/docs/user-guide/concepts/interrupts/) |
| Session 與恢復 | Session manager 保存對話與狀態，也保存 interrupt 狀態。查證日文件推薦新的單一 Agent 使用 `SnapshotSessionManager`，可接 S3 storage；舊 `S3SessionManager` 仍是相容路徑。正式環境不依賴容器本機檔案。[Session management](https://strandsagents.com/docs/user-guide/sdk/agents/session-management/) |
| 長期記憶 | `MemoryManager` 處理跨 Session 記憶，支援自訂 store 或 Bedrock Knowledge Bases。記憶擷取寫入需選擇啟用，與 Session 保存不同。法律案件的核准與失效規則仍須額外設計。[Memory](https://strandsagents.com/docs/user-guide/sdk/memory/overview/) |
| 雲端 | SDK 在應用程序中執行，不強制託管控制服務。官方有 AgentCore、Lambda、Fargate 與容器部署路徑。AgentCore 是可選託管執行環境，另可接 Identity，不等於 SDK 本身替應用建好 Google 授權。[專案說明](https://github.com/strands-agents/harness-sdk)、[AgentCore](https://strandsagents.com/docs/user-guide/sdk/deploy/deploy_to_bedrock_agentcore/) |
| 模型替換 | Python 可用 Bedrock、Anthropic、Google、OpenAI 等 provider。各 provider 的快取與其他行為不同；SDK 的共同介面不保證本案辨案結果相同。[Model providers](https://strandsagents.com/docs/user-guide/sdk/model-providers/) |
| 追蹤 | 支援 OpenTelemetry 與 OTLP，可送自選追蹤後端。文件示意含工具結果，並要求避免保存敏感資料。需要實測設定後的 span、log 與例外內容，不能預設輸出已遮蔽。[Traces](https://strandsagents.com/docs/user-guide/sdk/observability-evaluation/traces/) |

### 設計推論、採用條件與待測事項

AWS 路線可用 EventBridge Scheduler 啟動工作，搭配 SQS 或其他工作入口，以及託管資料庫保存案件、待確認與通知紀錄。Scheduler 支援一次性與固定週期、重試設定及 SQS、Lambda 等目標；這些是額外雲端元件，不是 Strands Session 的功能。[EventBridge Scheduler](https://docs.aws.amazon.com/scheduler/latest/UserGuide/what-is-scheduler.html)

AgentCore 的執行環境與 Session 生命週期不等於每日掃信和跨日待辦排程。採用 AgentCore Identity、S3 與 Bedrock 記憶服務後，搬雲端要替換相應服務；單用 SDK 與自訂工具則保留較多部署彈性。

採用理由是 interrupt、Session 與 AWS 託管部署有直接組合方向，模型不限定 Bedrock。降順位理由是本案尚無 AWS 基礎，若只為這個 Agent 增加 AWS IAM、S3、排程、執行環境與 Google OAuth 兩套雲端管理，未必比其他候選少工作。這是依目前需求提出的維運判斷，不是 AWS 不能處理 Google。

重考條件是事務所已有 AWS 管理、區域與稽核要求，或 AgentCore 的實測確實降低維運負擔。仍須做等待確認時重啟、並行寫入、同一 Session 多請求與工具成功後中斷測試。沒有官方證據可把 Session snapshot 當成所有外部操作的耐久交易紀錄。

Google 整合可用自訂 REST 工具或 MCP；本輪沒有確認 SDK 內建完整 Gmail、Drive、Calendar 業務流程。若採 AgentCore Identity 管 Google OAuth，還是要設定 provider、client、scopes、使用者綁定及重新授權方式，並逐一核對 API 能力。不能從「可接 Google OAuth」推論 R02、R05、R10、R11 已完成。

## 三者共同剩餘的 Google 與可靠性工作

三者都必須完成 [Google 整合研究](../google-integration-research.md) 的帳號、scopes、同意畫面、權杖保存與更新、撤銷處理及政策確認。個人帳號與 Workspace 都在支援規劃範圍。本輪先實測個人帳號；Workspace 因缺乏環境延後實測，其相容性、管理員政策與整合方式仍須納入選型，保留後續驗收。模型 API key、Google Cloud IAM 及律師的 Gmail OAuth 是不同憑證，不能互相取代。

Drive 要測實際 folder ID、既有資料可見範圍與客戶受控開啟附件。Gmail 要測同步游標、附件、時區與已讀信不漏處理。Calendar 要測指定行事曆、確認版本及重複建立防護。框架已有 API wrapper 或 MCP，只能減少接線，不會替這些驗收作保證。

每個外部寫入先建立操作紀錄，綁定案件、目標、內容版本及確認者。重新執行時先檢查操作狀態，逾時且結果不明時查外部結果或轉人工確認。依 [LINE 研究](../line-api-research.md) 使用適用 API 的 retry key，同時處理期限與無法確認已讀的限制。資料庫交易不能跨 Google 和 LINE 自動變成同一筆交易。

這段是本案設計推論。ADK 明列重跑可能性；Pydantic 的 Persistence 文件也提醒未完成或已拋例外的工具仍可能產生外部效果。因此 checkpoint、Conversation、Session 和可恢復的工作都不能單獨證明外部操作 exactly-once。還要測 F02 指定的中斷位置。

追蹤之外，Session、記憶與工作流程引擎的工作歷史也可能保存郵件及工具結果。設計上優先傳來源 ID 和必要欄位，權杖只保存在受控憑證服務。三者都須驗證資料是否送往模型、MCP、追蹤或工作歷史後端，以及每個後端的保存與刪除方式。

## R01–R15 適合程度

以下是設計推論。`可作基礎` 表示有對應框架機制，但仍要整合本案資料與服務。`應用負責` 表示框架沒有替本案完成該功能。`先解限制` 表示有已確認的文件限制需要先處理。所有格子都尚未實測。

| 需求 | Google ADK | Pydantic AI | Strands | 共同剩餘工作 |
| --- | --- | --- | --- | --- |
| R01 登記案件 | 應用負責 | 可作基礎，型別資料 | 應用負責 | 案件唯一性、補問與重送去重。 |
| R02 Drive 資料夾 | 應用負責 | 可作基礎，Workspace MCP 另測 | 應用負責 | OAuth、folder ID、重複建立核對。 |
| R03 群組綁定 | 應用負責 | 應用負責 | 應用負責 | 白名單、案件關係與多案歧義。 |
| R04 LINE 文件 | 應用負責 | 應用負責 | 應用負責 | 及時下載、受控歸檔、來源紀錄。 |
| R05 定時掃 Gmail | 可作基礎，Gmail 工具另測 | 可作基礎，Workspace MCP 另測 | 應用負責 | 排程、同步進度、附件與去重。 |
| R06 辨認案件 | 可作基礎 | 可作基礎，型別化輸出 | 可作基礎 | 合成案例評估、衝突轉人工。 |
| R07 進度通知 | 應用負責 | 應用負責 | 應用負責 | 目標案件、公開範圍、LINE Push。 |
| R08 訊息彙整 | 可作基礎 | 可作基礎 | 可作基礎 | 排程、來源保存與完成狀態。 |
| R09 當日信件 | 可作基礎 | 可作基礎 | 可作基礎，自訂查信工具 | Asia/Taipei、同步完整度與來源。 |
| R10 行事曆確認 | 先解限制，確認與持久化 | 可作基礎，延後工具 | 可作基礎，interrupt | 律師與內容版本確認、建立去重。 |
| R11 轉發信件 | 應用負責 | 應用負責 | 應用負責 | 信件與群組對應、受控附件權限。 |
| R12 列已登記案件 | 應用負責 | 應用負責 | 應用負責 | 權限查詢、內部 ID 與法院案號區別。 |
| R13 知識庫 | 可作基礎，記憶或檢索工具 | 可作基礎，自訂檢索 | 可作基礎，memory store | 檢索前授權、來源核准與法域。 |
| R14 長期記憶 | 可作基礎，Memory 服務 | 可作基礎，獨立記憶與儲存 | 可作基礎，MemoryManager | 核准、修正、刪除與來源失效。 |
| R15 主動工作 | 應用負責，外接排程 | 可作基礎，外接排程與工作流程引擎 | 應用負責，外接排程 | 無訊息觸發、工作保存與重啟恢復。 |

`可作基礎` 不表示優於 `應用負責`。例如案件登記直接用後端資料庫實作，往往比讓模型規劃每一步更容易驗收。表格用來看責任分工，不能加總成虛構的分數。

## F01 至 F12 故障驗收對照

| 故障 | 三者共同判斷 | 框架差異與待測項目 |
| --- | --- | --- |
| F01 重送 | 事件與外部操作去重由應用負責。 | 三者都測相同 webhook 與信件重送。 |
| F02 成功後中斷 | 沒有一項可直接判定通過。 | ADK 明列工具可能重跑；Pydantic 工作流程引擎仍要查外部效果；Strands snapshot 不是外部交易證明。 |
| F03 編輯與收回亂序 | 來源版本與失效狀態由應用負責。 | 三者都測舊確認、摘要、待辦與記憶失效，避免後到原文復活。 |
| F04 權杖失效 | 停止相依工作並保留進度。 | ADK auth helper、Pydantic Workspace、Strands 搭 Identity 各自測重新授權，不因 wrapper 存在就視為完成。 |
| F05 逾時、5xx | 按 API 類型與結果是否明確分類。 | 三者都測工具重試與外部操作紀錄，不能無條件重試建立或通知。 |
| F06 配額與限流 | 月額度和暫時限流由通知後端區分。 | 框架的模型使用量限制不等於 LINE 月額度控管。 |
| F07 冒充與文件指令 | 程式驗證律師與案件權限。 | 三者工具名單或 hook 可輔助，但模型不得修改授權範圍。 |
| F08 封鎖與無權限 | 保存接受、失敗及未確認狀態。 | 三者都不能從工具成功回傳推論客戶已讀。 |
| F09 等確認時重啟 | 需保存同一內容版本並驗證回覆身分。 | ADK 先處理已列明的 Session 相容限制；Pydantic 保存完整 Conversation 與延後要求；Strands 保存 interrupt 狀態。三者都測過期與改版。 |
| F10 同名、多案、多律師 | 身分和案件 ID 由應用決定。 | 三者都測隔離查詢、記憶檢索、通知和 Google 授權。 |
| F11 來源權限撤銷 | 快取、索引及衍生摘要停止檢索。 | Session、Memory 與工作歷史中的副本也要依保存規則處理，不以來源 ID 代替授權。 |
| F12 驗簽或保存失敗 | 不啟動 Agent 或外部操作。 | 三者只處理已驗簽及持久保存的事件，前置失敗由入口拒絕及告警。 |

## 下一輪最小驗證

使用同一組合成資料，包含範例客戶甲、範例客戶乙及範例律師甲。三個候選都先做同一條流程，收事件、辨案、產生行事曆草稿、等待律師確認、重啟、建立活動、通知。實際串接需具備隔離測試帳號與必要設定，正式部署依使用者指示執行，本輪沒有執行。

至少在工具呼叫前、外部 API 成功後及操作紀錄寫入前注入中斷。另測來源修改、舊按鈕、Google 授權撤銷、同一事件重送與同一案件並行操作。記錄外部系統中實際活動、資料夾和訊息數量，不能只看 Agent 最後一句回答。

仍有以下缺口，不能作為已通過的結論。

- 三者尚未選定可重現的發布版本，文件及 `main` 可能有功能落差。
- ADK 工具確認與正式 Session 後端的可行組合尚未實測。
- Pydantic Harness 的 Workspace MCP 與核心版本相容性、各 Google 工具範圍尚未實測。
- Strands 新舊 Session manager 的遷移、並行與 interrupt 恢復尚未實測。
- 三者的 Google OAuth、雲端區域、配額、保留與刪除設定、追蹤實際內容及成本尚未驗證。
- 三者都未通過 R01 至 R15 或 F01 至 F12 的實際 API 驗收。

文件研究狀態為 PASS，正式採用判斷仍有上述待測事項。這裡的 PASS 只表示本分組的文件比較完成，不代表系統功能或安全驗收通過。
