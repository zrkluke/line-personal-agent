# Agent 執行環境比較

查證日期為 2026-11-03。工作區基準為 `bd6b7b8cb577a0c80fe5d8ddc56d3877e5a70a82`。範圍限 Claude Agent SDK、GitHub Copilot SDK 與 Pi，評估用途是雲端或託管的 LINE 法務助理。這份比較不預選框架。

本輪採官方文件、官方儲存庫與原始碼交叉閱讀，沒有安裝套件、建立金鑰、呼叫模型、部署服務或讀取私人資料。下列連結均已實際開啟。GitHub 來源適用於查證日的 `main`，不代表套件管理器的穩定版已有全部功能。正式驗證須同時固定 SDK、底層執行環境及文件版本，不以本文推測精確最新版本。

證據分成「官方確認」、「設計推論」與「待實測」。官方確認僅表示文件或程式碼有此能力，不表示已通過本專案驗收。需求依 [需求與驗收基準](../requirements-and-acceptance.md)，外部服務前提依 [LINE 研究](../line-api-research.md) 與 [Google 研究](../google-integration-research.md)。

## 比較重點

三者都能執行自訂工具。差別在於底層程式能否修改、權限預設、模型接入方式與持久化責任。三者的 Session 都不能直接當案件資料庫，也不能證明外部操作只執行一次。

| 比較項目 | Claude Agent SDK | GitHub Copilot SDK | Pi |
| --- | --- | --- | --- |
| 主要介面 | Python、TypeScript。 | TypeScript、Python、Go、.NET、Java、Rust。 | TypeScript SDK，其他語言可接 RPC。 |
| 底層 | Claude Code 子程序。 | 預設 Copilot CLI 子程序，另有實驗性的程序內執行方式。 | 可直接嵌入 Node.js 或 Bun，也能另起 RPC 程序。 |
| 能修改哪一層 | Python 包裝層為 MIT；TypeScript SDK 與 Claude Code 另受商業條款規範。 | SDK 為 MIT；CLI 授權禁止修改。 | MIT，包含模型接入、Agent 迴圈與 coding-agent 原始碼。 |
| 等律師確認 | Callback；另有受條件限制的 `defer`。 | 權限及使用者輸入 callback、待回覆 RPC。 | 自訂工具、事件攔截及 UI callback。 |
| 跨程序續接 | Session 與外部 `SessionStore`。 | Session 與 `sessionFs`。 | JSONL Session 與 `SessionManager`。 |
| 模型選擇 | 官方路線以 Claude 為核心，可經不同雲端供應商。 | Copilot 模型目錄或 BYOK。 | 多家供應商及相容端點，可替換接入層。 |
| 本專案必須另外建立 | 三者皆需案件權限、Google OAuth、來源版本、待確認動作、排程工作與外部操作紀錄。 | 同左。 | 同左。 |

表內官方能力的來源與限制列於各節。最後一列是設計推論，不能因採不同框架而省略。

## Claude Agent SDK

### 官方能力與適用範圍

| 面向 | 查證結果 | 證據 |
| --- | --- | --- |
| 語言與維護 | 官方確認。支援 Python、TypeScript，底層沿用 Claude Code。官方變更紀錄持續列出 SDK 與 CLI 對齊更新；本輪不把更新頻率當穩定性保證。 | [概覽](https://code.claude.com/docs/en/agent-sdk/overview)、[main 變更紀錄](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md)。 |
| 授權與可修改範圍 | 官方確認。Python SDK 為 MIT。TypeScript SDK 的授權標示保留所有權利並適用商業條款。Claude Code 的託管條件明定 binary 不得修改。因此不能將整個執行核心寫成開源。 | [Python 授權](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/LICENSE)、[TypeScript 授權](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/LICENSE.md)、[Claude Code 授權與託管條件](https://code.claude.com/docs/en/legal-and-compliance)。 |
| 自訂工具與 MCP | 官方確認。可建立程序內 MCP 工具，也能連外部 MCP。`allowed_tools` 是自動核准清單，不等於移除其他工具。 | [Python SDK 說明](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/README.md)。 |
| 工具權限 | 官方確認。支援拒絕規則、詢問規則、hook 與 `canUseTool`。設計推論。Calendar 寫入及對外通知仍在工具伺服器核對案件與確認版本，不能只依模型選工具。 | [權限判定順序](https://code.claude.com/docs/en/agent-sdk/permissions)。 |
| 等待確認 | 官方確認。`canUseTool` 可暫停並等待回覆；長時間等待可用 `PreToolUse` 的 `defer` 結束目前回合，保存待呼叫工具後再 resume。 | [使用者輸入](https://code.claude.com/docs/en/agent-sdk/user-input)。 |
| `defer` 限制 | 官方確認。只適用非互動模式，且該回合只能有單一工具呼叫。多工具呼叫時會忽略 `defer` 並回到一般權限流程。恢復時須重接工具與權限設定；未取得答案時應不帶新 prompt 恢復。設計推論。不能把它當所有寫入動作的唯一防線。 | [Defer a tool call for later](https://code.claude.com/docs/en/hooks#defer-a-tool-call-for-later)。 |
| Session 與長期記憶 | 官方確認。Session 保存 prompt、工具呼叫、結果與回答，支援 resume、fork。Session 不保存完整檔案系統狀態。設計推論。R14 所需的核准、修正、刪除與來源失效仍需案件記憶資料表；`CLAUDE.md` 或對話摘要不足以替代。 | [Session](https://code.claude.com/docs/en/agent-sdk/sessions)。 |
| 外部持久化 | 官方確認。`SessionStore` 可將 JSONL 紀錄鏡像到自有儲存，再供另一主機恢復，仍涉及匹配的工作目錄。設計推論。需另外處理單一 Session 的寫入競爭與業務交易。 | [SessionStore](https://code.claude.com/docs/en/agent-sdk/session-storage)。 |
| 雲端程序與隔離 | 官方確認。SDK 管理長時間存在的 Claude Code 子程序及本機工作目錄、Session 檔。Python 原始碼實際以 `anyio.open_process` 傳入 `cwd`、環境及 stdin/stdout。設計推論。部署須支援子程序、暫存磁碟、受控網路及租戶隔離，不能直接假設任何邊緣函式都能跑。 | [Hosting](https://code.claude.com/docs/en/agent-sdk/hosting)、[Python subprocess transport](https://raw.githubusercontent.com/anthropics/claude-agent-sdk-python/main/src/claude_agent_sdk/_internal/transport/subprocess_cli.py)。 |
| 背景排程 | 官方確認。Claude Code 有 Session 排程，也另有雲端排程產品；Session 排程恢復仍有條件。設計推論。R05、R08、R15 使用雲端排程器與持久工作佇列啟動 SDK，不依賴對話仍在執行。不能因 CLI 有 `/loop` 就宣稱本服務排程已完成。 | [排程方式與限制](https://code.claude.com/docs/en/scheduled-tasks)。 |
| 紀錄與敏感資料 | 官方確認。OpenTelemetry 預設記結構資訊，可另開啟 prompt、工具參數、工具內容與完整 API body。Session 本身另會留內容。設計推論。正式環境關閉內容匯出，工具回傳先縮減資料，Session 設獨立權限、保存期限與刪除流程。 | [敏感資料匯出](https://code.claude.com/docs/en/agent-sdk/observability#control-sensitive-data-in-exports)。 |

### 認證、計費與 Google 缺口

官方確認。SDK 的產品整合路線使用 Anthropic API key，或受支援的雲端供應商憑證。第三方未經核准不能把 claude.ai 登入或訂閱額度提供在自己的產品裡。這不能解讀為買一份 Pro 或 Max 就可承擔事務所服務全部請求。[SDK 快速入門](https://code.claude.com/docs/en/agent-sdk/quickstart)

官方確認。SDK 可回傳 token 與成本資訊，費用仍依實際模型及供應商計費；訂閱與 API 帳單分開評估。[成本追蹤](https://code.claude.com/docs/en/agent-sdk/cost-tracking) 待確認。Claude Code 託管產品條件對終端使用者自帶憑證與費用歸屬另有要求。單一律師自用、事務所內部服務及未來對外產品的適用方式，須依選定合約與供應商確認，本文不代作法律判定。[託管條件](https://code.claude.com/docs/en/legal-and-compliance)

設計推論。Google Cloud 提供 Claude 推論，不等於取得 Gmail、Drive 或 Calendar 權限。MCP 接通也不會完成 Google 使用者 OAuth、案件檢索過濾、信件同步游標、受控附件連結或 Calendar 去重。這些都由自訂 REST 工具或受控 MCP 服務補上，沿用共同 Google 研究。

### 採用與重考條件

設計推論。若文件處理需要 Claude 的既有工具、Python 或 TypeScript 接口、權限 hook 及跨主機 Session，值得進入驗證。若必須修改 Agent 核心、自由替換非 Claude 模型，或憑證與計費模式不符合服務用途，則降順位。

待實測。先驗證 `defer` 在單工具與多工具情況、換主機恢復、舊確認失效，以及外部操作成功後程序中斷。若能固定版本並通過 F02、F07、F09，且正式帳號模式獲確認，再重考採用順序。Managed Agents 是另一項託管產品，不將其能力直接算入本 SDK。

## GitHub Copilot SDK

### 官方能力與適用範圍

| 面向 | 查證結果 | 證據 |
| --- | --- | --- |
| 語言與維護 | 官方確認。支援 TypeScript、Python、Go、.NET、Java、Rust。查證日 README 明列已正式推出並採語意化版本，不沿用早期 technical preview 評價。 | [main README](https://raw.githubusercontent.com/github/copilot-sdk/main/README.md)、[main 變更紀錄](https://raw.githubusercontent.com/github/copilot-sdk/main/CHANGELOG.md)。 |
| 授權與可修改範圍 | 官方確認。SDK 是 MIT。Copilot CLI 另有授權，只允許依條件散布未修改版本，禁止修改、改作。設計推論。可改 SDK 與工具，但不能將 CLI 核心視為可自行維護的開源迴圈。 | [SDK 授權](https://raw.githubusercontent.com/github/copilot-sdk/main/LICENSE)、[CLI 授權](https://raw.githubusercontent.com/github/copilot-cli/main/LICENSE.md)。 |
| 執行方式 | 官方確認。預設透過 JSON-RPC 控制 CLI 子程序，也可接既有 server。程序內 native runtime 仍標示實驗性。 | [架構](https://raw.githubusercontent.com/github/copilot-sdk/main/README.md)。 |
| 工具與權限 | 官方確認。可登記工具與權限 callback。TypeScript 可透過 `onPermissionRequest`、`onUserInputRequest` 或 elicitation 收集決定，亦有待處理 RPC。設計推論。不要在法務寫入流程使用範例的 `approveAll`。 | [Node.js SDK](https://raw.githubusercontent.com/github/copilot-sdk/main/nodejs/README.md)。 |
| 多使用者隔離 | 官方確認。伺服器多使用者模式要求 `mode: "empty"`，明確配置工具、MCP、路徑與各 Session 身分。`baseDirectory` 與 `sessionFs` 可控制狀態位置。設計推論。事務所與案件權限仍由應用程式執行。 | [多使用者伺服器](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/setup/multi-tenancy.md)。 |
| MCP | 官方確認。支援 stdio 與遠端 HTTP 類型，可設定各 server 的工具範圍。部分生命週期 API 要求 SDK 與 runtime 對齊，僅協定版本相同不保證新功能相容。 | [MCP](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/features/mcp.md)。 |
| 序列化與恢復 | 官方確認。可持久保存 Session 並 resume；工具的記憶體狀態及供應商金鑰不隨紀錄保存。文件要求應用程式處理同一 Session 的並行控制。待實測。程序完全停止後，待回覆確認能否以相同操作與版本接續，不能只用一般 resume 範例判定。 | [Session 持久化](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/features/session-persistence.md)。 |
| 長期記憶 | 官方確認。Session 保存對話、工具結果與計畫資料。設計推論。對話壓縮或 persistent memory 工具均不證明符合 R14，核准案件事實及來源失效需另存。 | [Session 持久化](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/features/session-persistence.md)。 |
| 雲端與託管 | 官方確認。除自管雲端程序，另有 GitHub-hosted cloud sessions，要求 cloud-agent entitlement、GitHub 認證及組織政策允許。設計推論。不是把本機 SDK 選項全部搬到雲端就能使用，外部 Google 工具、網路及權杖傳遞仍待驗證。 | [Cloud sessions](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/features/cloud-sessions.md)。 |
| 背景排程 | 設計推論。一般 SDK Session 或 cloud session 不直接證明滿足固定掃信、重啟補跑與通知去重。以外部雲端排程器和佇列啟動已授權的工作，保留業務工作狀態。官方另有組織自動化認證路線，仍有帳號資格限制。 | [伺服器對伺服器認證](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/auth/server-to-server-tokens.md)。 |
| 紀錄與敏感資料 | 官方確認。OpenTelemetry 可輸出至檔案或 OTLP，`captureContent` 控制內容收集。另有 `enableSessionTelemetry`，符合資格的 GitHub 認證 Session 預設啟用，與 OpenTelemetry 分開。設計推論。兩者及 Session 紀錄都須逐一檢查，不能只關 OTLP 就宣稱沒有資料上傳。 | [OpenTelemetry](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/observability/opentelemetry.md)、[Node.js 設定](https://raw.githubusercontent.com/github/copilot-sdk/main/nodejs/README.md)。 |

Python 原始碼的權限處理器會等待非同步決定，處理器出錯時回傳使用者不可用。這證明 callback 有程式端拒絕路徑，不證明 LINE 操作者身分或待確認內容已持久化。[Session 原始碼](https://raw.githubusercontent.com/github/copilot-sdk/main/python/copilot/session.py)

### 認證、計費與文件歧異

官方確認。一般路線使用 Copilot 帳號與其權益；BYOK 可直接使用模型供應商，不需要 GitHub 認證。[認證入口](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/auth/README.md)、[BYOK](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/auth/byok.md) 模型並非只綁 GitHub 或 OpenAI，BYOK 專頁也列 Anthropic、Foundry 與相容端點。模型功能與可用清單仍依選定路線確認。

官方確認。現行 GitHub 計費專頁依模型的輸入、輸出及快取 token 換算 AI credits，方案另有包含額度。README 的「每個 prompt 計入使用量」不足以估算法務工作成本。使用 BYOK 則由模型供應商直接計費。[GitHub 模型與計費](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)、[BYOK 計費路線](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/auth/byok.md)

官方文件有一項歧異。README 仍稱 BYOK 僅支援 key、不支援 Managed Identity，但 BYOK 與 Azure 專頁已列 `bearerTokenProvider` 及 Azure Identity 整合。採用判定先以專頁的能力為候選，不把 README 的限制寫成定論。待實測時固定 SDK/runtime 組合，驗證 token 更新。[README](https://raw.githubusercontent.com/github/copilot-sdk/main/README.md)、[Azure Managed Identity](https://raw.githubusercontent.com/github/copilot-sdk/main/docs/setup/azure-managed-identity.md)

設計推論。Copilot 的 GitHub 登入、GitHub MCP 及組織權益均不能代替 Google OAuth。Google REST 工具、信箱同步、附件權限、案件資料庫與 Calendar 寫入核對需自行接上。若採 Google 官方 MCP，仍需遵守共同研究列出的 OAuth client 條件，並驗證遠端 transport 與授權更新。

### 採用與重考條件

設計推論。若需要多種後端語言、Copilot 訂閱或組織帳務、BYOK 及明確的多使用者模式，值得進入驗證。若要修改核心迴圈、完全避開閉源 runtime，則降順位。文件有歧異時不能以舊版印象直接排除，也不能把 main 的功能全部當穩定套件保證。

待實測。重點為 `mode: "empty"` 下的實際工具清單、各 Session 的金鑰與檔案隔離、Session 遷移後待確認恢復、遙測內容及 BYOK token 更新。Cloud sessions 只有在 Google 工具與資料政策通過後，才能算完整託管候選。

## Pi

### 官方能力與適用範圍

Pi 的舊入口 `badlogic/pi-mono` 已導向 `earendil-works/pi`。本輪研究此官方專案，不混入同名產品或下游整合。查證日套件名稱為 `@earendil-works/pi-coding-agent`，採 `main` 文件。[官方儲存庫](https://github.com/badlogic/pi-mono)

| 面向 | 查證結果 | 證據 |
| --- | --- | --- |
| 語言與維護 | 官方確認。TypeScript SDK 可嵌入 Node.js 或 Bun，也有 CLI、JSON 與 RPC。README 要求 Node.js 22.19 以上。變更紀錄有日期與破壞性變更，例如 2026-11-02 的紀錄。這只是版本觀察，不稱其為永遠最新。 | [README](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/README.md)、[變更紀錄](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/CHANGELOG.md)。 |
| 授權與可修改範圍 | 官方確認。MIT。模型接入、Agent 迴圈與上層 coding-agent 有原始碼，可依授權修改。模型權重與外部服務條款不因此開源。 | [授權](https://raw.githubusercontent.com/earendil-works/pi/main/LICENSE)、[Agent 核心](https://raw.githubusercontent.com/earendil-works/pi/main/packages/agent/README.md)。 |
| 自訂工具 | 官方確認。SDK 可明確供應 tools、customTools、資源載入器與 Session 管理器。工具實際在 `agent-loop.ts` 呼叫 `execute`，其前後處理亦可閱讀修改。 | [SDK](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sdk.md)、[Agent 迴圈原始碼](https://raw.githubusercontent.com/earendil-works/pi/main/packages/agent/src/agent-loop.ts)。 |
| MCP | 官方確認。現行版本已有 stdio 與 streamable HTTP MCP，不支援舊 SSE。CLI 內建載入，SDK 則須明確加入 MCP extension 並綁定。不能沿用早期「Pi 無 MCP」的結論。 | [MCP](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/mcp.md)、[SDK 載入方式](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sdk.md)。 |
| 工具權限與確認 | 官方確認。extension 可攔截 `tool_call`、拒絕執行、顯示確認及登記工具。Pi 不會預設逐次詢問所有工具。設計推論。LINE 確認須在應用端持久保存，不能直接依賴終端確認視窗。 | [Extensions](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/extensions.md)、[安全邊界](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/security.md)。 |
| Session 與序列化 | 官方確認。Session 用 JSONL 保存帶 parent ID 的樹狀紀錄，可續接與分支。`SessionManager` 是恢復模型上下文的依據。設計推論。自訂 `appendEntry` 可保存業務狀態，但資料完整性與升版相容性由應用負責。 | [格式](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/session-format.md)、[Session](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/sessions.md)、[Extensions](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/extensions.md)。 |
| 長期記憶 | 設計推論。Session、分支摘要與 context 檔能帶入歷史，但不構成已核准、可撤回的案件知識。R14 仍接獨立資料庫，檢索前套案件權限。 | 依上述 Session 能力與本專案 R14 對照。 |
| 背景排程 | 官方確認。可用 SDK 或 CLI 做自動工作。設計推論。本輪未查得能直接滿足 R15 的持久排程服務；採外部排程器、工作佇列與資料庫。這是未找到完整能力，並非宣稱 extension 做不到。 | [自動化入口](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/index.md)。 |
| 雲端與隔離 | 官方確認。工具與 extensions 享有 Pi 程序權限，工作目錄不是隔離邊界。官方列出整個程序放入容器或 VM 等方式。設計推論。可在託管容器部署，須限制網路、掛載資料與憑證，關閉不需要的預設工具及自動資源探索。 | [安全說明](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/security.md)、[隔離方式](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/containerization.md)。 |
| 紀錄與敏感資料 | 官方確認。Session 可能包含 prompt、工具參數、輸出、檔案內容及暴露的憑證。設計推論。自建事件紀錄先遮罩，不啟用 Session 分享流程。待確認。選用 provider 與 extensions 的外送紀錄、保留政策需各別盤點。 | [安全與 Session 分享](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/security.md)。 |

### 認證、計費與 Google 缺口

官方確認。Pi 提供瀏覽器或 device flow 登入、API key 與部分雲端憑證。`auth.json` 可能保存 OAuth token 及 key，登出 Pi 不等於向供應商撤銷權杖。[Providers](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/providers.md)

官方確認。可用受支援的訂閱、API key、相容端點或自訂 provider，模型目錄也可更新。[模型接入](https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/docs/models.md) 設計推論。Pi 開源授權不包含模型推論費用；API 向所選供應商計費，訂閱登入則依該供應商的權益與限制。不能把目錄中的價格估算當實際帳單，也不能把技術上可登入當作已獲准代事務所客戶使用訂閱。

待確認。正式選 provider 後，需由該供應商官方條款確認雲端無人值守、服務帳號及終端使用者範圍。本輪未認證任何一種 Pi 訂閱登入可作對外法務產品。特別是 Claude 官方已限制第三方產品中介訂閱登入，不能因 Pi 支援某種憑證就避開限制。[Claude 憑證用途](https://code.claude.com/docs/en/legal-and-compliance)

設計推論。Google Gemini 或 Vertex 模型登入與 Workspace 資料授權是兩件事。Pi 的 MCP OAuth 解決連線層的一部分，仍需指定正確 Google client、scopes、refresh token 保存與帳號隔離。Drive 歸檔、Gmail 同步和 Calendar 寫入仍建立受控業務工具。

### 採用與重考條件

設計推論。若重視可修改完整 Agent 迴圈、可替換模型、TypeScript 程序內整合與明確控制資源載入，值得進入驗證。若希望直接取得受管理的多租戶服務、持久業務流程及完整確認機制，Pi 所需自建工作較多，應降順位。不能只因開源就忽略維護成本，也不能只因精簡就排除。

待實測。先驗證只登記法務工具時，是否仍有其他檔案、Bash 或 extension 路徑可繞過權限；測試 JSONL 恢復、多人併發與新舊版相容性。若團隊願意負責部署、確認狀態與 provider 治理，且 F02、F07、F09 過關，再重考優先順序。

## 逐項對照共同驗收

以下是設計推論。表格描述各框架的接入位置及仍需完成的工作，不表示任何項目已實測通過。三者共用案件、操作與確認資料模型，避免比較時替某一框架降低要求。

| 編號 | Claude Agent SDK 接入 | Copilot SDK 接入 | Pi 接入 | 三者共同待補或待測 |
| --- | --- | --- | --- | --- |
| R01 | 自訂工具。 | 自訂工具。 | 自訂工具。 | 案件 ID、必填欄位、資料庫唯一鍵及律師權限。 |
| R02 | Drive 工具。 | Drive 工具。 | Drive 工具。 | folder ID、既有資料夾核對與重試去重。 |
| R03 | 工具端案件檢查。 | 工具端案件檢查。 | 工具端案件檢查。 | LINE 身分與群組案件關係，不由 Session 推測。 |
| R04 | 分析下載後檔案。 | 分析下載後檔案。 | 分析下載後檔案。 | webhook 接收、及時下載、掃毒、來源及歸檔。 |
| R05 | 排程啟動 SDK。 | 排程啟動 SDK。 | 排程啟動 SDK。 | Gmail 同步游標與 message ID 去重，不能只掃未讀。 |
| R06 | 模型辨識與工具查證。 | 模型辨識與工具查證。 | 模型辨識與工具查證。 | 矛盾線索轉待確認，保留辨識依據。 |
| R07 | 受控通知工具。 | 受控通知工具。 | 受控通知工具。 | 案件、群組、公開範圍與送出紀錄。 |
| R08 | 摘要與工具更新待辦。 | 摘要與工具更新待辦。 | 摘要與工具更新待辦。 | 排程、來源版本、完成狀態與不重複提醒。 |
| R09 | 自訂查信工具。 | 自訂查信工具。 | 自訂查信工具。 | Asia/Taipei 日期邊界、同步狀態與失敗呈現。 |
| R10 | `canUseTool` 或有條件的 `defer`。 | 權限及輸入 callback。 | 確認 extension 或業務工具。 | 確認內容持久化，身分、版本、時區及 Calendar 結果核對。 |
| R11 | 受控轉發工具。 | 受控轉發工具。 | 受控轉發工具。 | 指定信件與案件、附件受控連結、客戶可讀且他人不可讀。 |
| R12 | 查案件工具。 | 查案件工具。 | 查案件工具。 | 程式端限縮可見案件，區分案件 ID 與法院案號。 |
| R13 | 檢索工具與來源回答。 | 檢索工具與來源回答。 | 檢索工具與來源回答。 | 檢索前權限、來源核准、矛盾及法域不足轉交律師。 |
| R14 | Session 外另存核准記憶。 | Session 外另存核准記憶。 | Session 外另存核准記憶。 | 查詢、修正、刪除、來源與衍生資料失效。 |
| R15 | 雲端工作服務啟動及恢復。 | 雲端工作服務啟動及恢復。 | 雲端工作服務啟動及恢復。 | 沒有新訊息仍執行，重啟保留工作與待確認事項。 |
| F01 | 工具前查操作紀錄。 | 工具前查操作紀錄。 | 工具前查操作紀錄。 | LINE event ID、信箱與 message ID、通知操作 ID 去重。 |
| F02 | SessionStore 不足以保證。 | Session 持久化不足以保證。 | JSONL 不足以保證。 | 外部成功、本地未記錄的中斷點，恢復先核對外部結果。 |
| F03 | 依來源版本重新建立上下文。 | 依來源版本重新建立上下文。 | 依來源版本重新建立上下文。 | 編輯、收回及亂序時讓舊確認、摘要、記憶失效。 |
| F04 | Google 工具回報需重授權。 | Google 工具回報需重授權。 | Google 工具回報需重授權。 | 暫停該帳號依賴工作，保存進度。模型登入不是 Google 授權。 |
| F05 | 外部工具掌管重試。 | 外部工具掌管重試。 | 外部工具掌管重試。 | 逾時不能視為未成功，依 API 規則分類及核對。 |
| F06 | 工具回報限流及額度。 | 工具回報限流及額度。 | 工具回報限流及額度。 | 分開 LINE 月額度、瞬間速率、模型費用與 Google 配額。 |
| F07 | 權限規則加工具伺服器。 | `mode: "empty"` 加權限 callback。 | 限縮工具及資源載入加工具伺服器。 | 模型不得更改白名單，文件指令不得取得案件權限。 |
| F08 | 工具結果保留失敗狀態。 | 工具結果保留失敗狀態。 | 工具結果保留失敗狀態。 | 封鎖、退群及分享權限錯誤，不把 API 接受當已讀。 |
| F09 | `defer` 與 SessionStore 需一起驗證。 | pending 請求與冷恢復需一起驗證。 | 自訂確認資料與 Session 恢復需一起驗證。 | 關閉全部程序後恢復相同內容，舊版、過期及他人確認均拒絕。 |
| F10 | 案件隔離工具及 Session。 | 隔離 Session、憑證及 sessionFs。 | 隔離 Session、資源及工具。 | 同名不合併、多律師並行不跨案，名稱不能當授權鍵。 |
| F11 | 來源與 Session 副本失效。 | 來源與 Session 副本失效。 | 來源與 Session 副本失效。 | 撤銷權限後不再從快取、索引或摘要提供內容，依規則清理。 |
| F12 | 僅接收已驗簽及持久保存的事件。 | 同左。 | 同左。 | 驗簽或保存失敗不啟動 Agent，入口拒絕並告警。 |

## 研究結論與下一輪驗證

本輪狀態為 `ISSUES`。三項官方能力盤點已完成，但沒有任何一項完成法務助理驗收。這裡的問題包括 Copilot 官方 BYOK 說明歧異、訂閱與服務用途的適用範圍，以及三者都仍須實作的業務恢復與 Google 整合。

接續驗證使用同一組範例客戶甲與範例律師甲資料，並固定各自版本。先驗證 R01、R02、R03、R10、R15 搭配 F01、F02、F07、F09、F10，再擴至完整 R01 至 R15、F01 至 F12。排程及外部操作以假服務注入失敗，準備隔離測試帳號後再做真實 API 驗證。LINE 的結果不明需依 retry key 時限處理，不能宣稱可查個別送達。測試報告分開記官方能力、實作結果、帳號限制及成本，不以 Session resume、摘要記憶或 callback 成功回傳替代 exactly-once 證據。
