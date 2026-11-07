import { useState, useEffect, useCallback } from "react";
import {
  fetchReportableDowntime,
  recordDowntimeReason,
  downtimeEnd,
  formatDuration,
  DowntimeRecord,
  DowntimeReason,
  DowntimeType,
  REASON_LABEL,
  REASON_COLOR,
  ALL_REASONS,
} from "@/lib/api/downtimeRecordsApi";

// ── entry row ─────────────────────────────────────────────────────────────────

function EntryRow({
  record,
  onResolved,
}: {
  record: DowntimeRecord;
  onResolved: () => void;
}) {
  const [reason, setReason]   = useState<DowntimeReason | "">("");
  const [type, setType]       = useState<DowntimeType>("unplanned");
  const [saving, setSaving]   = useState(false);
  const [open, setOpen]       = useState(!record.reasonRecorded);

  const submit = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      await recordDowntimeReason(record._id, reason as DowntimeReason, type);
      onResolved();
    } catch {
      setSaving(false);
    }
  };

  const startTime = new Date(record.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const dur = formatDuration(downtimeEnd(record).getTime() - new Date(record.startedAt).getTime());

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-muted/60 border border-border">
      {/* main row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {record.reasonRecorded && record.reason ? (
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${REASON_COLOR[record.reason]}20`, color: REASON_COLOR[record.reason] }}
            >
              {REASON_LABEL[record.reason]}
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
              Needs reason
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {record.downtimeType && (
              <span className="mr-1 capitalize">{record.downtimeType}</span>
            )}
            {dur}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">{startTime}</span>
          {!record.reasonRecorded && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-300 dark:border-zinc-600 text-muted-foreground hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {open ? "Cancel" : "Log ↓"}
            </button>
          )}
        </div>
      </div>

      {/* reason form */}
      {open && !record.reasonRecorded && (
        <div className="flex flex-col gap-2 pt-1 border-t border-border">
          <div className="flex flex-wrap gap-1">
            {ALL_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setReason(r)}
                className="text-[10px] px-2 py-0.5 rounded-full border transition-colors"
                style={reason === r
                  ? { backgroundColor: `${REASON_COLOR[r]}20`, borderColor: REASON_COLOR[r], color: REASON_COLOR[r] }
                  : { borderColor: "#d1d5db", color: "#6b7280" }}
              >
                {REASON_LABEL[r]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 items-center">
            <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-0.5 text-[10px]">
              {(["planned", "unplanned"] as DowntimeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-2 py-1 capitalize transition-colors ${
                    type === t
                      ? "rounded-md bg-background text-foreground shadow-sm font-semibold"
                      : "bg-card text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <button
              disabled={!reason || saving}
              onClick={submit}
              className="flex-1 text-[10px] font-semibold py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function DowntimeLog({
  machineId,
  refreshKey = 0,
  periodHours,
  onReported,
}: {
  machineId: string;
  refreshKey?: number;
  periodHours?: number;
  /** called after a reason is saved; the parent is expected to bump refreshKey */
  onReported?: () => void;
}) {
  const [records, setRecords] = useState<DowntimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchReportableDowntime(machineId, periodHours);
      setRecords(
        data.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [machineId, periodHours]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const unresolvedCount = records.filter((r) => !r.reasonRecorded).length;

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          Downtime Records
        </span>
        {unresolvedCount > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {error   && <p className="text-xs text-red-500">Failed to load records.</p>}

      {!loading && !error && records.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No downtime records{periodHours ? " in selected period" : ""}.
        </p>
      )}

      {!loading && records.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-0.5">
          {records.map((r) => (
            <EntryRow key={r._id} record={r} onResolved={onReported ?? load} />
          ))}
        </div>
      )}
    </div>
  );
}
