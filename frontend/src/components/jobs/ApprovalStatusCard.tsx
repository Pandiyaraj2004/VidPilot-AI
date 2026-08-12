import { CheckCircle2, Clock, Send, XCircle } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { JobApproval } from "@/types";

const STATUS_BADGE: Record<JobApproval["status"], BadgeVariant> = {
  not_sent: "neutral",
  sent: "info",
  approved: "success",
  rejected: "error",
};

const STATUS_LABEL: Record<JobApproval["status"], string> = {
  not_sent: "Not sent",
  sent: "Awaiting your decision",
  approved: "Approved",
  rejected: "Rejected",
};

export function ApprovalStatusCard({
  approval,
  onSend,
  sending,
}: {
  approval: JobApproval;
  onSend: () => void;
  sending: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <div className="flex items-center gap-2">
        {approval.status === "approved" && <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />}
        {approval.status === "rejected" && <XCircle className="h-4 w-4 text-error" aria-hidden="true" />}
        {approval.status === "sent" && <Clock className="h-4 w-4 text-info" aria-hidden="true" />}
        <h3 className="text-sm font-semibold text-text-primary">Telegram Approval</h3>
        <Badge variant={STATUS_BADGE[approval.status]}>{STATUS_LABEL[approval.status]}</Badge>
      </div>

      {approval.sentAt && (
        <p className="mt-2 text-xs text-text-secondary">Sent to Telegram {new Date(approval.sentAt).toLocaleString()}</p>
      )}

      {approval.status === "rejected" && approval.reason && (
        <p className="mt-3 rounded-md bg-error/10 px-3 py-2 text-xs text-error">
          <span className="font-medium">Reason: </span>
          {approval.reason}
        </p>
      )}

      {approval.status === "approved" && approval.decidedAt && (
        <p className="mt-2 text-xs text-text-secondary">Approved {new Date(approval.decidedAt).toLocaleString()}</p>
      )}

      {approval.status === "sent" && (
        <p className="mt-2 text-xs text-text-secondary">
          Check Telegram for the video with Approve / Reject buttons. This card updates once you respond there.
        </p>
      )}

      {(approval.status === "not_sent" || approval.status === "sent") && (
        <Button variant="secondary" className="mt-3" disabled={sending} loading={sending} onClick={onSend}>
          <Send className="h-4 w-4" />
          {approval.status === "sent" ? "Resend to Telegram" : "Send for Telegram Approval"}
        </Button>
      )}
    </div>
  );
}

export function ApprovalNotRequested({ onSend, sending }: { onSend: () => void; sending: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-elevated p-4">
      <h3 className="text-sm font-semibold text-text-primary">Telegram Approval</h3>
      <p className="mt-2 text-sm text-text-secondary">
        Send the rendered video to your Telegram for a real human approve/reject decision before it moves forward.
      </p>
      <Button variant="secondary" className="mt-3" disabled={sending} loading={sending} onClick={onSend}>
        <Send className="h-4 w-4" />
        Send for Telegram Approval
      </Button>
    </div>
  );
}
