import { useState, useEffect, useRef } from "react";
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
  onTimeout?: () => void;
};

const TIMEOUT_SECONDS = 60;

export default function ThresholdBreachModal({ alert, queueLength, onLogReason, onCreateTicket, onTimeout }: Props) {
  const [mode, setMode]       = useState<"idle" | "ticket">("idle");
  const [comment, setComment] = useState("");
  const [remaining, setRemaining] = useState(TIMEOUT_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset timer whenever the alert changes (new machine)
  useEffect(() => {
    setRemaining(TIMEOUT_SECONDS);
    setMode("idle");
    setComment("");
  }, [alert.machineId]);

  // Countdown tick
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onTimeout?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current!);
  }, [alert.machineId, onTimeout]);

  const handleLogReason = (reason: DowntimeReason) => {
    clearInterval(intervalRef.current!);
    onLogReason(alert.machineId, reason);
    setMode("idle");
    setComment("");
  };

  const handleCreateTicket = () => {
    if (!comment.trim()) return;
    clearInterval(intervalRef.current!);
    onCreateTicket(alert.machineId, comment);
    setMode("idle");
    setComment("");
  };

  // Arc progress for countdown ring (SVG circle)
  const radius    = 16;
  const circ      = 2 * Math.PI * radius;
  const progress  = remaining / TIMEOUT_SECONDS;
  const dashOffset = circ * (1 - progress);
  const isUrgent  = remaining <= 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl p-6 w-full max-w-md mx-4 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Threshold Alert</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50">{alert.machineName}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {queueLength > 0 && (
              <span className="text-xs bg-orange-100 text-orange-700 border border-orange-200 px-2 py-1 rounded-full">
                +{queueLength} more
              </span>
            )}
            {/* Countdown ring */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="absolute inset-0 -rotate-90" width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="3" />
                <circle
                  cx="20" cy="20" r={radius}
                  fill="none"
                  stroke={isUrgent ? "#ef4444" : "#f97316"}
                  strokeWidth="3"
                  strokeDasharray={circ}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <span className={`text-xs font-bold z-10 ${isUrgent ? "text-red-500" : "text-orange-500"}`}>
                {remaining}
              </span>
            </div>
          </div>
        </div>

        {/* Urgency bar */}
        <div className="h-1 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${isUrgent ? "bg-red-500" : "bg-orange-400"}`}
            style={{ width: `${progress * 100}%` }}
          />
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
