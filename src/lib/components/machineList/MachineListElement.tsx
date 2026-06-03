import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Machine } from "./types";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";
import { useNotifications } from "@/context/NotificationContext";

type Props = Machine & {
  onStart?: () => void;
  onStop?: () => void;
  onMaintenance?: () => void;
  maintenanceSince?: number;
};

// ── Status config ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<Machine["currentState"], string> = {
  "on":             "Running",
  "idle":           "Idle",
  "in maintenance": "Maintenance",
};

// Fixed chart palette — independent of machine state
const CHART = {
  primary:   "#3b82f6", // blue-500  — utilization / donut / sparkbars
  idle:      "#94a3b8", // slate-400 — idle bar
};

type Colors = { badge: string; dot: string; stripClass: string; cardClass: string };

const STATE_COLORS: Record<Machine["currentState"], Colors> = {
  "on": {
    stripClass: "bg-green-500",
    badge: "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700",
    dot: "bg-green-500",
    cardClass: "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/15",
  },
  "idle": {
    stripClass: "bg-amber-400",
    badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-500 border border-amber-300 dark:border-amber-700",
    dot: "bg-amber-400",
    cardClass: "border-gray-300 dark:border-zinc-700 bg-gray-100/80 dark:bg-zinc-800/80 opacity-80",
  },
  "in maintenance": {
    stripClass: "bg-blue-500",
    badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-700",
    dot: "bg-blue-500",
    cardClass: "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10",
  },
};

// ── Donut ring ────────────────────────────────────────────────────────────────

function DonutRing({ pct, color }: { pct: number; color: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;
  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" stroke="#e5e7eb" className="dark:[stroke:#27272a]" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`} transform="rotate(-90 50 50)" />
      <text x="50" y="46" textAnchor="middle" fontSize="17" fontWeight="800" fill={color}>{pct}%</text>
      <text x="50" y="61" textAnchor="middle" fontSize="9" fill="#9ca3af">Utilization</text>
    </svg>
  );
}

// ── Spark bars ────────────────────────────────────────────────────────────────

function SparkBars({ machineId, color }: { machineId: string; color: string }) {
  const u = getMachineUtilization(machineId);
  const raw = [
    u.runtimePct - 8, u.runtimePct + 2, u.runtimePct - 4,
    u.runtimePct + 5, u.idlePct + 12,   u.runtimePct - 1,
    u.runtimePct + 2, u.runtimePct,     u.runtimePct - 3,
    u.runtimePct + 4, u.runtimePct - 2, u.runtimePct,
  ];
  const max = Math.max(...raw);
  return (
    <div className="flex items-end gap-[3px] h-7">
      {raw.map((h, i) => (
        <div key={i} className="w-[5px] rounded-sm" style={{
          height: `${Math.max(8, (h / max) * 100)}%`,
          backgroundColor: color,
          opacity: i === raw.length - 1 ? 1 : 0.45,
        }} />
      ))}
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-3 flex-1">
      <span className="text-base font-bold leading-none" style={{ color: color ?? "#111827" }}>{value}</span>
      <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Stat bar ──────────────────────────────────────────────────────────────────

function StatBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400 dark:text-zinc-500">{label}</span>
        <span className="font-semibold text-gray-800 dark:text-zinc-200">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function MachineListElement({
  name, _id, liveKw, maxPowerConsumption, currentState,
  onStart, onStop, onMaintenance, maintenanceSince,
}: Props) {
  const util   = getMachineUtilization(_id);
  const colors = STATE_COLORS[currentState] ?? STATE_COLORS["idle"];
  const { reports } = useNotifications();
  const openTickets = reports.filter((r) => r.machineId === _id && r.status !== "fixed");

  // Maintenance timer
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (currentState !== "in maintenance" || !maintenanceSince) { setElapsed(0); return; }
    setElapsed(Math.floor((Date.now() - maintenanceSince) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - maintenanceSince) / 1000)), 1000);
    return () => clearInterval(id);
  }, [currentState, maintenanceSince]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Power bar
  const powerPct = liveKw > 0 && maxPowerConsumption
    ? Math.min(100, (liveKw / maxPowerConsumption) * 100)
    : 0;
  const powerColor = powerPct >= 90 ? "#ef4444" : powerPct >= 70 ? "#f59e0b" : "#3b82f6";

  const btn = (label: string, onClick: () => void, cls: string) => (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={`flex-1 text-[11px] font-semibold py-1.5 rounded-lg border transition-colors ${cls}`}
    >
      {label}
    </button>
  );

  return (
    <Link to={`/app/machine?machineId=${_id}`} className="block group">
      <div className={`rounded-2xl border shadow-sm overflow-hidden group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-200 ${
        openTickets.length > 0
          ? "border-yellow-400 dark:border-yellow-600 bg-yellow-50/60 dark:bg-yellow-900/10"
          : colors.cardClass
      }`}>

        {/* top accent strip — state color */}
        <div className={`h-1.5 w-full ${openTickets.length > 0 ? "bg-amber-400" : colors.stripClass}`} />

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1 gap-2">
          <span className="font-bold text-base text-gray-900 dark:text-zinc-50 truncate leading-snug">{name}</span>
          <div className="flex items-center gap-1.5 shrink-0">
            {openTickets.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-500 border border-yellow-300 dark:border-yellow-700">
                🎫 {openTickets.length}
              </span>
            )}
            {currentState === "in maintenance" && maintenanceSince && (
              <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                ⏱ {fmt(elapsed)}
              </span>
            )}
            <span className={`flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${colors.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
              {STATE_LABEL[currentState]}
            </span>
          </div>
        </div>

        {/* donut + idle bar */}
        <div className="flex items-center gap-4 px-5 py-4">
          <DonutRing pct={util.runtimePct} color={CHART.primary} />
          <div className="flex-1 flex flex-col gap-2">
            <StatBar label="Idle" pct={util.idlePct} color={CHART.idle} />
          </div>
        </div>

        {/* 2-column stat row */}
        <div className="flex border-t border-gray-100 dark:border-zinc-800/60 divide-x divide-gray-100 dark:divide-zinc-800/60">
          <StatCell label="Utilization" value={`${util.runtimePct}%`} color={CHART.primary} />
          <StatCell label="Cycles"      value={String(util.cycles)}   color="#6b7280" />
        </div>

        {/* power footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-zinc-800/60"
          style={{ backgroundColor: `${CHART.primary}12` }}>
          <SparkBars machineId={_id} color={CHART.primary} />
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-400 dark:text-zinc-500">
              Live <span className="font-semibold text-gray-800 dark:text-zinc-100">{liveKw > 0 ? `${liveKw.toFixed(1)} kW` : "—"}</span>
            </span>
            {maxPowerConsumption && (
              <span className="text-gray-400 dark:text-zinc-500">
                Max <span className="font-semibold text-gray-800 dark:text-zinc-100">{maxPowerConsumption} kW</span>
              </span>
            )}
          </div>
        </div>

        {/* power consumption bar */}
        {maxPowerConsumption && maxPowerConsumption > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 dark:border-zinc-800/60">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-medium text-gray-500 dark:text-zinc-400">Power consumption</span>
              <span className="font-semibold tabular-nums" style={{ color: powerColor }}>
                {liveKw > 0 ? `${liveKw.toFixed(1)}` : "—"} / {maxPowerConsumption} kW
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${powerPct}%`, backgroundColor: powerColor }} />
            </div>
          </div>
        )}

        {/* action buttons */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-gray-100 dark:border-zinc-800/60">
          {currentState !== "on" && onStart &&
            btn("▶ Start", onStart, "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20")}
          {currentState === "on" && onStop &&
            btn("■ Stop", onStop, "border-gray-300 dark:border-zinc-600 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800")}
          {currentState !== "in maintenance" && onMaintenance &&
            btn("🔧 Maintenance", onMaintenance, "border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20")}
          {currentState === "in maintenance" && onStart &&
            btn("✓ Done", onStart, "border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20")}
        </div>
      </div>
    </Link>
  );
}
