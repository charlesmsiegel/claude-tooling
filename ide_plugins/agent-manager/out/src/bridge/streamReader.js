"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamReader = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
class StreamReader extends events_1.EventEmitter {
    filePath;
    timer = null;
    offset = 0;
    pollInterval;
    startFromEnd;
    constructor(filePath, options = {}) {
        super();
        this.filePath = filePath;
        this.pollInterval = options.pollInterval ?? 500;
        this.startFromEnd = options.startFromEnd ?? false;
    }
    start() {
        if (this.startFromEnd) {
            try {
                const stat = fs.statSync(this.filePath);
                this.offset = stat.size;
            }
            catch {
                this.offset = 0;
            }
        }
        this.poll();
        this.timer = setInterval(() => this.poll(), this.pollInterval);
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    poll() {
        try {
            const stat = fs.statSync(this.filePath);
            if (stat.size <= this.offset)
                return;
            const fd = fs.openSync(this.filePath, 'r');
            const buffer = Buffer.alloc(stat.size - this.offset);
            fs.readSync(fd, buffer, 0, buffer.length, this.offset);
            fs.closeSync(fd);
            this.offset = stat.size;
            const chunk = buffer.toString('utf-8');
            const lines = chunk.split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed)
                    continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    this.emit('data', parsed);
                }
                catch {
                    this.emit('raw', trimmed);
                }
            }
        }
        catch {
            // file may not exist yet
        }
    }
}
exports.StreamReader = StreamReader;
//# sourceMappingURL=streamReader.js.map