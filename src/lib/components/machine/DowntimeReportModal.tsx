import { useEffect, useMemo, useState } from "react";
import {
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

type Draft = { reason: DowntimeReason | ""; type: DowntimeType };

function isToday(d: Date) {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(d: Date) {
  return isToday(d)
    ? fmtTime(d)
    : `${d.toLocaleDateString([], { day: "numeric", month: "short" })} ${fmtTime(d)}`;
}

/**
 * Report one or more downtimes of a single machine. Each downtime gets its own tab,
 * ordered chronologically (earliest first).
 */
export default function DowntimeReportModal({
  machineName,
  records,
  initialRecordId,
  onClose,
  onSaved,
}: {
  machineName: string;
  records: DowntimeRecord[];
  initialRecordId?: string;
  onClose: () => void;
  onSaved?: (record: DowntimeRecord) => void;
}) {
  const sorted = useMemo(
    () => [...records].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()),
    [records],
  );

  const [index, setIndex] = useState(() => {
    const i = sorted.findIndex((r) => r._id === initialRecordId);
    return i >= 0 ? i : 0;
  });
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      sorted.map((r) => [
        r._id,
        r.reasonRecorded && r.reason
          ? { reason: r.reason, type: r.downtimeType ?? "unplanned" }
          : { reason: "", type: "unplanned" },
      ]),
    ),
  );
  const [saved, setSaved] = useState<Set<string>>(
    () => new Set(sorted.filter((r) => r.reasonRecorded).map((r) => r._id)),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (sorted.length === 0) return null;

  const record = sorted[index];
  const draft  = drafts[record._id];
  const start  = new Date(record.startedAt);
  const end    = downtimeEnd(record);
  const ongoing = !record.resolvedAt;

  const setDraft = (patch: Partial<Draft>) =>
    setDrafts((d) => ({ ...d, [record._id]: { ...d[record._id], ...patch } }));

  const nextUnsaved = (after: number, savedNow: Set<string>) => {
    for (let k = 1; k <= sorted.length; k++) {
      const i = (after + k) % sorted.length;
      if (!savedNow.has(sorted[i]._id)) return i;
    }
    return -1;
  };

  const save = async () => {
    if (!draft.reason) return;
    setSaving(true);
    setError("");
    try {
      const updated = await recordDowntimeReason(record._id, draft.reason, draft.type);
      const savedNow = new Set(saved).add(record._id);
      setSaved(savedNow);
      onSaved?.({ ...record, ...updated });
      const next = nextUnsaved(index, savedNow);
      if (next === -1) onClose();
      else setIndex(next);
    } catch {
      setError("Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remaining = sorted.filter((r) => !saved.has(r._id)).length;
  const remainingAfterSave = remaining - (saved.has(record._id) ? 0 : 1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-lg mx-4 p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-red-500">Report downtime</p>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-50">{machineName}</h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {sorted.length === 1
                ? "1 downtime"
                : `${sorted.length} downtimes · ${remaining} left to report`}
            </p>
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

        {/* tabs — one per downtime, earliest first */}
        {sorted.length > 1 && (
          <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 border-b border-gray-100 dark:border-zinc-800">
            {sorted.map((r, i) => {
              const active = i === index;
              const done = saved.has(r._id);
              return (
                <button
                  key={r._id}
                  onClick={() => setIndex(i)}
                  className={`shrink-0 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-t-lg border-b-2 transition-colors ${
                    active
                      ? "border-blue-500 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 font-semibold"
                      : "border-transparent text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  <span className="tabular-nums">#{i + 1}</span>
                  <span className="tabular-nums">{fmtDateTime(new Date(r.startedAt))}</span>
                  {done && <span className="text-green-600 dark:text-green-400">✓</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* period */}
        <div className="flex gap-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
          <div className="flex-1">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Period</p>
            <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 tabular-nums">
              {fmtDateTime(start)} – {ongoing ? "ongoing" : fmtDateTime(end)}
            </p>
          </div>
          <div className="border-l border-red-200 dark:border-red-800 pl-4">
            <p className="text-xs text-gray-500 dark:text-zinc-400">Duration</p>
            <p className="text-sm font-bold text-red-600 tabular-nums">
              {formatDuration(end.getTime() - start.getTime())}{ongoing ? "+" : ""}
            </p>
          </div>
        </div>

        {/* type */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Type</p>
          <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden text-xs w-fit">
            {(["unplanned", "planned"] as DowntimeType[]).map((t) => (
              <button
                key={t}
                onClick={() => setDraft({ type: t })}
                className={`px-3 py-1.5 capitalize transition-colors ${
                  draft.type === t
                    ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                    : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* reason */}
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200">Reason</p>
          <div className="flex flex-wrap gap-2">
            {ALL_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => setDraft({ reason: r })}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 hover:border-blue-400 transition-colors"
                style={
                  draft.reason === r
                    ? { backgroundColor: `${REASON_COLOR[r]}20`, borderColor: REASON_COLOR[r], color: REASON_COLOR[r], fontWeight: 600 }
                    : undefined
                }
              >
                <span className={draft.reason === r ? "" : "text-gray-600 dark:text-zinc-300"}>{REASON_LABEL[r]}</span>
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        {/* actions */}
        <div className="flex justify-end gap-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
          <button
            onClick={onClose}
            className="mt-3 text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
          <button
            disabled={!draft.reason || saving}
            onClick={save}
            className="mt-3 text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : remainingAfterSave > 0 ? "Save & next" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
