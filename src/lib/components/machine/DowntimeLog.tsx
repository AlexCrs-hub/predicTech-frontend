import { useState, useEffect, useCallback } from "react";
import {
  fetchUnresolvedDowntime,
  recordDowntimeReason,
  DowntimeRecord,
  DowntimeReason,
  DowntimeType,
  REASON_LABEL,
  REASON_COLOR,
  ALL_REASONS,
} from "@/lib/api/downtimeRecordsApi";

// ── entry row ─────────────────────────────────────────────────────────────────

function duration(start: string, end: string | null): string {
  const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

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
  const dur = duration(record.startedAt, record.resolvedAt);

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800">
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
          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
            {record.downtimeType && (
              <span className="mr-1 capitalize">{record.downtimeType}</span>
            )}
            {dur}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-zinc-500">{startTime}</span>
          {!record.reasonRecorded && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              {open ? "Cancel" : "Log ↓"}
            </button>
          )}
        </div>
      </div>

      {/* reason form */}
      {open && !record.reasonRecorded && (
        <div className="flex flex-col gap-2 pt-1 border-t border-gray-200 dark:border-zinc-700">
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
            <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden text-[10px]">
              {(["planned", "unplanned"] as DowntimeType[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`px-2 py-1 capitalize transition-colors ${
                    type === t
                      ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                      : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400"
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
}: {
  machineId: string;
  refreshKey?: number;
  periodHours?: number;
}) {
  const [records, setRecords] = useState<DowntimeRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(false);

  const load = useCallback(async () => {
    if (!machineId) return;
    setLoading(true);
    setError(false);
    try {
      const data = await fetchUnresolvedDowntime(machineId);
      const cutoff = periodHours ? Date.now() - periodHours * 60 * 60 * 1000 : 0;
      setRecords(
        data
          .filter((r) => !periodHours || new Date(r.startedAt).getTime() >= cutoff)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
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
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          Downtime Records
        </span>
        {unresolvedCount > 0 && (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
            {unresolvedCount} unresolved
          </span>
        )}
      </div>

      {loading && <p className="text-xs text-gray-400 dark:text-zinc-500">Loading…</p>}
      {error   && <p className="text-xs text-red-500">Failed to load records.</p>}

      {!loading && !error && records.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          No downtime records{periodHours ? " in selected period" : ""}.
        </p>
      )}

      {!loading && records.length > 0 && (
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-0.5">
          {records.map((r) => (
            <EntryRow key={r._id} record={r} onResolved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
