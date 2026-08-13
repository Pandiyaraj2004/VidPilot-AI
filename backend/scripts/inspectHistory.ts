import dotenv from "dotenv";
dotenv.config();

import { jobRepository } from "../src/services/jobs/index.js";
import { AutomationHistory } from "../src/services/scheduler/automationHistory.js";
import { SchedulerConfigRepository } from "../src/services/scheduler/schedulerConfigRepository.js";

async function main() {
  const repo = new SchedulerConfigRepository();
  const config = await repo.get();
  console.log("Current Config:", JSON.stringify(config, null, 2));

  console.log("\nRecent Jobs:");
  const allJobs = await jobRepository.listJobs();
  const recent = allJobs.slice(-3);
  for (const j of recent) {
    console.log(`- Job ${j.id}: status=${j.status}, created=${j.createdAt}, error=${j.lastError}`);
  }

  console.log("\nReading Automation History Log:");
  const history = new AutomationHistory();
  const logs = await history.read();
  console.log(JSON.stringify(logs.slice(-5), null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
});
