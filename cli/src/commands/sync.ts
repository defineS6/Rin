import { parseArgs } from "node:util";
import { logger } from "../lib/logger";
import { fetchCapabilities, initializeSync, loadSyncFiles, localStatus, pullArticles, pushArticles } from "../lib/sync";

export async function runSyncCommand(args: string[]) {
  const [subcommand = "status"] = args;
  if (subcommand === "--help" || subcommand === "-h" || subcommand === "help") {
    printSyncHelp();
    return;
  }
  const { values } = parseArgs({
    args: args.slice(1),
    options: {
      remote: { type: "string" },
      dir: { type: "string", default: "posts" },
      token: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
    strict: false,
  });

  if (subcommand === "init") {
    if (!values.remote) throw new Error("sync init requires --remote");
    await initializeSync(String(values.remote), String(values.dir));
    logger.success("Initialized .rin sync configuration");
    return;
  }

  const { config, state } = await loadSyncFiles();
  if (subcommand === "status") {
    const status = await localStatus(state);
    logger.info(`Tracked: ${status.tracked}; modified: ${status.modified}; missing: ${status.missing}`);
    return;
  }

  if (subcommand === "pull" || subcommand === "push" || subcommand === "run") {
    const token = String(values.token || process.env.RIN_SYNC_TOKEN || "");
    if (!token) throw new Error("Set RIN_SYNC_TOKEN or pass --token");
    const capabilities = await fetchCapabilities(config, token);
    const dryRun = Boolean(values["dry-run"]);
    if (subcommand === "push" || subcommand === "run") {
      if (!capabilities.features.push) throw new Error("Remote does not support article push");
      const changed = await pushArticles(config, state, token, dryRun);
      logger.success(`${dryRun ? "Would push" : "Pushed"} ${changed} article(s)`);
    }
    if (subcommand === "pull" || subcommand === "run") {
      if (!capabilities.features.pull) throw new Error("Remote does not support article pull");
      const changed = await pullArticles(config, state, token, dryRun);
      logger.success(`${dryRun ? "Would pull" : "Pulled"} ${changed} article(s)`);
    }
    return;
  }

  printSyncHelp();
}

function printSyncHelp() {
  console.log("Sync commands:\n  rin-sync init --remote <url> [--dir posts]\n  rin-sync status\n  rin-sync pull [--dry-run]\n  rin-sync push [--dry-run]\n  rin-sync run [--dry-run]");
}
