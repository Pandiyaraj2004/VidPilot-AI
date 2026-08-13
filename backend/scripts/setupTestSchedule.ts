import dotenv from "dotenv";
dotenv.config();

import { SchedulerConfigRepository } from "../src/services/scheduler/schedulerConfigRepository.js";

async function main() {
  const repo = new SchedulerConfigRepository();
  const current = await repo.get();

  const now = new Date();
  const testTime = new Date(now.getTime() + 2 * 60 * 1000); // 2 minutes from now

  console.log(`Current system time (UTC): ${now.toISOString()}`);
  console.log(`Configuring test slot for (UTC): ${testTime.toISOString()}`);

  const updated = {
    ...current,
    automationEnabled: true,
    requireApproval: true,
    nextGenerationAt: testTime.toISOString(),
    timezone: "Asia/Kolkata",
    intervalHours: 4,
    updatedAt: new Date().toISOString(),
  };

  await repo.set(updated);
  console.log("Scheduler configuration updated successfully!");
}

main().catch((err) => {
  console.error("Failed to setup test schedule:", err);
  process.exit(1);
});
