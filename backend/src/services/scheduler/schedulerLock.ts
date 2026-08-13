import { mkdir } from "node:fs/promises";
import path from "node:path";
import { isSupabaseConfigured, getSupabaseClient } from "../supabase/index.js";

const TABLE = "scheduler_locks";

export class SchedulerLock {
  async acquire(slotTime: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      try {
        const { error } = await getSupabaseClient()
          .from(TABLE)
          .insert({
            key: slotTime,
          });

        if (error) {
          // PostgreSQL unique violation code is '23505'
          if (error.code === "23505") {
            return false;
          }
          throw error;
        }
        return true;
      } catch {
        return false;
      }
    }

    try {
      const lockDirName = slotTime.replace(/[^a-zA-Z0-9]/g, "_");
      const lockDirPath = path.join(process.cwd(), "storage", "locks", lockDirName);
      await mkdir(path.dirname(lockDirPath), { recursive: true });
      await mkdir(lockDirPath);
      return true;
    } catch {
      return false; // Directory already exists or creation failed (already locked)
    }
  }

  async release(slotTime: string): Promise<void> {
    if (isSupabaseConfigured()) {
      try {
        await getSupabaseClient()
          .from(TABLE)
          .delete()
          .eq("key", slotTime);
      } catch (err) {
        console.warn(`[SchedulerLock] Failed to release lock ${slotTime}:`, err);
      }
      return;
    }

    try {
      const lockDirName = slotTime.replace(/[^a-zA-Z0-9]/g, "_");
      const lockDirPath = path.join(process.cwd(), "storage", "locks", lockDirName);
      const fs = await import("node:fs/promises");
      await fs.rm(lockDirPath, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[SchedulerLock] Failed to release local lock ${slotTime}:`, err);
    }
  }
}
