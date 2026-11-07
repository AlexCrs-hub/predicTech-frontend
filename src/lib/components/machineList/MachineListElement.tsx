import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Play, Square, Ticket } from "lucide-react";
import { Machine } from "./types";
import { useNotifications } from "@/context/NotificationContext";
import ReportDowntimeButton from "@/lib/components/machine/ReportDowntimeButton";

type Props = Machine & {
  onStart?: () => Promise<boolean>;
  onStop?: () => Promise<boolean>;
  maintenanceSince?: number;
  intervalActive?: boolean;
  utilizationPct?: number;
  realCycles?: number;
  downtimeCount?: number;
  onDowntimeReported?: () => void;
};

type LogState = "idle" | "loading" | "ok" | "error";

const STATE_LABEL: Record<Machine["currentState"], string> = {
  "on":             "Running",
  "idle":           "Idle",
  "in maintenance": "Maintenance",
};

const STATE_BADGE: Record<Machine["currentState"], { badge: string; dot: string }> = {
  "on": {
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
    dot: "bg-emerald-500",
  },
  "idle": {
    badge: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
    dot: "bg-amber-500",
  },
  "in maintenance": {
    badge: "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-blue-500/20",
    dot: "bg-blue-500",
  },
};

// ── Utilization ring — shows "—" when no data ────────────────────────────────

function UtilizationRing({ pct }: { pct: number | null }) {
  const r    = 30;
  const circ = 2 * Math.PI * r;
  const filled = pct != null ? (Math.min(pct, 100) / 100) * circ : 0;
  return (
    <div className="relative w-[76px] h-[76px] shrink-0">
      <svg width="76" height="76" viewBox="0 0 76 76" className="-rotate-90">
        <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        {pct != null && (
          <circle cx="38" cy="38" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
            className="stroke-primary" strokeDasharray={`${filled} ${circ - filled}`} />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-semibold tabular-nums text-foreground">
        {pct != null ? `${pct}%` : "—"}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function MachineListElement({
  name, _id, liveKw, maxPowerConsumption, currentState,
  onStart, onStop, maintenanceSince, intervalActive,
  utilizationPct, realCycles, downtimeCount = 0, onDowntimeReported,
}: Props) {
  const runtimePct = utilizationPct != null ? Math.round(utilizationPct) : null;
  const idlePct    = utilizationPct != null ? Math.max(0, Math.round(100 - utilizationPct)) : null;
  const state      = STATE_BADGE[currentState] ?? STATE_BADGE["idle"];
  const { reports } = useNotifications();
  const openTickets = reports.filter((r) => r.machineId === _id && r.status !== "fixed");

  const [logState, setLogState] = useState<LogState>("idle");

  const handleLog = async (fn: () => Promise<boolean>) => {
    setLogState("loading");
    const ok = await fn().catch(() => false);
    setLogState(ok ? "ok" : "error");
    setTimeout(() => setLogState("idle"), 2000);
  };

  // Maintenance timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (currentState !== "in maintenance" || !maintenanceSince) { setElapsed(0); return; }
    setElapsed(Math.floor((Date.now() - maintenanceSince) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - maintenanceSince) / 1000)), 1000);
    return () => clearInterval(id);
  }, [currentState, maintenanceSince]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const powerPct = liveKw > 0 && maxPowerConsumption
    ? Math.min(100, (liveKw / maxPowerConsumption) * 100)
    : 0;
  const powerBar = powerPct >= 90 ? "bg-red-500" : powerPct >= 70 ? "bg-amber-500" : "bg-primary";

  const logButton = (label: React.ReactNode, onClick: () => Promise<boolean>) => {
    const isLoading = logState === "loading";
    const content = logState === "ok" ? "✓ Logged"
      : logState === "error" ? "✗ Failed"
      : isLoading ? "…"
      : label;
    const tone = logState === "ok"
      ? "text-emerald-700 dark:text-emerald-400 border-emerald-500/40"
      : logState === "error"
      ? "text-destructive border-destructive/40"
      : "text-foreground border-input hover:bg-accent";
    return (
      <button
        type="button"
        disabled={isLoading}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleLog(onClick); }}
        className={`flex-1 inline-flex items-center justify-center gap-1.5 h-8 px-2 rounded-lg border bg-background text-xs font-medium shadow-sm transition-colors disabled:opacity-50 ${tone}`}
      >
        {content}
      </button>
    );
  };

  return (
    <Link to={`/app/machine?machineId=${_id}`} className="block group focus-visible:outline-none">
      <div className="h-full rounded-xl border bg-card text-card-foreground shadow-sm transition-all duration-200 group-hover:shadow-md group-hover:border-foreground/15 group-focus-visible:ring-2 group-focus-visible:ring-ring flex flex-col">

        {/* header */}
        <div className="flex items-start justify-between gap-2 px-5 pt-4">
          <div className="min-w-0">
            <p className="font-semibold text-base text-foreground truncate leading-tight">{name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {maxPowerConsumption ? `Max ${maxPowerConsumption} kW` : "No power rating"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {openTickets.length > 0 && (
              <span
                title={`${openTickets.length} open ticket${openTickets.length !== 1 ? "s" : ""}`}
                className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-inset ring-amber-500/20"
              >
                <Ticket className="size-3" />
                {openTickets.length}
              </span>
            )}
            {currentState === "in maintenance" && maintenanceSince && (
              <span className="text-[11px] font-mono font-medium text-blue-600 dark:text-blue-400 tabular-nums">
                {fmt(elapsed)}
              </span>
            )}
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md ring-1 ring-inset whitespace-nowrap ${state.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${state.dot}`} />
              {STATE_LABEL[currentState]}
            </span>
          </div>
        </div>

        {/* utilization + stats */}
        <div className="flex items-center gap-5 px-5 py-4">
          <UtilizationRing pct={runtimePct} />
          <div className="flex-1 flex flex-col gap-1.5 min-w-0">
            <Stat label="Utilization" value={runtimePct != null ? `${runtimePct}%` : "—"} />
            <Stat label="Idle" value={idlePct != null ? `${idlePct}%` : "—"} />
            <Stat label="Cycles" value={realCycles != null ? String(realCycles) : "—"} />
          </div>
        </div>

        {/* live power */}
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Live power</span>
            <span className="font-medium tabular-nums text-foreground">
              {liveKw > 0 ? `${liveKw.toFixed(1)} kW` : "—"}
              {maxPowerConsumption ? <span className="text-muted-foreground"> / {maxPowerConsumption} kW</span> : null}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${powerBar}`} style={{ width: `${powerPct}%` }} />
          </div>
        </div>

        {/* work interval logging + downtime reporting */}
        <div className="mt-auto flex items-center gap-2 px-4 py-3 border-t">
          {currentState !== "in maintenance" && !intervalActive && onStart &&
            logButton(<><Play className="size-3.5" /> Log start</>, onStart)}
          {currentState !== "in maintenance" && intervalActive && onStop &&
            logButton(<><Square className="size-3.5" /> Log stop</>, onStop)}
          <ReportDowntimeButton
            machineId={_id}
            machineName={name}
            count={downtimeCount}
            onReported={onDowntimeReported}
          />
        </div>
      </div>
    </Link>
  );
}
