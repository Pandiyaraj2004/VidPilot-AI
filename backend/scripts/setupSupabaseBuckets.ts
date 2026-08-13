import dotenv from "dotenv";
dotenv.config();

import { getSupabaseClient, isSupabaseConfigured } from "../src/services/supabase/index.js";

async function main() {
  if (!isSupabaseConfigured()) {
    console.log("Supabase is not configured. Skipping bucket setup.");
    return;
  }

  const supabase = getSupabaseClient();
  const requiredBuckets = ["voice-audio", "visual-cache", "rendered-videos"];

  console.log("Verifying and creating required Supabase Storage buckets...");

  for (const bucketName of requiredBuckets) {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      throw new Error(`Failed to list buckets: ${listError.message}`);
    }

    const exists = buckets.some((b) => b.id === bucketName);
    if (exists) {
      console.log(`Bucket "${bucketName}" already exists.`);
    } else {
      console.log(`Bucket "${bucketName}" not found. Creating it...`);
      const { data, error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true,
      });
      if (createError) {
        throw new Error(`Failed to create bucket "${bucketName}": ${createError.message}`);
      }
      console.log(`Bucket "${bucketName}" successfully created.`);
    }
  }

  console.log("Supabase Storage buckets setup complete!");
}

main().catch((err) => {
  console.error("Error setting up Supabase buckets:", err);
  process.exit(1);
});
