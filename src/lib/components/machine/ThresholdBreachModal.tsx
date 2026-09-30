import { useState, useEffect } from "react";
import { Button } from "@/lib/components/ui/button";
import { ALL_REASONS, REASON_LABEL, DowntimeReason } from "@/lib/api/downtimeRecordsApi";
import type { BreachAlert } from "@/context/NotificationContext";

export type { BreachAlert };

type Props = {
  alert: BreachAlert;
  onClose: () => void;
  onLogReason: (machineId: string, reason: DowntimeReason) => void;
  onCreateTicket: (machineId: string, comment: string) => void;
};

export default function ThresholdBreachModal({ alert, onClose, onLogReason, onCreateTicket }: Props) {
  const [mode, setMode]       = useState<"idle" | "ticket">("idle");
  const [comment, setComment] = useState("");

  useEffect(() => {
    setMode("idle");
    setComment("");
  }, [alert.machineId]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Threshold Alert</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50">{alert.machineName}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {/* Values */}
        <div className="flex gap-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">Current value</p>
            <p className="text-2xl font-bold text-red-600">{alert.value.toFixed(1)} <span className="text-sm font-normal">kW</span></p>
          </div>
          <div className="border-l border-red-200 dark:border-red-800 pl-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Threshold</p>
            <p className="text-2xl font-bold text-gray-700 dark:text-zinc-200">{alert.threshold} <span className="text-sm font-normal">kW</span></p>
          </div>
        </div>

        {mode === "idle" && (
          <>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Select downtime reason:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_REASONS.map((r) => (
                  <Button key={r} size="sm" variant="outline" className="text-xs h-7" onClick={() => handleLogReason(r)}>
                    {REASON_LABEL[r]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="border-t dark:border-zinc-700 pt-3">
              <Button className="w-full" onClick={() => setMode("ticket")}>
                Create Ticket
              </Button>
            </div>
          </>
        )}

        {mode === "ticket" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Add a comment to the ticket:</p>
            <textarea
              className="w-full rounded-md border dark:border-zinc-700 bg-background dark:bg-zinc-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Describe the issue…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setMode("idle")}>Back</Button>
              <Button disabled={!comment.trim()} onClick={handleCreateTicket}>Create</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
