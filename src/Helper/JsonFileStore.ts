import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * JSON file readable by the current user only, written atomically.
 */
export class JsonFileStore<T> {
  private readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  /**
   * @returns The stored value, or undefined when the file is missing or corrupt
   */
  read(): T | undefined {
    try {
      return JSON.parse(readFileSync(this.path, "utf-8")) as T;
    } catch {
      return undefined;
    }
  }

  write(value: T): void {
    mkdirSync(dirname(this.path), { mode: 0o700, recursive: true });
    const tmpPath = `${this.path}.${String(process.pid)}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(value), { mode: 0o600 });
    renameSync(tmpPath, this.path);
  }
}
