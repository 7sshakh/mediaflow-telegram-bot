import { spawn } from "node:child_process";
import { logger } from "@/core/logger";

/**
 * Secure subprocess execution helper.
 *
 * SECURITY RULES (never violate these):
 *  - Always pass argument arrays, never a shell string.
 *  - Never set `shell: true`.
 *  - Always enforce a timeout and kill the process (and its descendants) on
 *    expiry or cancellation.
 *  - Never interpolate user input into a command string.
 */

export interface ExecOptions {
  cwd?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  onStdoutLine?: (line: string) => void;
  signal?: AbortSignal;
}

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export class ProcessTimeoutError extends Error {}
export class ProcessCancelledError extends Error {}

export function runProcess(bin: string, args: string[], options: ExecOptions = {}): {
  promise: Promise<ExecResult>;
  cancel: () => void;
} {
  const { cwd, timeoutMs = 60_000, maxBufferBytes = 20 * 1024 * 1024, onStdoutLine, signal } = options;

  const child = spawn(bin, args, {
    cwd,
    shell: false, // NEVER true — args are passed as an argv array, not interpreted by a shell
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });

  let stdout = "";
  let stderr = "";
  let stdoutBuf = "";
  let killed = false;
  let timeoutHandle: NodeJS.Timeout | undefined;

  const kill = (reason: "timeout" | "cancel") => {
    if (killed) return;
    killed = true;
    try {
      if (process.platform !== "win32" && child.pid) {
        process.kill(-child.pid, "SIGKILL");
      } else {
        child.kill("SIGKILL");
      }
    } catch {
      /* process may have already exited */
    }
    logger.warn({ bin, reason }, "process_killed");
  };

  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => kill("timeout"), timeoutMs);
  }

  const onAbort = () => kill("cancel");
  signal?.addEventListener("abort", onAbort);

  child.stdout.on("data", (chunk: Buffer) => {
    if (stdout.length < maxBufferBytes) stdout += chunk.toString("utf8");
    if (onStdoutLine) {
      stdoutBuf += chunk.toString("utf8");
      const lines = stdoutBuf.split(/\r?\n/);
      stdoutBuf = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) onStdoutLine(line);
    }
  });
  child.stderr.on("data", (chunk: Buffer) => {
    if (stderr.length < maxBufferBytes) stderr += chunk.toString("utf8");
  });

  const promise = new Promise<ExecResult>((resolve, reject) => {
    child.on("error", (err) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", onAbort);
      reject(err);
    });
    child.on("close", (code) => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
      signal?.removeEventListener("abort", onAbort);
      if (killed) {
        reject(
          timeoutHandle === undefined && signal?.aborted
            ? new ProcessCancelledError(`${bin} was cancelled`)
            : new ProcessTimeoutError(`${bin} timed out after ${timeoutMs}ms`),
        );
        return;
      }
      resolve({ stdout, stderr, code });
    });
  });

  return { promise, cancel: () => kill("cancel") };
}
