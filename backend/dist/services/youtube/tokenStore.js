import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { runtimeState } from "../runtime/state.js";
import { readFile, rm } from "node:fs/promises";
import { config } from "../../config/env.js";
function encryptionKey() { const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY ?? "", "hex"); if (key.length !== 32)
    throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex characters"); return key; }
export async function readToken() {
    const encrypted = await runtimeState.get("oauth:youtube");
    if (encrypted) {
        const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encrypted.iv, "hex"));
        decipher.setAuthTag(Buffer.from(encrypted.tag, "hex"));
        return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.data, "base64")), decipher.final()]).toString());
    }
    // Existing connections can be migrated explicitly by connecting/saving with an encryption key.
    try {
        return JSON.parse(await readFile(config.youtube.tokenStorePath, "utf8"));
    }
    catch (e) {
        if (e.code === "ENOENT")
            return null;
        throw e;
    }
}
export async function writeToken(token) { const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv); const data = Buffer.concat([cipher.update(JSON.stringify(token)), cipher.final()]); await runtimeState.set("oauth:youtube", { iv: iv.toString("hex"), tag: cipher.getAuthTag().toString("hex"), data: data.toString("base64") }); }
export async function clearToken() { await runtimeState.remove("oauth:youtube"); await rm(config.youtube.tokenStorePath, { force: true }); }
