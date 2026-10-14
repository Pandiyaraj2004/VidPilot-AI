import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, getSupabaseClient } from "../supabase/index.js";
const TABLE = "automation_history";
export class AutomationHistory {
    historyPath;
    constructor(dataDir = process.env.SCHEDULER_DATA_DIR ?? path.join(process.cwd(), "storage")) {
        this.historyPath = path.join(dataDir, "automationHistory.json");
    }
    async read() {
        if (isSupabaseConfigured()) {
            const { data, error } = await getSupabaseClient()
                .from(TABLE)
                .select("data")
                .order("id", { ascending: false })
                .limit(200);
            if (error) {
                throw new Error(`Failed to read automation history from Supabase: ${error.message}`);
            }
            return (data || []).map((row) => row.data);
        }
        try {
            const raw = await readFile(this.historyPath, "utf-8");
            if (!raw || !raw.trim())
                return [];
            return JSON.parse(raw);
        }
        catch (err) {
            if (err.code === "ENOENT")
                return [];
            throw err;
        }
    }
    async record(entry) {
        const newRecord = {
            timestamp: new Date().toISOString(),
            ...entry,
        };
        if (isSupabaseConfigured()) {
            const { error } = await getSupabaseClient()
                .from(TABLE)
                .insert({
                data: newRecord,
            });
            if (error) {
                throw new Error(`Failed to record automation history in Supabase: ${error.message}`);
            }
            return;
        }
        const records = await this.read();
        records.unshift(newRecord);
        // Keep last 200 events for timeline and diagnostics
        if (records.length > 200) {
            records.splice(200);
        }
        await mkdir(path.dirname(this.historyPath), { recursive: true });
        await writeFile(this.historyPath, JSON.stringify(records, null, 2), "utf-8");
    }
}
