# VibeAllDay

在电脑和手机浏览器里管理本机的 AI 编程会话，主要支持 Claude Code 和 Codex。
支持多会话、流式回复、工具审批、文件与 Git diff，以及可选的加密远程连接。
关闭网页后，服务端任务可以继续运行。

## 启动

需要 Node.js `^22.16 || ^23.11 || >=24.10`、pnpm `10.34.6`、Git，
以及已安装并登录的 provider CLI。

```bash
git clone https://github.com/jiji262/vibeallday.git
cd vibeallday
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

打开 <http://localhost:3400>。修改端口可用 `PORT=4000 pnpm start`。
更新源码后重新构建并重启服务。

## 开发

```bash
pnpm dev           # 开发服务，默认端口 3400
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

浏览器测试：`pnpm test:e2e`，需先安装 Playwright Chromium。
开发规则见 [DEVELOPMENT.md](DEVELOPMENT.md)，公开使用指南见
[site/src/content/docs](site/src/content/docs/)。

## 数据与远程访问

设置、索引、上传文件和认证信息默认保存在 `~/.vibeallday/`；
可通过 `VIBEALLDAY_DATA_DIR` 指定其他目录。Provider 原始会话仍保存在各自的数据目录。

服务默认仅监听本机。局域网、Tailscale 或加密 relay 的配置见
[远程访问](site/src/content/docs/remote-access.md)；对外开放前配置访问认证。

## 代码结构

`packages/server` 本地服务 · `packages/client` Web 界面 ·
`packages/shared` 共享协议 · `packages/relay` 可选远程 relay。

[MIT License](LICENSE)
