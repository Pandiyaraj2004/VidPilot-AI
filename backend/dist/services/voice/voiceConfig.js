import path from "node:path";
import { config } from "../../config/env.js";
function voicePaths(relativeDir, fileBaseName) {
    const dir = path.join(config.piper.voicesDir, relativeDir);
    return {
        modelPath: path.join(dir, `${fileBaseName}.onnx`),
        configPath: path.join(dir, `${fileBaseName}.onnx.json`),
    };
}
/**
 * Real, installed/reachable voices only — never an invented name.
 *
 * - Piper voices: add its .onnx/.onnx.json under vendor/piper-voices (see
 *   README "Piper setup") and add one entry here.
 * - Tamil has no published Piper voice as of this writing. Piper's own
 *   espeak-ng-data does contain Tamil phoneme data, but no one has trained
 *   and published a Piper .onnx acoustic model for Tamil — the phoneme
 *   data alone can't synthesise speech. The standalone espeak-ng CLI was
 *   evaluated as a fallback (it also has genuine Tamil support) but the
 *   only Windows distribution is an MSI installer; administrative
 *   extraction (`msiexec /a`) produced a binary that segfaults
 *   (STATUS_ACCESS_VIOLATION) on this machine even on `--version`, with no
 *   working portable build found. Tamil instead routes to Microsoft Edge's
 *   free Read Aloud service (EdgeTtsProvider) — real neural voices,
 *   confirmed against the live voice list (ta-IN-PallaviNeural /
 *   ta-IN-ValluvarNeural, both GA), no API key or payment required.
 */
export const VOICE_OPTIONS = [
    {
        id: "en_US-amy-medium",
        language: "en",
        label: "English — Amy (Female, Piper Local)",
        gender: "female",
        provider: "piper",
        ...voicePaths("en/en_US/amy/medium", "en_US-amy-medium"),
    },
    {
        id: "en-US-AriaNeural",
        language: "en",
        label: "English — Aria (Female, Edge Neural)",
        gender: "female",
        provider: "edge-tts",
        edgeVoiceName: "en-US-AriaNeural",
    },
    {
        id: "en-US-GuyNeural",
        language: "en",
        label: "English — Guy (Male, Edge Neural)",
        gender: "male",
        provider: "edge-tts",
        edgeVoiceName: "en-US-GuyNeural",
    },
    {
        id: "hi_IN-priyamvada-medium",
        language: "hi",
        label: "Hindi — Priyamvada (Female, Piper Local)",
        gender: "female",
        provider: "piper",
        ...voicePaths("hi/hi_IN/priyamvada/medium", "hi_IN-priyamvada-medium"),
    },
    {
        id: "hi-IN-SwararaNeural",
        language: "hi",
        label: "Hindi — Swarara (Female, Edge Neural)",
        gender: "female",
        provider: "edge-tts",
        edgeVoiceName: "hi-IN-SwararaNeural",
    },
    {
        id: "hi-IN-MadhurNeural",
        language: "hi",
        label: "Hindi — Madhur (Male, Edge Neural)",
        gender: "male",
        provider: "edge-tts",
        edgeVoiceName: "hi-IN-MadhurNeural",
    },
    {
        id: "ta-IN-PallaviNeural",
        language: "ta",
        label: "Tamil — Pallavi (Female, Edge Neural)",
        gender: "female",
        provider: "edge-tts",
        edgeVoiceName: "ta-IN-PallaviNeural",
    },
    {
        id: "ta-IN-ValluvarNeural",
        language: "ta",
        label: "Tamil — Valluvar (Male, Edge Neural)",
        gender: "male",
        provider: "edge-tts",
        edgeVoiceName: "ta-IN-ValluvarNeural",
    },
];
export function providerNameForVoice(voice) {
    return voice.provider;
}
export function getVoicesForLanguage(language) {
    return VOICE_OPTIONS.filter((voice) => voice.language === language);
}
export function getVoiceById(id) {
    return VOICE_OPTIONS.find((voice) => voice.id === id);
}
export function getDefaultVoiceForLanguage(language) {
    return getVoicesForLanguage(language)[0];
}
export const MIN_VOICE_SPEED = 0.75;
export const MAX_VOICE_SPEED = 1.5;
export const DEFAULT_VOICE_SPEED = 1.0;
export function isValidVoiceSpeed(speed) {
    return Number.isFinite(speed) && speed >= MIN_VOICE_SPEED && speed <= MAX_VOICE_SPEED;
}
