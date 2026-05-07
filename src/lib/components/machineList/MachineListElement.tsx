import { Link } from "react-router-dom";
import { Machine } from "./types";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";

type Props = Machine & { sensorValue?: number; sensorThreshold?: number; sensorLabel?: string };

// ── Status config ─────────────────────────────────────────────────────────────

const STATE_LABEL: Record<Machine["currentState"], string> = {
  normal:               "Running",
  alarm:                "Alarm",
  "unplanned downtime": "Unplanned DT",
  "planned downtime":   "Planned DT",
};

type Colors = { ring: string; accent: string; badge: string; dot: string; stripClass: string };

const STATE_COLORS: Record<Machine["currentState"], Colors> = {
  normal: {
    ring: "#22c55e", accent: "#22c55e",
    stripClass: "bg-green-500",
    badge: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800",
    dot: "bg-green-500",
  },
  alarm: {
    ring: "#ef4444", accent: "#ef4444",
    stripClass: "bg-red-500",
    badge: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800",
    dot: "bg-red-500",
  },
  "unplanned downtime": {
    ring: "#f97316", accent: "#f97316",
    stripClass: "bg-orange-500",
    badge: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
  },
  "planned downtime": {
    ring: "#9ca3af", accent: "#9ca3af",
    stripClass: "bg-gray-400",
    badge: "bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-400 border border-gray-200 dark:border-zinc-600",
    dot: "bg-gray-400",
  },
};

// ── Donut ring ────────────────────────────────────────────────────────────────

function DonutRing({ pct, color }: { pct: number; color: string }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const filled = (Math.min(pct, 100) / 100) * circ;

  return (
    <svg width="100" height="100" viewBox="0 0 100 100">
      {/* track */}
      <circle cx="50" cy="50" r={r} fill="none" strokeWidth="9" stroke="#e5e7eb" className="dark:[stroke:#27272a]" />
      {/* fill */}
      <circle
        cx="50" cy="50" r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform="rotate(-90 50 50)"
      />
      {/* label */}
      <text x="50" y="46" textAnchor="middle" fontSize="17" fontWeight="800" fill={color}>{pct}%</text>
      <text x="50" y="61" textAnchor="middle" fontSize="9" fill="#9ca3af">Utilization</text>
    </svg>
  );
}

// ── Spark bars ────────────────────────────────────────────────────────────────

function SparkBars({ machineId, color }: { machineId: string; color: string }) {
  const u = getMachineUtilization(machineId);
  const raw = [
    u.runtimePct - 8, u.cuttingPct + 5, u.runtimePct + 2,
    u.cuttingPct + 1, u.idlePct + 12,   u.runtimePct - 4,
    u.cuttingPct - 2, u.runtimePct + 5, u.cuttingPct + 3,
    u.runtimePct - 1, u.cuttingPct + 2, u.runtimePct,
  ];
  const max = Math.max(...raw);
  return (
    <div className="flex items-end gap-[3px] h-7">
      {raw.map((h, i) => (
        <div
          key={i}
          className="w-[5px] rounded-sm"
          style={{
            height: `${Math.max(8, (h / max) * 100)}%`,
            backgroundColor: color,
            opacity: i === raw.length - 1 ? 1 : 0.5,
          }}
        />
      ))}
    </div>
  );
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-3 flex-1">
      <span className="text-base font-bold text-gray-900 dark:text-zinc-50 leading-none">{value}</span>
      <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-wide">{label}</span>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function MachineListElement({
  name, _id, liveKw, maxPowerConsumption,
  currentState,
  sensorValue, sensorThreshold, sensorLabel,
}: Props) {
  const util = getMachineUtilization(_id);
  const colors = STATE_COLORS[currentState] ?? STATE_COLORS["planned downtime"];
  const breach = sensorValue !== undefined && sensorThreshold !== undefined && sensorValue < sensorThreshold;

  return (
    <Link to={`/app/machine?machineId=${_id}`} className="block group">
      <div className="rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden group-hover:shadow-lg group-hover:-translate-y-1 transition-all duration-200">

        {/* top accent strip */}
        <div className={`h-[3px] w-full ${colors.stripClass}`} />

        {/* header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1 gap-3">
          <span className="font-bold text-base text-gray-900 dark:text-zinc-50 truncate leading-snug">
            {name}
          </span>
          <span className={`shrink-0 flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${colors.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
            {STATE_LABEL[currentState]}
          </span>
        </div>

        {/* donut + stats row */}
        <div className="flex items-center gap-4 px-5 py-4">
          <DonutRing pct={util.runtimePct} color={colors.ring} />
          <div className="flex-1 flex flex-col gap-2">
            <StatBar label="Cutting" pct={util.cuttingPct} color={colors.ring} />
            <StatBar label="Idle"    pct={util.idlePct}    color="#9ca3af" />
          </div>
        </div>

        {/* 3-column numbers */}
        <div className="flex border-t border-gray-100 dark:border-zinc-800 divide-x divide-gray-100 dark:divide-zinc-800">
          <StatCell label="Utilization" value={`${util.runtimePct}%`} />
          <StatCell label="Cutting"     value={`${util.cuttingPct}%`} />
          <StatCell label="Cycles"      value={String(util.cycles)}   />
        </div>

        {/* power footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/50">
          <SparkBars machineId={_id} color={colors.ring} />
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-400 dark:text-zinc-500">
              Live{" "}
              <span className="font-semibold text-gray-800 dark:text-zinc-100">
                {liveKw > 0 ? `${liveKw.toFixed(1)} kW` : "—"}
              </span>
            </span>
            {maxPowerConsumption && (
              <span className="text-gray-400 dark:text-zinc-500">
                Max{" "}
                <span className="font-semibold text-gray-800 dark:text-zinc-100">
                  {maxPowerConsumption} kW
                </span>
              </span>
            )}
          </div>
        </div>

        {/* sensor bar */}
        {sensorValue !== undefined && sensorThreshold !== undefined && (
          <div className={`px-5 py-3 border-t ${breach ? "border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40" : "border-gray-100 dark:border-zinc-800"}`}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className={`font-medium ${breach ? "text-red-600 dark:text-red-400" : "text-gray-500 dark:text-zinc-400"}`}>
                {sensorLabel ?? "Sensor"}{breach ? " ⚠ breach" : ""}
              </span>
              <span className={`font-semibold tabular-nums ${breach ? "text-red-600 dark:text-red-400" : "text-gray-600 dark:text-zinc-400"}`}>
                {sensorValue.toFixed(1)} / {sensorThreshold}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-zinc-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${breach ? "bg-red-500" : "bg-blue-400"}`}
                style={{ width: `${Math.min(100, (sensorValue / 100) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}

// ── inline stat bar ───────────────────────────────────────────────────────────

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
