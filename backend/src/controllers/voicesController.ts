import type { NextFunction, Request, Response } from "express";
import { previewVoice } from "../services/voice/voiceEngine.js";
import { VOICE_OPTIONS } from "../services/voice/voiceConfig.js";

export function listVoicesHandler(req: Request, res: Response): void {
  const language = typeof req.query.language === "string" ? req.query.language : undefined;
  const voices = VOICE_OPTIONS.filter((voice) => !language || voice.language === language).map((voice) => ({
    id: voice.id,
    language: voice.language,
    label: voice.label,
    gender: voice.gender,
  }));
  res.json(voices);
}

export async function previewVoiceHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const voiceId = typeof req.body?.voiceId === "string" ? req.body.voiceId : undefined;
    const speed = typeof req.body?.speed === "number" ? req.body.speed : undefined;
    if (!voiceId) {
      res.status(400).json({ error: "voiceId is required." });
      return;
    }

    const { filePath, cleanup } = await previewVoice(voiceId, speed ?? 1.0);
    res.sendFile(filePath, (err) => {
      cleanup();
      if (err) next(err);
    });
  } catch (err) {
    next(err);
  }
}
