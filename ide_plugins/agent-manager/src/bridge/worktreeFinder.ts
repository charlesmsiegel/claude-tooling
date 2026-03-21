import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { WatchedDirectory } from '../types';

export class WorktreeFinder extends EventEmitter {
  private directories = new Map<string, WatchedDirectory>();
  private watchers: fs.FSWatcher[] = [];
  private manualDirs: string[] = [];

  constructor(private readonly workspaceFolders: string[]) {
    super();
  }

  async init(manualDirs: string[] = []): Promise<void> {
    this.manualDirs = manualDirs;
    await this.discoverAll();
    this.watchWorktreeDirs();
  }

  getDirectories(): WatchedDirectory[] {
    return Array.from(this.directories.values());
  }

  addManualDirectory(dirPath: string): void {
    if (this.directories.has(dirPath)) return;
    const dir: WatchedDirectory = {
      path: dirPath,
      branch: this.detectBranch(dirPath),
      isWorktree: this.isWorktree(dirPath),
      repoRoot: this.findRepoRoot(dirPath) ?? dirPath,
    };
    this.directories.set(dirPath, dir);
    this.manualDirs.push(dirPath);
    this.emit('directories-changed', this.getDirectories());
  }

  removeManualDirectory(dirPath: string): void {
    this.directories.delete(dirPath);
    this.manualDirs = this.manualDirs.filter((d) => d !== dirPath);
    this.emit('directories-changed', this.getDirectories());
  }

  dispose(): void {
    for (const w of this.watchers) {
      w.close();
    }
    this.watchers = [];
    this.removeAllListeners();
  }

  static parseWorktreeOutput(output: string, repoRoot: string): WatchedDirectory[] {
    const dirs: WatchedDirectory[] = [];
    const blocks = output.trim().split('\n\n');

    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.split('\n');
      let wtPath = '';
      let branch = 'detached';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          wtPath = line.substring('worktree '.length);
        } else if (line.startsWith('branch refs/heads/')) {
          branch = line.substring('branch refs/heads/'.length);
        }
      }

      if (wtPath) {
        dirs.push({
          path: wtPath,
          branch,
          isWorktree: wtPath !== repoRoot,
          repoRoot,
        });
      }
    }

    return dirs;
  }

  static mergeDirectories(discovered: WatchedDirectory[], manualPaths: string[]): WatchedDirectory[] {
    const merged = [...discovered];
    const existingPaths = new Set(discovered.map((d) => d.path));

    for (const mp of manualPaths) {
      if (!existingPaths.has(mp)) {
        merged.push({
          path: mp,
          branch: 'unknown',
          isWorktree: false,
          repoRoot: mp,
        });
      }
    }

    return merged;
  }

  private async discoverAll(): Promise<void> {
    this.directories.clear();

    for (const folder of this.workspaceFolders) {
      const repoRoot = this.findRepoRoot(folder);
      if (!repoRoot) continue;

      try {
        const output = execSync('git worktree list --porcelain', {
          cwd: repoRoot,
          encoding: 'utf-8',
          timeout: 5000,
        });
        const worktrees = WorktreeFinder.parseWorktreeOutput(output, repoRoot);
        for (const wt of worktrees) {
          this.directories.set(wt.path, wt);
        }
      } catch {
        this.directories.set(folder, {
          path: folder,
          branch: 'unknown',
          isWorktree: false,
          repoRoot: folder,
        });
      }
    }

    for (const mp of this.manualDirs) {
      if (!this.directories.has(mp)) {
        this.directories.set(mp, {
          path: mp,
          branch: this.detectBranch(mp),
          isWorktree: this.isWorktree(mp),
          repoRoot: this.findRepoRoot(mp) ?? mp,
        });
      }
    }
  }

  private watchWorktreeDirs(): void {
    for (const folder of this.workspaceFolders) {
      const repoRoot = this.findRepoRoot(folder);
      if (!repoRoot) continue;

      const worktreesDir = path.join(repoRoot, '.git', 'worktrees');
      if (!fs.existsSync(worktreesDir)) continue;

      try {
        const watcher = fs.watch(worktreesDir, async () => {
          await this.discoverAll();
          this.emit('directories-changed', this.getDirectories());
        });
        this.watchers.push(watcher);
      } catch {
        // watch failed
      }
    }
  }

  private findRepoRoot(dirPath: string): string | undefined {
    try {
      return execSync('git rev-parse --show-toplevel', {
        cwd: dirPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
    } catch {
      return undefined;
    }
  }

  private detectBranch(dirPath: string): string {
    try {
      return execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: dirPath,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim();
    } catch {
      return 'unknown';
    }
  }

  private isWorktree(dirPath: string): boolean {
    const gitPath = path.join(dirPath, '.git');
    try {
      return fs.statSync(gitPath).isFile();
    } catch {
      return false;
    }
  }
}
