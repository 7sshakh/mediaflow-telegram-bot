import pLimit from "p-limit";
import { config } from "@/core/config";
import { logger } from "@/core/logger";

/**
 * Redis-ready in-process download queue.
 *
 * The Telegram update handler must never block on a long-running yt-dlp
 * download — every job is scheduled here and executed under a strict global
 * concurrency limit (MAX_GLOBAL_DOWNLOADS). Additional jobs beyond the
 * concurrency limit are queued (FIFO) automatically by p-limit until a slot
 * frees up, exactly like a worker pool consuming a queue.
 *
 * The architecture intentionally isolates "how work is scheduled" behind
 * this module so it can be swapped for a real Redis/BullMQ-backed multi
 * process worker without touching bot handlers.
 */
const limiter = pLimit(config.limits.maxGlobalDownloads);

const cancelRegistry = new Map<string, () => void>();

export function registerCancelHandle(taskId: string, cancel: () => void): void {
  cancelRegistry.set(taskId, cancel);
}

export function unregisterCancelHandle(taskId: string): void {
  cancelRegistry.delete(taskId);
}

export function cancelTask(taskId: string): boolean {
  const cancel = cancelRegistry.get(taskId);
  if (!cancel) return false;
  cancel();
  cancelRegistry.delete(taskId);
  return true;
}

export function getQueueLength(): number {
  return limiter.pendingCount;
}

export function getActiveCount(): number {
  return limiter.activeCount;
}

export function enqueueJob<T>(taskId: string, job: () => Promise<T>): Promise<T> {
  logger.info({ taskId, queued: limiter.pendingCount, active: limiter.activeCount }, "job_enqueued");
  return limiter(job);
}
