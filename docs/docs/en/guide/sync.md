# Local article sync

Rin provides a standard HTTP/JSON protocol for simple two-way sync. The official CLI is developed in TypeScript, but the sync API does not require Bun and can be implemented by other clients.

The current version pulls remote Rin articles into local Markdown files and pushes new or modified local articles to the remote. Sync uses a simple overwrite policy without concurrent-edit conflict handling; deletion sync is not available yet.

```bash
bun cli/bin/rin.ts sync init --remote https://blog.example.com --dir posts
export RIN_SYNC_TOKEN="<admin token>"
bun cli/bin/rin.ts sync pull --dry-run
bun cli/bin/rin.ts sync pull
bun cli/bin/rin.ts sync push
bun cli/bin/rin.ts sync run
bun cli/bin/rin.ts sync status
```

Configuration and state are stored in `.rin/`; articles are stored in the configured `posts` directory. Supply the token only through `RIN_SYNC_TOKEN`; do not store it in configuration or commit it to Git.

## Standalone executables

Each GitHub Release includes standalone `rin-sync` executables for Linux, macOS, and Windows. Download the archive for your platform and add the executable to `PATH`; Bun is not required:

```bash
rin-sync init --remote https://blog.example.com --dir posts
rin-sync pull
rin-sync push
rin-sync run
```

From the repository, enter `cli/` and run `bun run build:sync` to build all platform binaries into `cli/dist/sync/`.
