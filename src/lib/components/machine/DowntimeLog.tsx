import { useState, useEffect } from "react";
import { DOWNTIME_REASONS } from "@/lib/utils/machineSimulation";
import { EscalationLevel } from "@/context/NotificationContext";

// ── types ─────────────────────────────────────────────────────────────────────

type Escalation = {
  level: EscalationLevel;
  note: string;
  escalatedAt: string;
};

type DowntimeEntry = {
  reason: string;
  loggedAt: string;
  escalation?: Escalation;
};

// ── storage ───────────────────────────────────────────────────────────────────

const STORAGE_KEY = "predictech_downtime";

function load(machineId: string): DowntimeEntry[] {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Array.isArray(all[machineId]) ? all[machineId] : [];
  } catch {
    return [];
  }
}

function save(machineId: string, entries: DowntimeEntry[]) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all[machineId] = entries;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

// ── escalation badges ─────────────────────────────────────────────────────────

const ESCALATION_LABEL: Record<EscalationLevel, string> = {
  supervisor: "Supervisor",
  manager: "Manager",
  director: "Director",
};

const ESCALATION_COLOR: Record<EscalationLevel, string> = {
  supervisor: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-700",
  manager:    "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700",
  director:   "bg-red-100    dark:bg-red-900/30    text-red-700    dark:text-red-400    border-red-300    dark:border-red-700",
};

// ── entry row ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  onEscalate,
}: {
  entry: DowntimeEntry;
  onEscalate: (e: Escalation) => void;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  const confirm = (level: EscalationLevel) => {
    onEscalate({ level, note, escalatedAt: new Date().toISOString() });
    setOpen(false);
    setNote("");
  };

  return (
    <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg bg-gray-50 dark:bg-zinc-800/60 border border-gray-100 dark:border-zinc-800">
      {/* main row */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-800 dark:text-zinc-200 font-medium truncate">
          {entry.reason}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-gray-400 dark:text-zinc-500">
            {new Date(entry.loggedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!entry.escalation && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded border border-gray-300 dark:border-zinc-600 text-gray-500 dark:text-zinc-400 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
            >
              Escalate ↑
            </button>
          )}
        </div>
      </div>

      {/* escalation badge */}
      {entry.escalation && (
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${ESCALATION_COLOR[entry.escalation.level]}`}>
            ↑ {ESCALATION_LABEL[entry.escalation.level]}
          </span>
          {entry.escalation.note && (
            <span className="text-[10px] text-gray-400 dark:text-zinc-500 truncate">
              "{entry.escalation.note}"
            </span>
          )}
        </div>
      )}

      {/* inline escalation picker */}
      {open && (
        <div className="flex flex-col gap-2 pt-1 border-t border-gray-200 dark:border-zinc-700">
          <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-medium uppercase tracking-wide">
            Escalate to
          </p>
          <div className="flex gap-1.5">
            {(["supervisor", "manager", "director"] as EscalationLevel[]).map((lvl) => (
              <button
                key={lvl}
                onClick={() => confirm(lvl)}
                className="flex-1 text-[10px] font-semibold py-1 rounded-md border border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 capitalize transition-colors"
              >
                {ESCALATION_LABEL[lvl]}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          <button
            onClick={() => setOpen(false)}
            className="text-[10px] text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 self-end"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function DowntimeLog({
  machineId,
  currentState,
  refreshKey = 0,
  periodHours,
}: {
  machineId: string;
  currentState: string;
  refreshKey?: number;
  periodHours?: number;
}) {
  const [entries, setEntries] = useState<DowntimeEntry[]>(() => load(machineId));

  useEffect(() => {
    setEntries(load(machineId));
  }, [machineId, refreshKey]);

  const log = (reason: string) => {
    const entry: DowntimeEntry = { reason, loggedAt: new Date().toISOString() };
    const updated = [entry, ...entries].slice(0, 20);
    setEntries(updated);
    save(machineId, updated);
  };

  const escalate = (index: number, escalation: Escalation) => {
    const updated = entries.map((e, i) => (i === index ? { ...e, escalation } : e));
    setEntries(updated);
    save(machineId, updated);
  };

  const isDown =
    currentState === "unplanned downtime" ||
    currentState === "planned downtime" ||
    currentState === "alarm";

  const visibleEntries = periodHours
    ? entries.filter((e) => {
        const cutoff = Date.now() - periodHours * 60 * 60 * 1000;
        return new Date(e.loggedAt).getTime() >= cutoff;
      })
    : entries;

  return (
    <div className="w-full flex flex-col gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
        Downtime Log
      </span>

      {isDown && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Machine is down — log reason:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DOWNTIME_REASONS.map((r) => (
              <button
                key={r}
                onClick={() => log(r)}
                className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      {visibleEntries.length > 0 ? (
        <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
          {visibleEntries.map((e, i) => (
            <EntryRow
              key={`${e.loggedAt}-${i}`}
              entry={e}
              onEscalate={(esc) => escalate(entries.indexOf(e), esc)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          {entries.length > 0 ? "No entries in selected period." : "No downtime entries recorded."}
        </p>
      )}
    </div>
  );
}
