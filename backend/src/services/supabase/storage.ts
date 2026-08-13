import { readFile } from "node:fs/promises";
import mime from "mime-types";
import { getSupabaseClient } from "./index.js";

/** Maximum time (ms) to wait for any single Supabase Storage upload before
 *  treating the attempt as failed. Prevents a hung HTTP connection from
 *  blocking the entire pipeline indefinitely. 90 s is generous for files
 *  up to ~50 MB on a typical broadband connection; large uploads near the
 *  Telegram 50 MB limit may approach this ceiling on slow links, but that
 *  is already a separate validation gate (TELEGRAM_MAX_VIDEO_BYTES). */
const UPLOAD_TIMEOUT_MS = 90_000;

/**
 * Uploads a local file to a Supabase storage bucket.
 * If the bucket is 'rendered-videos' (which is public), returns the public URL.
 * Otherwise, returns the relative path inside the bucket.
 *
 * Throws if the upload exceeds UPLOAD_TIMEOUT_MS — the caller's catch block
 * is responsible for deciding whether to fall back to local storage.
 */
export async function uploadToSupabaseBucket(
  bucketName: string,
  localFilePath: string,
  destinationPath: string
): Promise<string> {
  const fileBuffer = await readFile(localFilePath);
  const contentType = mime.lookup(localFilePath) || "application/octet-stream";

  const uploadPromise = getSupabaseClient().storage
    .from(bucketName)
    .upload(destinationPath, fileBuffer, {
      contentType,
      upsert: true,
    });

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Supabase upload to "${bucketName}/${destinationPath}" timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`)),
      UPLOAD_TIMEOUT_MS
    )
  );

  const { error } = await Promise.race([uploadPromise, timeoutPromise]);

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
