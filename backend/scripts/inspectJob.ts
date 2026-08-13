import dotenv from "dotenv";
dotenv.config();

import { jobRepository } from "../src/services/jobs/index.js";
import { AutomationHistory } from "../src/services/scheduler/automationHistory.js";

async function main() {
  const jobId = process.argv[2];
  if (!jobId) {
    console.error("Please provide a jobId as argument.");
    process.exit(1);
  }

  console.log(`Inspecting Job ID: ${jobId}`);
  const job = await jobRepository.getJob(jobId);
  console.log("Job status:", job?.status);
  console.log("Job error:", job?.lastError);
  console.log("Job details:", JSON.stringify(job, null, 2));

  console.log("\nReading Automation History Log:");
  const history = new AutomationHistory();
  const logs = await history.read();
  console.log(JSON.stringify(logs.slice(-5), null, 2));
}

main().catch((err) => {
  console.error("Error:", err);
});
