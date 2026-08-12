import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export class SchedulerLock {
  private readonly lockPath: string;

  constructor(dataDir: string = path.join(process.cwd(), "storage")) {
    this.lockPath = path.join(dataDir, "schedulerLock.json");
  }

  async acquire(slotTime: string): Promise<boolean> {
    try {
      await mkdir(path.dirname(this.lockPath), { recursive: true });
      let currentSlots: string[] = [];
      try {
        const raw = await readFile(this.lockPath, "utf-8");
        currentSlots = JSON.parse(raw) as string[];
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      }

      if (currentSlots.includes(slotTime)) {
        return false; // Already locked/processed
      }

      currentSlots.push(slotTime);
      // Prune history to last 50 slots to keep file lightweight
      if (currentSlots.length > 50) {
        currentSlots.splice(0, currentSlots.length - 50);
      }

      await writeFile(this.lockPath, JSON.stringify(currentSlots, null, 2), "utf-8");
      return true;
    } catch {
      return false; // Fallback to safe lock acquisition block
    }
  }
}
