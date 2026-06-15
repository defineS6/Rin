import { mkdir } from "node:fs/promises";

const targets = [
  ["bun-linux-x64", "rin-sync-linux-x64"],
  ["bun-linux-arm64", "rin-sync-linux-arm64"],
  ["bun-darwin-x64", "rin-sync-darwin-x64"],
  ["bun-darwin-arm64", "rin-sync-darwin-arm64"],
  ["bun-windows-x64", "rin-sync-windows-x64.exe"],
] as const;

await mkdir("dist/sync", { recursive: true });

for (const [target, output] of targets) {
  console.log(`Compiling ${output}`);
  const child = Bun.spawn([
    "bun",
    "build",
    "./bin/rin-sync.ts",
    "--compile",
    `--target=${target}`,
    `--outfile=dist/sync/${output}`,
  ], {
    cwd: import.meta.dir + "/..",
    stdout: "inherit",
    stderr: "inherit",
  });
  const exitCode = await child.exited;
  if (exitCode !== 0) process.exit(exitCode);
}
