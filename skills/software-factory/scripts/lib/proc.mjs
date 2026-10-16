// Process helpers. Every external command (git, gh, claude, the test command) goes through here,
// so timeouts, output capture and Windows quirks are handled in one place.
import { spawn } from "node:child_process";

const IS_WINDOWS = process.platform === "win32";

/**
 * Run a program with an argument array (no shell, no quoting problems).
 * Resolves to { code, stdout, stderr, timedOut }. Never rejects for a non-zero exit.
 */
export function run(cmd, args = [], { cwd, input, env, timeoutMs = 10 * 60_000, shell = false } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: env ?? process.env,
        shell,
        windowsHide: true,
        detached: !IS_WINDOWS, // own process group on POSIX, so a timeout can kill the whole tree
        stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });
    } catch (err) {
      return reject(err);
    }
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? (timedOut ? 124 : 1), stdout, stderr, timedOut });
    });
    if (input !== undefined) {
      child.stdin.on("error", () => {}); // the child may exit before reading everything
      child.stdin.end(input);
    }
  });
}

/** Run a shell command line such as "npm test". Used only for commands the human configured. */
export function sh(commandLine, opts = {}) {
  return run(commandLine, [], { ...opts, shell: true });
}

/** Like run(), but throws with the command's output when it exits non-zero. */
export async function must(cmd, args, opts = {}) {
  const r = await run(cmd, args, opts);
  if (r.code !== 0) {
    // Lead with the reason (the last meaningful output line), then the details. Options such as
    // `-c user.name=...` are left out of the short name so the first line stays readable.
    const out = (r.stderr || r.stdout).trim().split("\n").filter((l) => l.trim());
    const reason = out.find((l) => /^(fatal|error):/i.test(l.trim())) ?? out.at(-1) ?? `exit ${r.code}`;
    const name = [cmd, ...args.filter((a, i) => !a.startsWith("-") && args[i - 1] !== "-c")].slice(0, 2).join(" ");
    throw new Error(`${name} failed: ${reason.trim()}\n${out.slice(-15).join("\n")}\n(command: ${cmd} ${args.join(" ")}, exit ${r.code})`);
  }
  return r;
}

/** True when `cmd --version` runs. */
export async function available(cmd) {
  try {
    return (await run(cmd, ["--version"], { timeoutMs: 20_000 })).code === 0;
  } catch {
    return false;
  }
}

function killTree(child) {
  if (IS_WINDOWS) {
    spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).on("error", () => {});
  } else {
    const group = (signal) => {
      try {
        process.kill(-child.pid, signal); // negative pid: the whole process group
      } catch {
        child.kill(signal);
      }
    };
    group("SIGTERM");
    setTimeout(() => group("SIGKILL"), 5_000).unref();
  }
}

/** Last `n` lines of a block of text, for logs and ledgers. */
export const tail = (text, n = 40) => String(text ?? "").trim().split("\n").slice(-n).join("\n");
