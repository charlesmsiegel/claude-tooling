import { EventEmitter } from 'events';
export interface StreamReaderOptions {
    pollInterval?: number;
    startFromEnd?: boolean;
}
export declare class StreamReader extends EventEmitter {
    private readonly filePath;
    private timer;
    private offset;
    private readonly pollInterval;
    private readonly startFromEnd;
    constructor(filePath: string, options?: StreamReaderOptions);
    start(): void;
    stop(): void;
    private poll;
}
