# 上游同步记录：v0.10.2 → v0.11.0 及之后（fork）

状态：已在分支 `chore/sync-upstream-0.11` 应用，未推送（2026-10-26）。仓库：`jiji262/vibeallday`（上游 `jiji262/vibeallday` v0.10.2 的干净导出，导入提交 `5d8e564`）。

## 1. 范围

评审了上游 `v0.10.2..f304a33b1` 的全部 91 个提交（v0.11.0 发布于 2026-10-24，之后还有 5 个）。逐个分类的记录和决策报告由本次会话生成，没有提交进仓库。**下次同步从 `f304a33b1..` 开始评审。**

## 2. 已应用的 14 个提交

按应用顺序排列。作者保留为上游作者，committer 是 jiji262。

| fork | 上游 | 内容 | 类别 |
| --- | --- | --- | --- |
| `24c7d86` | `e0e2c43c3` | markdown-it 15.0.3、sanitize-html 2.18.1、follow-redirects 1.16.1，固定 Playwright runner | 安全 |
| `2ebb75a` | `4aa7a0190` | speech prewarm 不再报 400，去掉 SW 设置的重复日志 | 修复 |
| `2a2f505` | `ad602d351` | Codex transcript cache 按解码后的字节数计入预算，避免常驻服务内存涨到 GB 级 | 修复 |
| `e36b65f` | `b5ce71567` | Claude SDK 及打包的 Claude Code 升到 2.1.306 | provider |
| `90e6d1c` | `d123052a8` | 无脚本 HTML 预览保留内嵌样式表 | 修复 |
| `7c58864` | `37003bc30` | Agent Auth Router 路由的会话也显示 turn fork 菜单 | 修复 |
| `79d17d7` | `92b0d2f91` | DOMPurify 3.4.17 等传递依赖（只改 lockfile） | 安全 |
| `c9a9d99` | `70e7a8c10` | Codex 协议类型刷新，目标版本 0.164.0 | provider |
| `dd5e520` | `c1f894ea1` | Claude Agent SDK 升到 0.3.309 | provider |
| `cbd5a45` | `0417ede64` | 沙箱 app 关闭 splice 前先把回复写完 | 修复 |
| `f778ad5` | `f304a33b1` | 先登记 transcript 工具调用，再配对结果（首屏只取 3 个 turn 时更容易出现乱序） | 修复 |
| `1571d0f` | `e689da845` | Codex 会话启动时加 `-c features.instant_interrupt=false`，防止 steer 丢掉正在生成的内容 | provider |
| `9e8f442` | `ef70f236a` | 长时间无输出的 turn 显示「No new output for Xm Ys」，不再轮换进度短语 | 体验 |
| `cd9280d` | `5338e6ee7` | zod 4.6.7（含 pnpm patch）、body-parser 2.4.0、fast-uri 3.1.9、vitest 4.1.12 | 安全 |

`fff4320` 是本次 fork 自己的提交（验证阶段的修复 `35537e0`、`00ab3fa` 见第 5 节），补上了 `topics/steer-queue-provider-differences.md`。该文档在 fork 里从未改动过，所以直接取上游 `e689da845` 时的版本，内容包含 `24419d10f` 的说明和 `e689da845` 的约定。

应用时用 `--exclude` 排除了以下文件：

- `gaps/silent-turn-shows-progress-phrases.md`：上游自己的 gap，fork 里没有这个文件
- `topics/steer-queue-provider-differences.md`：已由 `fff4320` 补上
- `packages/desktop/src-tauri/Cargo.lock`：fork 不构建桌面版

## 3. 没有同步的提交

- `f15a311f2`：fork 已经在 `7957f43` 独立修过同一个问题（composer 菜单在 transcript 滚动时被关掉），保留 fork 的实现。
- `25e521dc9`（New project 直接添加已有文件夹）：依赖没同步的 rendez 提交，`git am` 建不出 fake ancestor。它还改 `routes/version.ts`，和 fork 移除自更新检测的改动（`a3c4199`）重叠。需要的话手工移植。
- 和本机用法无关的系列：
  - Windows AHK 标题 beacon
  - rendez 上传
  - Issues / Jira 搜索
  - Project App 面包屑和 fileLinks
  - Android / Go device bridge
  - Rust desktop / mobile
  - 官网和 sharing worker
  - 发版、CI 和纯文档
  - 只改测试 fixture 的提交
- pnpm 10.34.7（`c79a1d50c`）：只改工具链版本，没带。

## 4. 机制

fork 导入点的文件内容和上游 v0.10.2 完全一致，所以 blob id 相同，`git am -3` 能做 3-way 合并。

- 补丁导出：`git -C <上游 clone> format-patch -1 <sha>`
- 应用方式：`git am -3 --no-verify`，必须按上游时间顺序（lockfile 是逐个提交叠上去的）
- 会失败的情况：补丁里某个文件的前像来自没同步的上游提交时，会报 `could not build fake ancestor`。处理办法是 `--exclude` 掉这个文件、把中间的提交一起带上，或者手工移植。

## 5. 验证

验证中修了两处，都是 fork 自己的提交：

- `35537e0`：上游 `f304a33b1` 在 `messageProjection.ts` 的注释里写了 "in the window."，被 client 的浏览器全局变量守卫（`transcriptProjectionBoundary.test.ts`）当成了对 `window` 的访问。上游 HEAD 也有这个失败。只改注释措辞，守卫不动。
- `00ab3fa`：`ProjectQueueReadinessCheck` 的超时回调会抛出未捕获的 `kill EPERM`，服务会因此崩溃。原因是进程组只剩已退出、尚未回收的 leader 时，macOS 返回 EPERM 而不是 ESRCH。这个问题从 v0.10.2 就存在，上游没改过。修法是把 EPERM 和 ESRCH 同样处理，并加了回归测试。

结果（macOS，默认 Node v26.12.0）：

| 检查 | 提交 | 结果 |
| --- | --- | --- |
| `pnpm typecheck` | `00ab3fa` | 通过 |
| `pnpm lint` | `00ab3fa` | 通过，1 条已有 warning（`useIncrementalReveal.ts`） |
| `pnpm test` | `00ab3fa` | 全部通过：shared 976、push-broker 45、relay 139、client 7089、server 6638（另 73 跳过）、browser-extension 8、desktop 17、node 检查 15 |
| e2e 全量 | `35537e0` | 427 通过，13 跳过，1 失败（见下） |

`00ab3fa` 只改了服务端的一处 catch，所以 e2e 没有在它上面重跑。

与同步无关的已知失败：

- e2e `new-session-preboot-composer.spec.ts:353`（1000px）：CPU 争用时约四成失败，同步前的 `a3c4199` 失败率相同。根因是 fork 的 Garden 字体：VIBEALLDAY Geist 加载完成替换回退字体时，副标题的 `normal` 行高从 16px 变成 18px，把下面的启动控件整体往下推了 2px。已在本分支后续提交 `fix(client): keep New Session controls still when VIBEALLDAY Geist swaps in` 中修复。同类问题的其余部分记录在 `gaps/geist-swap-resizes-new-session-controls.md`。
- managed-ssh 的 15 个测试：在 Homebrew `node@24` 下失败（路径里有 `@`），默认 Node 下通过。见 `gaps/managed-ssh-tests-reject-homebrew-keg-node.md`。
