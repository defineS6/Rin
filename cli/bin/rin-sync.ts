#!/usr/bin/env bun
import { runSyncCommand } from "../src/commands/sync";

await runSyncCommand(Bun.argv.slice(2));
