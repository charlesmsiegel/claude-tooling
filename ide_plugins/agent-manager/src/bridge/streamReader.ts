import { EventEmitter } from 'events';
import * as fs from 'fs';

export interface StreamReaderOptions {
  pollInterval?: number;
  startFromEnd?: boolean;
}

export class StreamReader extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;
  private offset = 0;
  private readonly pollInterval: number;
  private readonly startFromEnd: boolean;

  constructor(
    private readonly filePath: string,
    options: StreamReaderOptions = {}
  ) {
    super();
    this.pollInterval = options.pollInterval ?? 500;
    this.startFromEnd = options.startFromEnd ?? false;
  }

  start(): void {
    if (this.startFromEnd) {
      try {
        const stat = fs.statSync(this.filePath);
        this.offset = stat.size;
      } catch {
        this.offset = 0;
      }
    }

    this.poll();
    this.timer = setInterval(() => this.poll(), this.pollInterval);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private poll(): void {
    try {
      const stat = fs.statSync(this.filePath);
      if (stat.size <= this.offset) return;

      const fd = fs.openSync(this.filePath, 'r');
      const buffer = Buffer.alloc(stat.size - this.offset);
      fs.readSync(fd, buffer, 0, buffer.length, this.offset);
      fs.closeSync(fd);

      this.offset = stat.size;

      const chunk = buffer.toString('utf-8');
      const lines = chunk.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const parsed = JSON.parse(trimmed);
          this.emit('data', parsed);
        } catch {
          this.emit('raw', trimmed);
        }
      }
    } catch {
      // file may not exist yet
    }
  }
}
