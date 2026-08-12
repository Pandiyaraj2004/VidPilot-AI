import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface AutomationHistoryEntry {
  timestamp: string;
  eventType: string; // e.g. "scheduler_started", "job_created", "published", "failed"
  jobId?: string;
  topic?: string;
  category?: string;
  language?: string;
  voice?: string;
  storyStructure?: string;
  hookType?: string;
  ctaPattern?: string;
  targetDuration?: number;
  actualDuration?: number;
  musicTrack?: string;
  message?: string;
}

export class AutomationHistory {
  private readonly historyPath: string;

  constructor(dataDir: string = path.join(process.cwd(), "storage")) {
    this.historyPath = path.join(dataDir, "automationHistory.json");
  }

  async read(): Promise<AutomationHistoryEntry[]> {
    try {
      const raw = await readFile(this.historyPath, "utf-8");
      if (!raw || !raw.trim()) return [];
      return JSON.parse(raw) as AutomationHistoryEntry[];
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }

  async record(entry: Omit<AutomationHistoryEntry, "timestamp">): Promise<void> {
    const records = await this.read();
    const newRecord: AutomationHistoryEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    };
    records.unshift(newRecord);
    // Keep last 200 events for timeline and diagnostics
    if (records.length > 200) {
      records.splice(200);
    }
    await mkdir(path.dirname(this.historyPath), { recursive: true });
    await writeFile(this.historyPath, JSON.stringify(records, null, 2), "utf-8");
  }
}
