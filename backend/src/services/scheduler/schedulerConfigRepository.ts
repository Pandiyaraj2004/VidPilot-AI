import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SchedulerConfig } from "../../types/index.js";

const DEFAULT_CONFIG: SchedulerConfig = {
  automationEnabled: false,
  intervalHours: 4,
  defaultStyle: "explainer",
  defaultDurationSeconds: 35,
  requireApproval: true,
  youtubeVisibility: "public",
  lastGenerationAt: null,
  nextGenerationAt: null,
  minDurationSeconds: 30,
  maxDurationSeconds: 45,
  languages: ["en", "ta", "hi"],
  enabledVoices: ["en_US-amy-medium", "ta-IN-PallaviNeural", "ta-IN-ValluvarNeural", "hi_IN-priyamvada-medium"],
  contentCategories: ["science", "general_knowledge", "technology", "history", "mystery", "motivation", "facts", "space"],
  lastJobId: null,
  updatedAt: new Date().toISOString(),
};

export class SchedulerConfigRepository {
  private readonly configPath: string;

  constructor(dataDir: string = path.join(process.cwd(), "storage")) {
    this.configPath = path.join(dataDir, "schedulerConfig.json");
  }

  async get(): Promise<SchedulerConfig> {
    try {
      const raw = await readFile(this.configPath, "utf-8");
      return JSON.parse(raw) as SchedulerConfig;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        await this.set(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }
      throw err;
    }
  }

  async set(config: SchedulerConfig): Promise<SchedulerConfig> {
    const updatedConfig = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    await mkdir(path.dirname(this.configPath), { recursive: true });
    await writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2), "utf-8");
    return updatedConfig;
  }
}
