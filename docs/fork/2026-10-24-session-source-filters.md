# SPEC：会话来源筛选 + 项目列表排序与分批渲染（fork）

状态：已实现并部署（2026-10-24）：A `c78f949`，B+C 见其后的提交。仓库：`jiji262/vibeallday`（上游 v0.10.2 的 fork）。

## 1. 问题与事实

用户截图里的两个问题，在本机数据上的实测：

- 「全部会话」和侧栏「最近 24 小时」被大量「Generate an image using your image_generation tool…」淹没。来源是 `codex-image2` skill：每生成一张图就 `codex exec` 一次，每次都留下一个 Codex 会话，工作目录在 `…/_gen`。
- 项目列表有 206 个项目，其中 20 个是 `_gen` 目录，同样来自 `codex exec`。`/api/projects` 本地 0.1 s、114 KB；页面一次性渲染全部卡片。

本机会话按来源统计（读 Codex `session_meta.originator/source`、Claude 首条记录的 `entrypoint`，以及首条用户消息）：

| 来源 | 判定 | 数量 |
| --- | --- | ---: |
| Claude Desktop（交互） | `entrypoint=claude-desktop`，首条用户消息不是定时任务 | ≈402 |
| Claude Desktop 定时任务 | `entrypoint=claude-desktop`，首条用户消息以 `<scheduled-task` 开头 | 176 |
| Claude CLI | `entrypoint=cli` | 6 |
| Claude SDK（VIBEALLDAY、HAPI 等程序拉起） | `entrypoint=sdk-*` | 20 |
| Codex Desktop | `originator` 含 `desktop`（如 `Codex Desktop`、`codex_work_desktop`） | 177 |
| Codex exec（脚本 / skill / Desktop 自动化） | `originator=codex_exec` 或 `source=exec` | 1144 |
| Codex 其他（CLI、MCP、Claude Code 插件、VIBEALLDAY 拉起） | 其余 | 56 |

Codex 三行是部署后 VIBEALLDAY 目录（catalog）的实测值，共 1979 个会话；最初按另一口径估的 61 / 245 / 5 偏小。

VIBEALLDAY 现状：
- Codex 摘要已经带 `originator`/`source`，Claude 摘要没有 `entrypoint`。
- 列表项 `GlobalSessionItem` 不带这些字段。
- 「全部会话」会把全部会话分页拉到浏览器里，再在本地按 Providers、Projects、时间等条件过滤。

## 2. 设计

### 2.1 服务端：会话来源 `launchSource`

- 新增归一化字段 `launchSource`，取值：
  `claude-desktop` | `claude-scheduled` | `claude-cli` | `claude-sdk` | `codex-desktop` | `codex-exec` | `codex-other` | `unknown`。
- 判定写成一个纯函数 `classifyLaunchSource({ provider, originator, source, entrypoint, firstUserText })`，放在 shared，带单元测试。
- Claude：在摘要解析时记录首条 `entrypoint`，并判断首条用户消息是否以 `<scheduled-task` 开头。
  - 这两项都来自文件头部，不需要读整个文件。
  - 旧的摘要缓存里没有这两项，用文件头部的轻量读取补齐（按 mtime/size 缓存）。这样不必提升 session index 版本、全量重解析 3.8 GB。
- Codex：直接用已有的 `originator`/`source`。
- 下发：
  - `GlobalSessionItem` 和 retained collection 行增加 `launchSource`。
  - `Project` 增加 `sessionCountsBySource`（各来源会话数）和 `lastActivityBySource`，供项目页筛选、排序。
- 兼容：只加可选字段，旧客户端忽略。

### 2.2 客户端：「全部会话」和侧栏

- 「全部会话」筛选栏新增「来源」多选（与 Providers 同款），URL 参数 `source=`，在本地过滤，同时出现在排除原因里。
- 新增一个本机偏好「隐藏自动化会话」，自动化 = `codex-exec` + `claude-scheduled`，**默认开**（已确认）。
  - 作用范围：侧栏「最近 24 小时」、「全部会话」的默认结果、项目卡片上的会话数和最后活动时间。
  - 「全部会话」里在「来源」中勾选自动化来源，或关掉该偏好，就能看到这些会话。
- 「只看 Claude Desktop」= 「来源」只勾 `Claude Desktop`。

### 2.3 客户端：项目列表

- 顶部工具栏：
  - 「来源」多选：只显示含所选来源会话的项目，卡片上的会话数和最后活动时间按所选来源计算。默认排除自动化来源，于是只含 `codex exec` 会话的 `_gen` 项目会被隐藏。
  - 「排序」：最近活动（默认，保留「需要处理的排在最前」）/ 名称 A–Z / 会话数。
  - 选择记在本机 localStorage。
- 分批渲染：先渲染 30 个，滚到底部时由 IntersectionObserver 触发再加 30 个；筛选或排序变化后回到前 30 个。
- 数据仍然一次请求拿全量（114 KB）。原因：排序和筛选需要完整集合，服务端分页会让「按名称排序」和「按来源筛选」结果不一致；渲染才是成本所在。

## 3. 分阶段（每阶段独立可验证、独立部署）

| 阶段 | 内容 | 验证 | 估时 |
| --- | --- | --- | --- |
| A | 服务端 `launchSource` 分类函数及测试；Claude 头部 entrypoint 和定时任务读取；列表项和项目上的来源字段 | 单元测试；本机 `GET /api/sessions`、`/api/projects` 的来源计数与第 1 节表格一致 | 3–4 h |
| B | 「全部会话」来源筛选；「隐藏自动化会话」偏好作用于侧栏和全部会话；中英文文案 | hook/组件测试；本机页面只勾 Claude Desktop 后不再出现 Generate image 和 scheduled-task | 2–3 h |
| C | 项目页来源筛选、排序、分批渲染 | 组件测试；本机页面首屏只渲染 30 张卡片，滚动后追加，`_gen` 项目默认隐藏 | 2–3 h |

每阶段完成后：lint、typecheck，和相关测试与基线比对；构建 Mac 包和远程页，按 `0.servers/docs/oracle.md` §19.4 部署。

## 4. 待确认

1. 自动化会话（Codex exec、Claude 定时任务）是否**默认隐藏**？→ **已定：两类都默认隐藏**（2026-10-24 用户确认），筛选里可以勾回来。

## 5. 不做（out of scope）

- 不删除、不归档任何会话文件；只做显示层过滤。
- 不改 `codex-image2` skill 本身。让它不留会话（例如 `codex exec --ephemeral`）是另一件事，可以单独做。
- 「全部会话」页仍会把全部会话拉到浏览器；把它改成按需加载是单独的改动。
- 不做项目搜索框、不做服务端分页。

## 6. 实现与设计中的修正

- `Codex Desktop` + `source=exec`（16 个，Desktop 自己拉起的 exec）算自动化。
- 目录行格式升到 3：老行重读一次；每次重建行都重读头部，不沿用旧值，否则首条用户消息还没写入时就建行，定时任务会被永久记成交互会话。
- 搜索走全量遍历（walk），列表项的来源从目录行按会话 id 补上；目录还没发布过就不补，不让搜索等待首次全量扫描。
- 实时 `session-created` 事件：Codex 用摘要里的 originator/source 当场分类；Claude 只认出定时任务，其余等目录补上。
- 隐藏规则的例外：等待用户处理（`pendingInputType`）的会话、需要处理的项目始终显示；侧栏只过滤「最近 24 小时」，收藏和分类不动。
- 项目计数只算已打标签的会话：扫描器的 `sessionCount` 还含目录跳过的空 / 重复 rollout（实测 6 个项目差 1–4），把差额当「其他」会让只有自动化的项目留在列表里。
- 偏好开关两处：「全部会话」筛选栏的「隐藏自动化（N）」，设置 → 外观 → 隐藏自动化会话。

本机验证（2026-10-24）：项目页默认 112 / 206（94 个只有自动化的项目隐藏），首屏 30 张卡片，滚动到 60、90；只选 Claude Desktop + 名称排序为 49 个项目；全部会话 659 / 1979；侧栏最近 24 小时 33 个里隐藏 32 个自动化。
