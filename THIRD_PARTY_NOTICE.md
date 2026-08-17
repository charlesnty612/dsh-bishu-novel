# Third-Party Notice

本仓库 `dsh-bishu-novel` 是
[alikon-art/DeterminFlow-Plugins](https://github.com/alikon-art/DeterminFlow-Plugins/tree/main/plugins/bishu-novel)
中 `bishu-novel` 工作流向 DeepSeek Harness（DSH）的**非官方移植插件**，原作者为
[alikon-art](https://github.com/alikon-art)。

## 来源

- 原作工作台（DeterminFlow 引擎）：<https://github.com/alikon-art/DeterminFlow>
- 原作插件（bishu-novel）：<https://github.com/alikon-art/DeterminFlow-Plugins/tree/main/plugins/bishu-novel>

## 承袭内容（来自原作）

- 7 条工作流定义：`build` / `character` / `story-plan` / `outline` / `mvp` / `polish` / `post-hoc`
- Agent 提示词与角色定义（`resources/agents.json`、`resources/prompts.json`）
- 脚本库（`resources/script-library/nvl/`）的 Python 脚本与说明文档
- 写作协作 skill 包（`resources/skill-bundles/writing-assistant/`）

## 本仓库新增内容（DSH 适配层）

- `lib/index.js`：cordis 插件入口、`ctx.tools.register` 注册 10 个 `bishu_*` 工具、把原作的工作流执行器适配到 DSH 进程模型。
- `lib/client.js`：浏览器侧三 tab 工作台 UI（书籍 / 工作流 / 运行）。
- `cordis.patch.yml`：DSH 挂载声明（`id: bishu-novel`，作为一行 host 插件）。
- HTTP 路由（`/api/dsh-bishu-novel/*`）与持久化偏好（`~/.dsh/dsh-bishu-novel-preferences.json` 等）。
- 本 `THIRD_PARTY_NOTICE.md` 与 README 「致谢 / Credits」段。

## 许可证

原作 `DeterminFlow` 与 `DeterminFlow-Plugins` 均以 **GNU Affero General Public License v3**（AGPL v3）发布。
本仓库根目录的 `LICENSE` 文件为原作许可证的完整副本。本移植的发布遵循同条款——
任何分发或网络服务场景下都必须以 AGPL v3 条款公开相应修改与源代码。

如有原作者的额外要求，请在本仓库开 issue 联系，我们会配合处理。
