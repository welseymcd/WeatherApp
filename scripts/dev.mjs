import { spawn } from "node:child_process";

const processes = [
  ["server", "bun", ["run", "dev:server"]],
  ["web", "bun", ["run", "dev:web"]],
];

let shuttingDown = false;
const children = processes.map(([name, command, args]) => {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopChildren(child);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(`[${name}] failed to start:`, error);
    if (!shuttingDown) {
      shuttingDown = true;
      stopChildren(child);
      process.exit(1);
    }
  });

  return child;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    stopChildren();
  });
}

function stopChildren(except) {
  for (const child of children) {
    if (child === except || child.killed) {
      continue;
    }

    child.kill("SIGTERM");
  }
}
