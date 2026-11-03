# 13 個框架的第一輪比較與驗證優先順序

查證日期：2026-11-03。狀態為官方文件研究完成第一輪，尚未固定可重現的套件版本、建立原型或驗證真實 API。以下順位是依需求提出的研究判斷，不是測試排名或正式採用決定。

## 目前判斷

先用 LangGraph 與 Pydantic AI 驗證兩種做法。LangGraph 把案件處理寫成明確步驟，Pydantic AI 則作為有型別工具與確認機制的模型層，由後端管理案件工作。第三條路線依語言與模型前提比較 OpenAI Agents SDK 或 Vercel AI SDK。

這個安排保留不同設計的對照，不預設模型、開發語言或雲端供應商。若選 TypeScript，Vercel AI SDK 應進入第一組驗證；若選 .NET 或已有 Azure 基礎，Microsoft Agent Framework 應提高順位。目前尚未確認這些偏好，因此不以「團隊不熟」排除任何選項。

選型的核心是案件與權限、跨日確認、來源失效、重啟恢復及雲端維護。規劃、Shell、子代理、Skills 可以按需加入，不以功能數量相加決勝。

## 統一比較方式

每個選項都對照 [15 項功能與 12 項故障情境](requirements-and-acceptance.md)。來源分為官方文件確認、原始碼確認、設計推論與待實測。各分題可能使用查證日 `main` 或滾動文件，正式驗證前須固定發布版本及相容套件，不能把文件現況視為穩定套件功能保證。

本案所有選項都需要 LINE 驗簽及事件保存、Google OAuth、案件資料庫、通知規則、外部操作紀錄與定時啟動方式。Session、checkpoint、記憶、排程及外部操作防重複是不同能力，不能互相代替。

比較先檢查能否合理完成必要行為，再看補足工作、維護負擔、模型替換、資料保存與成本。沒有實測資料時不評出虛構的效能、工時或費用分數。

## 全部選項的取捨

表中能力摘要的官方依據在各分題文件。採用時機與順位為本案設計判斷。

| 選項 | 能提供的基礎 | 本案的主要缺口或風險 | 本輪處理 |
| --- | --- | --- | --- |
| Codex SDK | 透過 SDK 嵌入 Codex，TypeScript 與 Python 封裝不同。 | 程序與檔案生命週期、Google 業務工具、跨重啟確認與外部操作仍需核對。 | 保留完整 Agent 對照，文件工作區與 Skills 成為核心時提高順位。 |
| Codex App Server | 雙向事件、工具請求、thread 與核准協定。 | 需維護協定與 runtime，部分傳輸及動態工具仍有實驗性條件。 | 需要完整嵌入 Codex 的產品控制時優先重考，不只為 LINE webhook 引入。 |
| Claude Agent SDK | 現成 Agent、工具權限、Session，並有受限的 defer。 | 包裝層與核心授權不同，defer 單工具限制及雲端服務驗證待確認。 | 保留通用文件助理對照。需證明完整 runtime 對本案有實際收益。 |
| GitHub Copilot SDK | 多語言、工具與權限 callback，另有精簡模式與 Session 儲存路徑。 | 核心閉源、BYOK 文件有差異，待確認的跨程序恢復需測。 | 多語言或既有 Copilot 條件成立時提高順位，不能沿用早期 Preview 印象。 |
| LangChain deepagents | 在 LangGraph 上加規劃、檔案 backend、子代理與工具確認。 | 固定法務流程未證明需要完整自主操作，須限制檔案及子代理範圍。 | 先作受限文件研究的後續選項，與單用 LangGraph 分開評估。 |
| Pi | 可嵌入、可改核心的 TypeScript Agent，現行版本有 MCP。 | 持久業務工作、LINE 確認與雲端治理需自行建立。 | 需要完全掌握迴圈與資源載入時重考，不因精簡或 coding 出身直接排除。 |
| Google ADK | 工具、Session、Memory、工作流程及 Google 託管路線。 | 目前工具確認文件明列部分持久 Session 後端不支援。Google 品牌不能省掉 OAuth。 | Google Cloud 整合對照，先驗證確認與儲存的可行組合。 |
| OpenAI Agents SDK | 自訂工具、Session、序列化 RunState 與人工確認。 | 仍需背景工作、案件記憶及操作紀錄。非 OpenAI 適配的功能差異待測。 | 若以 OpenAI API 為主，作模型與工具層的優先對照。 |
| Pydantic AI | 型別依賴、結構化資料、延後工具與可恢復執行整合。 | 儲存與背景工作需選定，Harness 整合和核心的版本風險分開看。 | 優先驗證明確工具與較少流程抽象的做法，不預設一定加大型工作流引擎。 |
| Vercel AI SDK | TypeScript 模型介面、工具與確認，可另配 Workflow。 | AI SDK、Workflow 與託管平台是不同元件，需確認保存、成本及執行時限。 | TypeScript 路線優先對照，不因沒有網頁聊天介面而排除。 |
| Strands Agents | 自訂工具、interrupt、Session 與多模型，可選 AgentCore。 | SDK、完整 Harness 與雲端生命週期分開，Google 授權及業務狀態仍需補。 | AWS 或 AgentCore 部署對照，實際維運收益再決定順位。 |
| Microsoft Agent Framework | .NET、Python 工作流、核准、checkpoint 與 Durable Extension。 | 核心、擴充套件與託管服務的版本及儲存組合須分開核對。 | .NET 或 Azure 路線優先，不能以整體仍 Preview 為由淘汰。 |
| LangGraph | 明確狀態圖、持久 checkpointer、interrupt 與跨 thread Store。 | 節點可能重跑，排程與工作啟動需另接。託管 Server 的授權與套件不同。 | 優先驗證固定流程、跨日等待與來源版本控制。 |

詳細來源與證據分組如下。

- [Codex SDK、App Server 與 OpenAI Agents SDK](frameworks/openai-options.md)。
- [Claude Agent SDK、Copilot SDK 與 Pi](frameworks/agent-runtimes.md)。
- [Google ADK、Pydantic AI 與 Strands](frameworks/python-cloud-frameworks.md)。
- [Microsoft Agent Framework、LangGraph、deepagents 與 Vercel AI SDK](frameworks/workflows-typescript.md)。

## 先驗證三種工作方式

| 路線 | 優先原型 | 要回答的問題 | 何時改換候選 |
| --- | --- | --- | --- |
| 明確案件工作流 | LangGraph 加持久 checkpointer。 | 等律師確認、原文收回、重啟與重複回覆是否容易正確表達及驗收？ | 若只有少量固定呼叫，圖與 checkpoint 是否增加維護工作？.NET 或 Azure 條件成立時與 Microsoft 路線重比。 |
| 業務後端加模型工具層 | Pydantic AI 核心加案件及操作資料庫。 | 不依賴完整自主 Agent，能否完成相同 R、F 案例？需要哪一種背景執行機制？ | 若以 OpenAI 為主要供應商，與 Agents SDK 的 RunState 組合比較，再選其一深入。 |
| TypeScript 工具與持久背景工作 | Vercel AI SDK 加一套選定的背景機制。 | 同樣的確認、重啟與 Google 工具流程，在 TypeScript 是否更合適？ | 若不選 TypeScript 或平台保存條件不合，降低此原型優先順序。 |

這是下一輪驗證路線，不是已縮選完畢的三個正式候選。需要測試帳號才能確認的前提尚未通過，因此研究計畫的最終縮選項目仍保持未完成。

Microsoft、ADK、Strands 與各完整 Agent 都有合理採用條件，未進入第一批原型不代表不能做。模型、開發語言、雲端既有條件與驗證結果改變時，按上表重考。

## 雲端方向與資料控制

先比較通用託管容器加 Postgres，以及 Cloud Run 分段工作。框架專屬託管服務作另一組對照，詳見 [雲端部署研究](cloud-deployment-research.md)。不在這輪指定正式供應商。

LINE 的 PDF 限制、群組收件人計費、事件及身分規則已整理於 [LINE 研究](line-api-research.md)。個人 Gmail 與 Workspace 的 OAuth、權杖、Drive 分享及即將生效的 MCP 要求見 [Google 研究](google-integration-research.md)。所有框架共用這些前提，不把現成 wrapper 算成整合已完成。

計畫先用 API 憑證與明確使用量估成本。訂閱登入有技術路徑時仍需確認對應產品的帳號、服務對象、條款與權杖管理，不能只依「登入成功」決定正式服務可用。

## 原型前還缺哪些證據

1. 固定候選與儲存套件的發布版本，核對 `main`、網站與可安裝套件的差異。
2. 確認 LINE Provider、帳號認證、實際方案與可用的隔離測試群組。
3. 準備 Google 個人帳號的測試授權，驗證最小 scopes、續期、撤銷與受控文件存取。同時比較候選支援 Workspace 的方式與限制，納入縮選；Workspace 只延後實測，保留後續驗收，不以個人帳號結果宣稱已支援並驗證 Workspace。
4. 同一條流程保存待確認內容，停止程序，再由另一個實例恢復。拒絕舊內容、過期及他人確認。
5. 在外部成功而結果尚未保存時中斷，核對 Calendar 與 LINE 各自的去重及未知結果規則。
6. 比較同一組合成案件的成功率、操作錯誤、模型用量、平台用量與實際部署步驟。

所有模型與實際 API 測試目前均未執行。成本仍缺案件量、附件量、模型與區域假設，不以未實測的數字宣稱某框架最快、最便宜或最適合上線。
