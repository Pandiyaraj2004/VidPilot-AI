import { jobRepository } from "../src/services/jobs/index.js";

const jobId = process.argv[2];
if (!jobId) {
  console.error("Usage: npx tsx scripts/resetJob.ts <jobId>");
  process.exit(1);
}

const job = await jobRepository.getJob(jobId);
if (!job) {
  console.error(`Job ${jobId} not found.`);
  process.exit(1);
}

console.log(`Current status: ${job.status} | videoRender: ${job.videoRender?.status ?? null}`);

const updated = await jobRepository.updateJob(jobId, {
  status: "voice_ready",
  lastError: null,
  videoRender: null,
});

console.log(`Reset to: ${updated.status}`);
