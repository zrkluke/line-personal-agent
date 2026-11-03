# OpenAI 三個選項的第一輪研究

查證日期：2026-11-03。研究對象為官方現行文件及原始碼 `main` 分支，未安裝或固定驗證版本，沒有執行模型或 API 測試。

共同情境見 [需求與驗收基準](../requirements-and-acceptance.md)。本輪只比較文件能力，採用理由與順位為研究判斷。

## Codex SDK

官方 SDK 目前提供 TypeScript 與 Python。TypeScript 需要 Node.js 18 以上；Python 文件列穩定版、Python 3.10 以上，發布套件包含固定版本的 Codex runtime。[OpenAI Docs](https://learn.chatgpt.com/docs/codex-sdk)

兩種封裝不能視為同一介面。TypeScript 啟動 CLI，透過 stdin 與 stdout 交換 JSONL；Python 控制 app-server 的 JSON-RPC。TypeScript 的 thread 紀錄保存於 `.codex/sessions`，支援續接與結構化輸出。[TypeScript SDK 原始說明](https://github.com/openai/codex/blob/main/sdk/typescript/README.md)

| 面向 | 本案判斷 |
| --- | --- |
| Google 與 LINE 工具 | 可研究 MCP 或相應工具串接，OAuth、案件權限與通知仍由本服務處理。 |
| 等待律師確認 | 依 Python 與 TypeScript 各自公開介面驗證，不能把 app-server 所有能力直接算給 TypeScript 封裝。 |
| 恢復與記憶 | 續接 thread 是對話恢復，R14 案件記憶、F02 外部操作恢復與 R15 排程仍需另外保存。 |
| 雲端 | 需要適用的 CLI/runtime、受控工作目錄、憑證與持久化紀錄。普通 HTTP 函式本身不會維護這些狀態。 |
| 適合原因 | 如果助理需要大量文件工作區、可執行 Skills 或受控腳本，現成環境可能省工作。 |
| 降順位原因 | 目前核心任務是 Google API、確認與排程，須驗證引入完整 runtime 的實際收益。 |
| 重考條件 | 文件工作區、腳本與多步通用任務成為核心，或 Python 封裝可顯著降低 app-server 整合負擔。 |

Codex repo 的授權為 Apache 2.0，可檢查並修改開源核心；這不等於模型推論免費。[原始授權](https://github.com/openai/codex/blob/main/LICENSE)

## Codex App Server

App Server 是嵌入 Codex 的雙向協定，包含 thread、turn、串流事件、工具要求與核准。它與 SDK 共用 Codex runtime，屬串接方式比較，不是另一個獨立模型。[OpenAI 平台說明](https://developers.openai.com/blog/codex-as-a-platform)

官方目前列 stdio、Unix socket 等傳輸。TCP WebSocket 仍標 experimental、unsupported；公開 listener 另須驗證。動態工具也標為 experimental，MCP 是另一條工具接入方式。[App Server 文件](https://learn.chatgpt.com/docs/app-server)

| 面向 | 本案判斷 |
| --- | --- |
| 控制能力 | 比較適合需要精細處理事件、工具請求、取消及確認的服務。 |
| 律師確認 | 能接協定上的確認流程，但等待期間程序失去後如何恢復同一業務核准，必測 F09。不能只用 thread/resume 宣稱通過。 |
| 雲端 | 用內部受控程序串接 LINE HTTP 入口，管理程序生命週期、儲存、版本及隔離。LINE webhook 不能直接接 stdio。 |
| 模型替換 | 維持 Codex 已支援的 provider 與 thread 規則，不能假設任意切換後都能接續同一 thread。 |
| 適合原因 | 產品需要完整嵌入 Codex 的體驗、協定控制與原有 Skills 生態。 |
| 降順位原因 | 本案需自行維護協定用戶端及 runtime，平台能力不能代替案件資料庫與可靠通知。 |
| 重考條件 | 以 Codex 為產品核心，或需要現成完整 Agent 的能力多於具體 API 工作流程。 |

這些協定能力有實驗性欄位及版本變動，原型需鎖 CLI 與 schema 版本，不直接追 `main` 上線。

## Codex 的驗證與費用分開比較

官方列 ChatGPT、API key，以及適用 Enterprise 自動化的 access token 等驗證方式。API key 依平台用量計費，官方建議程式化 CLI 工作採 API key。API key 不保證包含依賴 ChatGPT 連線的所有功能。[驗證文件](https://learn.chatgpt.com/docs/auth)

另有 Sign in with ChatGPT 的 app-server 整合文件，應用需管理 token 更新、識別與程序重啟，模型清單也不等於已確認帳號有權使用。[計畫額度整合](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server)

本案雲端基準先按可管理的 API 憑證與費用估算。訂閱路線保留比較，但不能把本機登入成功當成多個律師或客戶可共享的正式服務方案。實際可用模型、用量與適用條件仍須以預計使用的帳號驗證。

## OpenAI Agents SDK

官方 SDK 的核心為 Agent、Runner、工具、Handoff、Session 與確認流程，可在受控應用中管理迴圈，計算環境另作工具接入。此研究以 Python 為主要查證，TypeScript 對應能力需在原型鎖版後逐項核對。[官方遷移與分工說明](https://developers.openai.com/cookbook/examples/agents_sdk/migrate-from-claude-agent-sdk/readme)

Python repo 採 MIT 授權，能檢查與修改迴圈。[授權](https://github.com/openai/openai-agents-python/blob/main/LICENSE)

| 面向 | 官方確認與本案影響 |
| --- | --- |
| 自訂工具 | 業務操作可寫為明確函式，由應用保存授權與執行權限。不需要為讀信先開放 Shell。 |
| 人工確認 | `needs_approval` 配合 interruptions，`RunState` 可序列化後保存與恢復。核准者、案件與狀態必須由應用驗證。 |
| 外部操作 | 官方明確指出核准不保證 exactly-once，中斷後恢復舊 snapshot 可能重跑工具。必須處理 F02。 |
| 對話與記憶 | Session 保存對話歷史。R14 的案件事實、來源、修正及刪除仍是應用資料。 |
| 可靠背景工作 | 可接 Temporal、Restate、DBOS 等執行整合，仍須另部署所選儲存或執行服務。 |
| 模型 | 有非 OpenAI 接入方式，但適配層的 beta 狀態與功能差異需實測。不能把模型相容理解為完全相同語意。 |

確認與狀態來源為 [Human-in-the-loop](https://github.com/openai/openai-agents-python/blob/main/docs/human_in_the_loop.md)。Session 來源為 [Sessions](https://github.com/openai/openai-agents-python/blob/main/docs/sessions/index.md)。可靠執行來源為 [Running agents](https://github.com/openai/openai-agents-python/blob/main/docs/running_agents.md)，模型來源為 [Models](https://github.com/openai/openai-agents-python/blob/main/docs/models/index.md)。

本案的設計推論是，以服務端保存的待確認工作及不透明操作 ID 接 LINE Postback。快照不放在按鈕內容或客戶端，不接受客戶自行提供的序列化執行狀態。重播與並行恢復由資料庫原子狀態轉換控制。

採用理由是 R01 至 R15 以明確 API 工具為主，R10、R11 及 F09 需要跨回合確認，現有機制值得驗證。降順位理由是仍要自己完成 Google OAuth、記憶、排程與工具正確性；若選非 OpenAI 模型或其他語言，需衡量額外適配。當模型供應商中立性及既有 Python 工具驗證優先時，應與 Pydantic AI 比較。

## 追蹤與資料控制

Agents SDK 的 tracing 預設開啟，敏感輸入輸出也預設可能納入。可停用或限制內容，不能把只關閉正文紀錄等同完全停止外傳。[追蹤設定](https://github.com/openai/openai-agents-python/blob/main/docs/tracing.md)

OpenAI API 資料預設不供模型訓練，不代表零保存。Responses、Conversations、檔案及其他功能有不同保存條件與帳號設定。[資料控制](https://developers.openai.com/api/docs/guides/your-data) 本案先關閉不必要的正文 trace，並在上線前確認實際請求、儲存與刪除行為。訂閱與 API 的資料條件分開驗證。

## 本輪判斷與待實測

在這三項中，先把 OpenAI Agents SDK 放入候選討論；Codex SDK 與 App Server 保留完整 Agent 的對照組，不以缺少內建排程直接排除。這是符合本案流程的研究判斷，尚非 13 個選項的最終排序。

- [ ] 三項各自固定可安裝版本，核對公開文件與發布版本差異。
- [ ] 律師確認等待期間重啟，還原相同動作、參數與案件權限。
- [ ] Google 工具呼叫、取消、逾時、外部操作去重及通知恢復。
- [ ] SDK 與 raw App Server 的控制差異、CPU 與記憶體需求。
- [ ] trace、session、快照與本機檔案的保存及敏感內容。
- [ ] 實際帳號驗證、模型存取、用量及非 OpenAI 路線的功能差異。
