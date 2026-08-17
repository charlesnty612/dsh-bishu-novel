# dsh-bishu-novel

把 DeterminFlow 的 **bishu-novel** 小说生产工作流引擎移植为 DSH 静态插件。
插件在宿主进程里提供 7 条本地工作流 DAG（LLM agent 节点 + python 脚本节点 + 并行/条件/循环网关），
注册 10 个 `bishu_*` 模型工具、若干 `/api/dsh-bishu-novel/*` HTTP 路由，以及一份 `bishu-novel-writing-assistant` 写作协作 skill。

> 同一本书的所有工作流必须使用同一个 `workspace` 目录；落盘文件全部在该工作区里管理。

---

## 致谢 / Credits

本项目是
[alikon-art/DeterminFlow-Plugins](https://github.com/alikon-art/DeterminFlow-Plugins/tree/main/plugins/bishu-novel)
中 `bishu-novel` 工作流引擎向 DeepSeek Harness（DSH）的**非官方移植插件**。

- 原作工作台（DeterminFlow 引擎）：<https://github.com/alikon-art/DeterminFlow>
- 原作插件（bishu-novel）：<https://github.com/alikon-art/DeterminFlow-Plugins/tree/main/plugins/bishu-novel>
- 原作者：[alikon-art](https://github.com/alikon-art)

**承袭范围**：本仓库中 7 条工作流定义（`build` / `character` / `story-plan` / `outline` / `mvp` / `polish` / `post-hoc`）、agent 提示词（`resources/agents.json`、`resources/prompts.json`）、脚本库（`resources/script-library/`）以及写作协作 skill 包（`resources/skill-bundles/writing-assistant/`）的设计与内容均来自原作；本仓库的贡献集中在 DSH 适配层——引擎移植（`lib/index.js`）、工作台 UI（`lib/client.js`）、HTTP 路由、持久化偏好与挂载声明（`cordis.patch.yml`）。

**许可证**：原作 `DeterminFlow` 与 `DeterminFlow-Plugins` 均以 **GNU Affero General Public License v3**（AGPL v3）发布。本仓库根目录附带完整的 `LICENSE`（来自原作）与 `THIRD_PARTY_NOTICE.md`。本移植的发布遵循同条款；若您分发本插件或对其修改，请遵循 AGPL v3 条款。如有原作者的额外要求，请在本仓库开 issue 联系，我们会配合处理。

---

## 1. 安装与挂载

插件放在 DSH 的「workspace 插件目录」下，通过 `cordis.patch.yml` 把自己作为一行挂到宿主组合里：

- 入口：`lib/index.js`（默认 `package.json` 的 `main`）
- 客户端：`lib/client.js`（侧边栏抽屉 UI）
- 资源：`resources/`（workflows / prompts.json / agents.json / script-library）
- 挂载声明：`cordis.patch.yml`（`id: bishu-novel`，作为一行 host 插件）

推荐安装方式（与 DSH workspace 插件安装流程一致）：

1. 在 DSH 安装目录下创建 `plugins/`（或任何 DSH 扫描为 «workspace plugins» 的目录）。
2. 把本仓库内容符号链接（或直接拷贝）到 `plugins/dsh-bishu-novel/`。
3. 启动 DSH，宿主会自动加载 `cordis.patch.yml` 并注册 `bishu-novel` 这一行。
4. 平台自带的 `verify-plugin.mjs` 校验脚本会校验插件基本结构（`package.json` / `lib/index.js` / `lib/client.js` / `cordis.patch.yml` / `resources`）以及 `node --check` 语法。

不需要修改宿主 `cordis.yml`；一切挂载点都来自自身的 `cordis.patch.yml`。

---

## 2. 10 个 `bishu_*` 工具

工具在宿主进程里通过 `ctx.tools.register` 注册，对所有使用 DSH 的 Agent / 主会话直接可见。
工具输出附带 JSON 渲染器，便于在 Tool 卡片里直接展示。

| 工具 | 用途 |
|---|---|
| `bishu_list_workflows` | 列出本地可用工作流（ID / 名称 / 版本 / 节点数 / 必填变量）。 |
| `bishu_get_workflow` | 读取某条工作流的定义：变量、节点、网关。运行前用它核对必填项。 |
| `bishu_run_workflow` | 在指定 `workspace` 启动一条工作流；返回 `run_id` 后异步执行。 |
| `bishu_workflow_status` | 轮询运行进度：状态、当前节点、每节点状态与错误。 |
| `bishu_workflow_result` | 读取已结束运行的结果：耗时、产物文件、节点终态。 |
| `bishu_approve_node` | 审批处于「逐节点审批」模式的当前节点产出（通过 / 拒绝带反馈）。 |
| `bishu_read_artifact` | 读取书籍工作区内的一个相对文件（设定 / 正文 / 角色档案等）。 |
| `bishu_edit_artifact` | 写入或覆盖书籍工作区内的一个相对文件。 |
| `bishu_book_status` | 列出书籍工作区里已存在的关键文件，用于判断当前阶段。 |
| `bishu_list_models` | 列出 DSH 当前可用的 Provider / 模型，用于工作流模型覆盖。 |

---

## 3. 7 条工作流与推荐顺序

工作流定义位于 `resources/workflows/<id>/definition.json`，配套 `script/*.py` 节点脚本。

| 阶段 | 工作流 | 作用 |
|---|---|---|
| 建书 | `build` | 生成世界观、风格、叙事人设等长程设定。 |
| 建书 | `character` | 抽取 / 完善角色档案。 |
| 建书 | `story-plan` | 全书故事规划（卷级）。 |
| 建书 | `outline` | 卷纲 + 近纲。 |
| 章节 | `mvp` | 单章节内容生产（核心）。 |
| 章节 | `polish` | 对已有章节正文进行润色（**会覆盖** `story/<n>/chapter.md`）。 |
| 章节 | `post-hoc` | 章节后验，登记伏笔 / 债务等元信息。 |

**新书前置顺序**：`build → character → story-plan → outline`。

**每章推荐循环**：`mvp → polish（可选）→ post-hoc → 下一章 mvp`。

- `post-hoc` 必须在进入下一章前完成；若先做 `post-hoc`、随后润色又改变了情节事实，应重新跑该章 `post-hoc`；纯措辞调整不必重复。
- `polish` 会覆盖 `story/<章节号>/chapter.md`，运行前确认已有章节正文、清空风险已向用户说明。

---

## 4. 工作台（侧边栏抽屉）

DSH 的 Web GUI 侧边栏出现「Bishu Novel」入口。该抽屉提供了三个 Tab：

- **书籍**：浏览 / 查看 / 编辑书籍工作区文件，检测已落盘的关键产物（与 `bishu_book_status` 等价）。
- **工作流**：选工作流、定稿创作参数、挑运行模型、启动运行（与 `POST /api/dsh-bishu-novel/run` 等价）。
- **运行**：历史运行列表（`/runs`），支持状态过滤、轮询状态、重做。

抽屉与后端通过 `/api/dsh-bishu-novel/*` 路由通信；`/models`、`/runs`、`/approve`、`/tree`、`/open-workspace`、`/pick-workspace` 等端点强制 loopback-only，浏览器侧走同源代理。

---

## 5. 使用方式

**推荐：直接在新主会话中与 Bishu Novel 对话。**

普通 DSH 主会话已经具备全部 `bishu_*` 工具和 `bishu-novel-writing-assistant` skill，
用户在新会话里说一句「我想写一本……」即可由加载了 skill 的 Agent 接手：

1. 调 `bishu_list_workflows` / `bishu_get_workflow` 核对要跑的工作流与必填变量。
2. 调 `bishu_book_status` 看当前书籍已落到哪一步。
3. 与用户确认参数后调 `bishu_run_workflow` 启动；保存返回的 `run_id`。
4. 用 `bishu_workflow_status` 轮询进度；失败时先读错误与节点信息。
5. 终态后用 `bishu_workflow_result` 拿结果、`bishu_read_artifact` 看落盘文件。

工作台抽屉用于「不想打字、或想直接选参数」的浏览器侧使用方式；它是同一组工具与路由的 UI 封装，
并不是运行所必须。

---

## 6. 逐节点审批

启动运行时若把 `approval` 设为 `true`，每个 agent 节点产出后会暂停等待审批：

- 工作流状态变为 `awaiting_approval`。
- 调用 `bishu_approve_node`（或同一会话里点抽屉审批按钮 / `POST /api/dsh-bishu-novel/approve`）决定通过 / 拒绝：
  - `approved=true` → 通过，继续流水线。
  - `approved=false` + `feedback` → 节点带反馈重新生成（最多 `node.max_reject_count` 次尝试）。

审批可在抽屉的「运行」Tab 中逐节点弹窗预览（首 2000 字），也可在主会话里由 Agent 总结后带反馈调用工具。

---

## 7. 模型选择

支持三级覆盖，优先级从高到低：

1. **节点级覆盖**：`bishu_run_workflow` 的 `node_models` 字段，按 `agent_type` 单独指定模型（`{"novel-director": {"provider": "...", "model": "..."}}`），最高优先。
2. **运行级覆盖**：`bishu_run_workflow` 的 `model` 字段，本次运行所有 agent 节点共用一个模型。
3. **持久化偏好**：运行成功后，按 `workflow_id` 写回 `~/.dsh/dsh-bishu-novel-preferences.json`；下次同一条工作流运行会读取这些偏好。
4. **缺省**：继承主会话默认模型（可用 `bishu_list_models` 查 Provider / 模型列表）。

后端会校验 `provider` 和 `model` 字段均为非空字符串，否则忽略该覆盖。

---

## 8. 持久化文件

| 路径 | 内容 |
|---|---|
| `~/.dsh/dsh-bishu-novel-preferences.json` | 每个工作流的运行级 / 节点级模型偏好。 |
| `~/.dsh/dsh-bishu-novel-history.json` | 历史运行列表（最多 200 条，跑完或失败时追加）。 |

两文件都和 DSH 同源，写入失败只打 console 错误，不会影响工作流本身的运行。

---

## 9. 开发

- 修改 `lib/index.js` 后用 `node --check lib/index.js` 校验语法。
- 工作流定义、提示词、脚本节点由 `resources/` 下的 JSON / Python / md 文件承载；插件启动时一次性加载并缓存。
- python 解释器默认 `python`，可通过环境变量 `DSH_BISHU_PYTHON` 覆盖。
