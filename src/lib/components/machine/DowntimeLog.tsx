import { useState, useEffect } from "react";
import { DOWNTIME_REASONS } from "@/lib/utils/machineSimulation";
import { Button } from "@/lib/components/ui/button";

type DowntimeEntry = {
  reason: string;
  loggedAt: string;
};

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

export default function DowntimeLog({
  machineId,
  currentState,
}: {
  machineId: string;
  currentState: string;
}) {
  const [entries, setEntries] = useState<DowntimeEntry[]>(() => load(machineId));

  useEffect(() => {
    setEntries(load(machineId));
  }, [machineId]);

  const log = (reason: string) => {
    const entry: DowntimeEntry = { reason, loggedAt: new Date().toISOString() };
    const updated = [entry, ...entries].slice(0, 20);
    setEntries(updated);
    save(machineId, updated);
  };

  const isIdle =
    currentState === "unplanned downtime" ||
    currentState === "planned downtime" ||
    currentState === "alarm";

  return (
    <div className="w-full flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Downtime log
      </span>

      {isIdle && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Machine is down — select reason:</p>
          <div className="flex flex-wrap gap-2">
            {DOWNTIME_REASONS.map((r) => (
              <Button
                key={r}
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => log(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
      )}

      {entries.length > 0 ? (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto">
          {entries.map((e, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted"
            >
              <span>{e.reason}</span>
              <span className="text-muted-foreground shrink-0 ml-3">
                {new Date(e.loggedAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No downtime entries recorded.</p>
      )}
    </div>
  );
}
