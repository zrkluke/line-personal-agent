# line-personal-agent

遠端 repo：[zrkluke/line-personal-agent](https://github.com/zrkluke/line-personal-agent)。

## 法務助理研究計畫

[框架與雲端部署研究計畫](docs/research-plan.md) 記錄法務助理需求、全部 13 個評估選項、雲端部署限制、研究步驟與目前進度。

第一輪成果可先看 [13 個框架比較](docs/framework-comparison.md)，再看 [LINE API 限制](docs/line-api-research.md)、[Google 授權](docs/google-integration-research.md)、[需求與驗收](docs/requirements-and-acceptance.md) 及 [雲端部署](docs/cloud-deployment-research.md)。目前完成文件研究，原型與實際 API 驗證尚未執行。

Google 個人帳號與 Workspace 都納入研究、選型與支援規劃。本輪先用個人帳號實測；Workspace 因目前無法提供測試環境，保留相容性研究與後續實測項目，不以個人帳號結果宣稱 Workspace 已驗證。

實際串接前請依 [LINE 與 Google 測試環境設定](docs/test-environment-setup.md) 準備帳號、雲端網址與憑證。公開 repo 只保存 [空白設定範本](.env.example)；實際密鑰與私人資料依 `.gitignore` 排除，雲端改由秘密管理服務提供。

## pstack 技能

此 repo 的 `.agents/skills/` 已安裝 pstack，採用支援 Codex 的 [pstack 社群移植版](https://github.com/michael-denyer/pstack-claude)，原始專案為 Cursor 收錄的 [pstack](https://github.com/cursor/plugins/tree/main/pstack)。

- 安裝日期：2026-11-03。
- 上游版本：[`513c0886b79abb04065293581a4ef7e70049e4f2`](https://github.com/michael-denyer/pstack-claude/tree/513c0886b79abb04065293581a4ef7e70049e4f2)。
- 安裝範圍：僅限此 repo，共 67 個 skill 目錄，包含 24 個 `principle-*` 參考技能；保留上游內容。
- Codex 會從專案的 `.agents/skills/` 載入技能，詳見 [OpenAI Docs](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)。

### 使用方式

在這個專案的 Codex 對話中直接指定技能，例如：

```text
用 poteto-mode 幫我規劃並完成這個功能：……
```

需要設定各角色使用的模型與推理程度時，可說：

```text
用 setup-pstack 設定 Codex 可用的模型與推理程度。
```

這次採用 skills 安裝方式，沒有安裝 plugin 的自動啟動 hook。工具與模型的 Codex 對應方式見 [Codex 相容說明](.agents/skills/poteto-mode/references/codex-tools.md)。部分工作流程需要額外工具，例如 GitHub CLI 或 Bun，依實際使用的技能再安裝。

### 更新與授權

這份安裝固定在上述版本，不會自動更新。更新時請查看[上游說明](https://github.com/michael-denyer/pstack-claude#other-harnesses)，確認新的版本，再更新此 repo 中的完整 pstack skills，並同步記錄版本。

授權與來源聲明保留於 [licenses](.agents/skills/poteto-mode/references/licenses/)，包含 MIT 授權、Cursor 衍生內容授權與 skills 安裝的來源聲明。
