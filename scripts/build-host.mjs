import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));

// Self-hosted Node/Nitro deployments need a persistent HTTP server. Keep an
// explicitly supplied preset intact for providers that select another target.
process.env.NITRO_PRESET ??= "node-server";

const vite = spawn(
  process.execPath,
  [viteBin, "build", "--configLoader", "runner", ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env: process.env,
    stdio: "inherit",
  },
);

vite.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
