# VibeAllDay

在浏览器里管理本机的 AI 编程会话。电脑负责运行服务和 agent，桌面浏览器、手机和平板使用同一套响应式 Web 界面。

本项目聚焦 **本地服务 + Web**：不再包含 iOS / Android 原生 App、桌面安装壳、浏览器扩展、设备／模拟器控制或原生推送服务。手机端直接使用浏览器；远程访问、加密 relay 和浏览器通知仍保留。

## 核心功能

- **统一会话列表**：按项目查看、搜索和继续已有会话，支持多会话并行、收藏、归档和待处理事项。
- **与 agent 协作**：查看流式回复和工具调用，发送指令、处理权限审批、补充问题答案、上传文件或图片。
- **代码与变更审阅**：浏览项目文件、查看 diff 和 Git 状态，将代码评论发回会话。
- **桌面与手机 Web**：同一界面适配不同屏幕，支持触屏操作、附件、语音输入和浏览器通知；部分能力取决于浏览器权限及服务端配置。
- **持续运行与远程连接**：关闭网页不会主动终止服务端任务，可通过局域网、私有网络或可选的加密 relay 访问，并保存多个服务器。

主要支持 Claude Code 和 Codex。项目仍保留其他 provider 适配器，具体能力以界面中的可用状态为准。需要先在运行服务的机器上安装并登录对应的 provider 工具；VibeAllDay 不替代它们的账户与凭证。

## 环境要求

- Node.js：`^22.16 || ^23.11 || >=24.10`。
- pnpm：`10.34.6`，版本定义在根目录 `package.json`。
- Git，以及至少一个已经安装、登录的 provider CLI。

源码构建和运行不需要 Xcode、Android SDK、Rust、Tauri 或浏览器扩展开发环境。

## 快速开始

```bash
git clone https://github.com/jiji262/vibeallday.git
cd vibeallday
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

打开 **http://localhost:3400**。服务会检测本机可用的 provider。

`pnpm start` 使用已构建的服务端和 Web 静态资源。代码更新后需要重新构建；已有服务进程不会因执行构建自动重启。

### 更改端口

```bash
PORT=4000 pnpm start
```

对应地址为 `http://localhost:4000`。默认端口是 `3400`，具体部署可以通过环境变量覆盖。

## 手机与远程使用

### 局域网或私有网络

确保手机能访问服务所在机器，并按部署配置允许相应的网络监听。在手机浏览器打开服务地址，例如 `http://<电脑局域网地址>:3400`。跨网络可使用现有的 VPN／Tailscale，也可以自行配置 HTTPS 反向代理。

本地浏览器访问密码与 relay 远程访问密码分开管理。可在 **Settings → Local Access** 配置本地访问密码；无界面环境可执行：

```bash
node --import ./scripts/production-env.mjs packages/server/dist/cli.js --setup-auth '请替换为强密码'
```

该命令只保存认证配置并退出，下一次服务启动时生效。

### 加密 relay（可选）

`packages/relay` 保留为独立、可自托管的远程连接服务。通过 Web 设置页配置 relay 地址和远程访问凭证，再从对应的远程 Web 客户端连接。已有 relay 配置会继续使用，不因本次精简改写地址或凭证。

relay 的会话通信使用端到端加密。公开会话分享是独立的主动发布功能，不能将公开分享视为私有加密会话。

更多连接和部署细节见 [本地开发与环境配置](docs/development/local-development.md)、[连接模式](docs/project/connection-matrix.md) 和 [relay 设计](docs/project/relay-design.md)。

### 浏览器通知

保留 Web Push 和浏览器 Service Worker 通知。是否可订阅取决于浏览器支持、通知权限以及安全上下文；手机上的支持和后台行为也由浏览器／系统决定。本项目不再提供依赖 Firebase／APNs 的原生 App 推送链路。

## 数据与凭证

默认应用数据目录是 `~/.vibeallday/`，保存设置、索引、认证状态、上传内容和通知订阅等。可以使用独立目录或 profile：

```bash
VIBEALLDAY_DATA_DIR=/本地磁盘路径/vibeallday pnpm start
VIBEALLDAY_PROFILE=dev PORT=4000 pnpm dev
```

profile 示例使用 `~/.vibeallday-dev/`。数据目录应放在本地磁盘；SQLite 在网络文件系统上的锁行为会影响可用性。

Claude／Codex 等 provider 的原始会话仍保存在各自的数据目录中。删除项目源码、清理构建产物与删除应用数据是不同操作，不应把 provider 历史或本地密钥作为普通构建缓存清理。

## 开发

```bash
pnpm install --frozen-lockfile
pnpm dev
```

开发模式默认使用 `3400` 提供应用、`3402` 提供 Vite；维护端口仅在显式配置 `MAINTENANCE_PORT` 时启用。也可以先构建 Web，再以缓存静态资源方式开发服务端：

```bash
pnpm dev --built-client
```

### 检查与构建

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
```

浏览器集成验证使用 `pnpm test:e2e`，需要安装 Playwright Chromium。源码打包使用 `pnpm build:bundle`。更多规范见 [DEVELOPMENT.md](DEVELOPMENT.md)，浏览器测试范围见 [E2E testing](topics/e2e-testing.md)。

### 项目结构

| 路径 | 职责 |
| --- | --- |
| `packages/server` | 本地 HTTP／WebSocket 服务、provider 运行与会话管理 |
| `packages/client` | 桌面、手机和平板共用的响应式 Web 客户端 |
| `packages/shared` | 共享类型、能力协商和传输协议 |
| `packages/relay` | 可选的加密远程连接服务 |
| `artifact-host` | Web 产物预览使用的隔离 origin 支持 |
| `scripts` | 本地开发、构建和验证脚本 |
| `site` | 网站与公开使用文档源码 |

共享协议中的历史平台类型和 capability ID 保留必要的读取兼容，不表示仍提供对应原生产品。旧平台的设计资料也不代表当前发行范围。

## 更新源码部署

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm build
```

构建成功后，按当前部署方式重新启动服务。应用数据、provider 历史及本地密钥不属于更新时需要删除的内容。

## License

[MIT](LICENSE)
