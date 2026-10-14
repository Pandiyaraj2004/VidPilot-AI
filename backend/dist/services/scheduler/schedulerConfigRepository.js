import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, getSupabaseClient } from "../supabase/index.js";
const DEFAULT_CONFIG = {
    automationEnabled: false,
    intervalHours: 4,
    defaultStyle: "explainer",
    defaultDurationSeconds: 35,
    youtubeVisibility: "public",
    lastGenerationAt: null,
    nextGenerationAt: null,
    minDurationSeconds: 30,
    maxDurationSeconds: 45,
    languages: ["en", "ta", "hi"],
    enabledVoices: ["en_US-amy-medium", "ta-IN-PallaviNeural", "ta-IN-ValluvarNeural", "hi_IN-priyamvada-medium"],
    contentCategories: ["science", "general_knowledge", "technology", "history", "mystery", "motivation", "facts", "space"],
    lastJobId: null,
    timezone: "UTC",
    defaultLanguage: "en",
    updatedAt: new Date().toISOString(),
};
const TABLE = "scheduler_config";
export class SchedulerConfigRepository {
    configPath;
    cachedConfig = null;
    cacheTimestamp = 0;
    static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL
    constructor(dataDir = process.env.SCHEDULER_DATA_DIR ?? path.join(process.cwd(), "storage")) {
        this.configPath = path.join(dataDir, "schedulerConfig.json");
    }
    async get() {
        const now = Date.now();
        if (this.cachedConfig && (now - this.cacheTimestamp < SchedulerConfigRepository.CACHE_TTL_MS)) {
            return this.cachedConfig;
        }
        let loadedConfig;
        if (isSupabaseConfigured()) {
            const { data, error } = await getSupabaseClient()
                .from(TABLE)
                .select("data")
                .eq("id", "default")
                .maybeSingle();
            if (error) {
                throw new Error(`Failed to load scheduler config from Supabase: ${error.message}`);
            }
            if (data) {
                loadedConfig = data.data;
            }
            else {
                // If not present, save the default config
                loadedConfig = await this.set(DEFAULT_CONFIG);
            }
        }
        else {
            try {
                const raw = await readFile(this.configPath, "utf-8");
                loadedConfig = JSON.parse(raw);
            }
            catch (err) {
                if (err.code === "ENOENT") {
                    loadedConfig = await this.set(DEFAULT_CONFIG);
                }
                else {
                    throw err;
                }
            }
        }
        loadedConfig = Object.fromEntries(Object.entries(DEFAULT_CONFIG).map(([key, fallback]) => [key, loadedConfig[key] ?? fallback]));
        this.cachedConfig = loadedConfig;
        this.cacheTimestamp = now;
        return loadedConfig;
    }
    async set(config) {
        const updatedConfig = {
            ...Object.fromEntries(Object.keys(DEFAULT_CONFIG).map(key => [key, config[key]])),
            updatedAt: new Date().toISOString(),
        };
        if (isSupabaseConfigured()) {
            const { error } = await getSupabaseClient()
                .from(TABLE)
                .upsert({
                id: "default",
                data: updatedConfig,
                updated_at: updatedConfig.updatedAt,
            });
            if (error) {
                throw new Error(`Failed to save scheduler config to Supabase: ${error.message}`);
            }
        }
        else {
            await mkdir(path.dirname(this.configPath), { recursive: true });
            await writeFile(this.configPath, JSON.stringify(updatedConfig, null, 2), "utf-8");
        }
        // Update in-memory cache
        this.cachedConfig = updatedConfig;
        this.cacheTimestamp = Date.now();
        return updatedConfig;
    }
}
