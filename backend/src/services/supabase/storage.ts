import { readFile } from "node:fs/promises";
import mime from "mime-types";
import { getSupabaseClient } from "./index.js";

/**
 * Uploads a local file to a Supabase storage bucket.
 * If the bucket is 'rendered-videos' (which is public), returns the public URL.
 * Otherwise, returns the relative path inside the bucket.
 */
export async function uploadToSupabaseBucket(
  bucketName: string,
  localFilePath: string,
  destinationPath: string
): Promise<string> {
  const fileBuffer = await readFile(localFilePath);
  const contentType = mime.lookup(localFilePath) || "application/octet-stream";

  const { error } = await getSupabaseClient().storage
    .from(bucketName)
    .upload(destinationPath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Failed to upload file to Supabase bucket "${bucketName}": ${error.message}`);
  }

  if (bucketName === "rendered-videos") {
    const { data } = getSupabaseClient().storage.from(bucketName).getPublicUrl(destinationPath);
    return data.publicUrl;
  }

  return destinationPath;
}

/**
 * Downloads a file from a Supabase bucket to a local file path.
 */
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
  if (bucketName === "rendered-videos") {
    const { data } = getSupabaseClient().storage.from(bucketName).getPublicUrl(pathInBucket);
    return data.publicUrl;
  }

  const { data, error } = await getSupabaseClient().storage
    .from(bucketName)
    .createSignedUrl(pathInBucket, expiresInSeconds);

  if (error || !data) {
    throw new Error(`Failed to create signed URL for "${pathInBucket}" in bucket "${bucketName}": ${error?.message || "No URL"}`);
  }

  return data.signedUrl;
}
