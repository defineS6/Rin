# 本地文章同步

Rin 提供基于标准 HTTP/JSON 协议的简单双向同步。官方 CLI 使用 TypeScript 开发，但同步 API 不依赖 Bun；其他客户端也可以直接实现该协议。

当前功能支持将远端 Rin 文章增量拉取为本地 Markdown，也可以将本地修改或新增文章推送到远端。同步采用简单覆盖策略，不处理多人同时编辑冲突；删除同步尚未开放。

```bash
bun cli/bin/rin.ts sync init --remote https://blog.example.com --dir posts
export RIN_SYNC_TOKEN="<admin token>"
bun cli/bin/rin.ts sync pull --dry-run
bun cli/bin/rin.ts sync pull
bun cli/bin/rin.ts sync push
bun cli/bin/rin.ts sync run
bun cli/bin/rin.ts sync status
```

同步配置与状态保存在 `.rin/`，文章保存在配置的 `posts` 目录。Token 只应通过 `RIN_SYNC_TOKEN` 环境变量提供，不应写入配置或提交到 Git。

## 独立可执行文件

每个版本的 GitHub Release 会附带 `rin-sync` 的 Linux、macOS 和 Windows 独立可执行文件。下载对应平台压缩包并将程序加入 `PATH` 后，无需安装 Bun：

```bash
rin-sync init --remote https://blog.example.com --dir posts
rin-sync pull
rin-sync push
rin-sync run
```

在仓库中也可以进入 `cli/` 后执行 `bun run build:sync`，将多平台产物构建到 `cli/dist/sync/`。
