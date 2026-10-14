import { storageManager } from "../storage/storageManager.js";
import { getSupabaseClient } from "./index.js";
export async function uploadToSupabaseBucket(bucket:string,file:string,destination:string):Promise<string>{return storageManager.upload(bucket,file,destination);}
export async function downloadFromSupabaseBucket(
  bucketName: string,
  pathInBucket: string
): Promise<Buffer> {
  const { data, error } = await getSupabaseClient().storage.from(bucketName).download(pathInBucket);
  if (error || !data) {
    throw new Error(`Failed to download file from Supabase bucket "${bucketName}": ${error?.message || "No data"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

/**
 * Resolves a signed URL for a private bucket asset, or public URL for a public bucket asset.
 */
export async function getMediaUrl(bucketName: string, pathInBucket: string, expiresInSeconds = 3600): Promise<string> {
  const { data, error } = await getSupabaseClient().storage
    .from(bucketName)
    .createSignedUrl(pathInBucket, expiresInSeconds);

  if (error || !data) {
    throw new Error(`Failed to create signed URL for "${pathInBucket}" in bucket "${bucketName}": ${error?.message || "No URL"}`);
  }

  return data.signedUrl;
}
