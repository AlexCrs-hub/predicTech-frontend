import { useState } from "react";
import { Button } from "@/lib/components/ui/button";
import { ALL_REASONS, REASON_LABEL, DowntimeReason } from "@/lib/api/downtimeRecordsApi";

export type BreachAlert = {
  machineId: string;
  machineName: string;
  value: number;
  threshold: number;
};

type Props = {
  alert: BreachAlert;
  queueLength: number;
  onLogReason: (machineId: string, reason: DowntimeReason) => void;
  onCreateTicket: (machineId: string, comment: string) => void;
};

export default function ThresholdBreachModal({ alert, queueLength, onLogReason, onCreateTicket }: Props) {
  const [mode, setMode] = useState<"idle" | "ticket">("idle");
  const [comment, setComment] = useState("");

  const handleLogReason = (reason: DowntimeReason) => {
    onLogReason(alert.machineId, reason);
    setMode("idle");
    setComment("");
  };

  const handleCreateTicket = () => {
    if (!comment.trim()) return;
    onCreateTicket(alert.machineId, comment);
    setMode("idle");
    setComment("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Threshold Alert</p>
            <h2 className="text-lg font-bold">{alert.machineName}</h2>
          </div>
          {queueLength > 0 && (
            <span className="shrink-0 text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-full">
              +{queueLength} more pending
            </span>
          )}
        </div>

        {/* Values */}
        <div className="flex gap-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3">
          <div>
            <p className="text-xs text-gray-500">Current value</p>
            <p className="text-2xl font-bold text-red-600">{alert.value.toFixed(1)}</p>
          </div>
          <div className="border-l border-red-200 pl-4">
            <p className="text-xs text-gray-500">Threshold</p>
            <p className="text-2xl font-bold text-gray-700">{alert.threshold}</p>
          </div>
        </div>

        {mode === "idle" && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">Select downtime reason:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_REASONS.map((r) => (
                  <Button key={r} size="sm" variant="outline" className="text-xs h-7" onClick={() => handleLogReason(r)}>
                    {REASON_LABEL[r]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <Button className="w-full" onClick={() => setMode("ticket")}>
                Create Ticket
              </Button>
            </div>
          </>
        )}

        {mode === "ticket" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold">Add a comment to the ticket:</p>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Describe the issue…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("idle")}>Back</Button>
              <Button disabled={!comment.trim()} onClick={handleCreateTicket}>
                Create
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
