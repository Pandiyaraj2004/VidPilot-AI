import { FlowDiagram, type FlowStep } from "@/components/common/FlowDiagram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

const WORKFLOW_STEPS: FlowStep[] = [
  { label: "Create Video", tone: "manual", status: "done", hint: "Available now" },
  { label: "Script Generation", tone: "automatic", status: "done", hint: "Available now — Gemini with OpenRouter fallback" },
  { label: "Voice Generation", tone: "automatic", status: "done", hint: "Available now — Piper (English/Hindi) + Edge TTS (Tamil)" },
  { label: "Visuals & Rendering", tone: "automatic", status: "done", hint: "Available now — Remotion + FFmpeg, cross-scene transitions, English/Hindi/Tamil" },
  { label: "Quality Check", tone: "automatic", status: "done", hint: "Available now — 8 real validators, weighted PASS/WARN/FAIL score" },
  { label: "Telegram Approval", tone: "manual", status: "done", hint: "Available now — real bot, approve/reject with reason on your phone" },
  { label: "YouTube", tone: "automatic", status: "done", hint: "Available now — oauth client-validated upload with synthetic-media labels" },
  { label: "Analytics", tone: "automatic", status: "waiting", hint: "Coming in a future phase" },
];

export function WorkflowSummaryCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your VidPilot Workflow</CardTitle>
      </CardHeader>
      <CardContent>
        <FlowDiagram steps={WORKFLOW_STEPS} />
      </CardContent>
    </Card>
  );
}
