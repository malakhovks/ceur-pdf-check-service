import { logger as defaultLogger, type AppLogger } from "../../logging";

export type CheckerQueueOptions = {
  maxConcurrent: number;
  maxQueued: number;
  queueTimeoutMs: number;
};

export type CheckerQueueLease = {
  requestId: string;
  queuedMs: number;
  release: () => void;
};

type PendingJob = {
  requestId: string;
  createdAt: number;
  resolve: (lease: CheckerQueueLease) => void;
  reject: (error: QueueOverloadError) => void;
  timer: NodeJS.Timeout;
};

const DEFAULT_MAX_CONCURRENT_CHECKS = 2;
const DEFAULT_MAX_QUEUED_CHECKS = 8;
const DEFAULT_QUEUE_TIMEOUT_MS = 15_000;

export class QueueOverloadError extends Error {
  code = "CHECKER_QUEUE_OVERLOADED";
  status = 429;

  constructor(message: string) {
    super(message);
    this.name = "QueueOverloadError";
  }
}

function parseEnvInteger(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function normalizeOptions(options: CheckerQueueOptions): CheckerQueueOptions {
  return {
    maxConcurrent: Math.max(1, options.maxConcurrent),
    maxQueued: Math.max(0, options.maxQueued),
    queueTimeoutMs: Math.max(0, options.queueTimeoutMs),
  };
}

export function readCheckerQueueOptions(): CheckerQueueOptions {
  return normalizeOptions({
    maxConcurrent: parseEnvInteger("CEUR_MAX_CONCURRENT_CHECKS", DEFAULT_MAX_CONCURRENT_CHECKS),
    maxQueued: parseEnvInteger("CEUR_MAX_QUEUED_CHECKS", DEFAULT_MAX_QUEUED_CHECKS),
    queueTimeoutMs: parseEnvInteger("CEUR_QUEUE_TIMEOUT_MS", DEFAULT_QUEUE_TIMEOUT_MS),
  });
}

export function isQueueOverloadError(error: unknown): error is QueueOverloadError {
  return error instanceof QueueOverloadError;
}

export class CheckerQueue {
  private active = 0;
  private pending: PendingJob[] = [];
  private options: CheckerQueueOptions;
  private logger: AppLogger;

  constructor(options: CheckerQueueOptions, logger: AppLogger = defaultLogger) {
    this.options = normalizeOptions(options);
    this.logger = logger;
  }

  snapshot() {
    return {
      active: this.active,
      pending: this.pending.length,
      maxConcurrent: this.options.maxConcurrent,
      maxQueued: this.options.maxQueued,
      queueTimeoutMs: this.options.queueTimeoutMs,
    };
  }

  isFull() {
    return this.active >= this.options.maxConcurrent && this.pending.length >= this.options.maxQueued;
  }

  async run<T>(requestId: string, task: (lease: CheckerQueueLease) => Promise<T>): Promise<T> {
    const lease = await this.acquire(requestId);

    try {
      return await task(lease);
    } finally {
      lease.release();
    }
  }

  private acquire(requestId: string): Promise<CheckerQueueLease> {
    const createdAt = Date.now();

    if (this.active < this.options.maxConcurrent) {
      this.active += 1;
      this.logger.info("checker.queue.slot_acquired", {
        requestId,
        queuedMs: 0,
        ...this.snapshot(),
      });
      return Promise.resolve(this.createLease(requestId, createdAt));
    }

    if (this.pending.length >= this.options.maxQueued) {
      this.logger.warn("checker.queue.rejected_full", {
        requestId,
        ...this.snapshot(),
      });
      return Promise.reject(new QueueOverloadError("The checker is busy. Try again shortly."));
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removePending(requestId);
        this.logger.warn("checker.queue.timed_out", {
          requestId,
          queuedMs: Date.now() - createdAt,
          ...this.snapshot(),
        });
        reject(new QueueOverloadError("The checker is busy and this request waited too long for a slot."));
      }, this.options.queueTimeoutMs);

      this.pending.push({
        requestId,
        createdAt,
        resolve,
        reject,
        timer,
      });
      this.logger.info("checker.queue.enqueued", {
        requestId,
        queuePosition: this.pending.length,
        ...this.snapshot(),
      });
    });
  }

  private createLease(requestId: string, createdAt: number): CheckerQueueLease {
    let released = false;

    return {
      requestId,
      queuedMs: Date.now() - createdAt,
      release: () => {
        if (released) {
          return;
        }

        released = true;
        this.active = Math.max(0, this.active - 1);
        this.logger.info("checker.queue.slot_released", {
          requestId,
          ...this.snapshot(),
        });
        this.drain();
      },
    };
  }

  private drain() {
    while (this.active < this.options.maxConcurrent && this.pending.length > 0) {
      const next = this.pending.shift();
      if (!next) {
        return;
      }

      clearTimeout(next.timer);
      this.active += 1;
      this.logger.info("checker.queue.dequeued", {
        requestId: next.requestId,
        queuedMs: Date.now() - next.createdAt,
        ...this.snapshot(),
      });
      next.resolve(this.createLease(next.requestId, next.createdAt));
    }
  }

  private removePending(requestId: string) {
    const index = this.pending.findIndex((job) => job.requestId === requestId);
    if (index >= 0) {
      this.pending.splice(index, 1);
    }
  }
}

export function createCheckerQueue(options: CheckerQueueOptions, logger?: AppLogger) {
  return new CheckerQueue(options, logger);
}

const checkerQueue = createCheckerQueue(readCheckerQueueOptions());

export function getCheckerQueueSnapshot() {
  return checkerQueue.snapshot();
}

export function isCheckerQueueFull() {
  return checkerQueue.isFull();
}

export function runWithCheckerSlot<T>(requestId: string, task: (lease: CheckerQueueLease) => Promise<T>) {
  return checkerQueue.run(requestId, task);
}
