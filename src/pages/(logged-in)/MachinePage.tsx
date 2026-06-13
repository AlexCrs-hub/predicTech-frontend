import { fetchMachineById } from "@/lib/api/machineApi";
import { useWebSocket } from "@/context/WebSocketContext";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Machine } from "@/lib/components/machineList/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import DowntimeLog from "@/lib/components/machine/DowntimeLog";
import MachineSensors from "@/lib/components/machine/MachineSensors";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";
import { downloadCsv } from "@/lib/utils/exportCsv";
import InteractiveTimeline from "@/lib/components/machine/InteractiveTimeline";
import {
  fetchUtilization, fetchCutting,
  fetchCycles, fetchDowntimeHours,
  fetchPlannedUnplanned,
  toPeriod,
} from "@/lib/api/metricsApi";
import {
  fetchDowntimeStats, DowntimeStats, DowntimeReason,
  REASON_LABEL, REASON_COLOR, ALL_REASONS,
} from "@/lib/api/downtimeRecordsApi";

const ENERGY_RATE = 0.15; // €/kWh

const COST_PERIODS = [
  { label: "7d",  days: 7  },
  { label: "30d", days: 30 },
] as const;
type CostPeriod = typeof COST_PERIODS[number];

type TimelineSegment = {
  label: "Running" | "Idle" | "Down" | "Setup";
  color: string;
  pct: number;
};

// shift starts 06:00, total 8 h = 480 min
const SHIFT_START_MIN = 6 * 60;
const SHIFT_DURATION_MIN = 480;

const TIMELINE: TimelineSegment[] = [
  { label: "Running", color: "#22c55e", pct: 62 },
  { label: "Idle", color: "#eab308", pct: 8 },
  { label: "Running", color: "#22c55e", pct: 4 },
  { label: "Down", color: "#ef4444", pct: 5 },
  { label: "Running", color: "#22c55e", pct: 15 },
  { label: "Setup", color: "#60a5fa", pct: 3 },
  { label: "Running", color: "#22c55e", pct: 3 },
];

// compute wall-clock start/end for each segment
function minsToHHMM(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const TIMELINE_WITH_TIMES = (() => {
  let cursor = 0;
  return TIMELINE.map((seg) => {
    const start = minsToHHMM(
      SHIFT_START_MIN + (cursor / 100) * SHIFT_DURATION_MIN,
    );
    cursor += seg.pct;
    const end = minsToHHMM(
      SHIFT_START_MIN + (cursor / 100) * SHIFT_DURATION_MIN,
    );
    return { ...seg, start, end };
  });
})();


const LEGEND_ITEMS = [
  { label: "Running", color: "#22c55e" },
  { label: "Idle", color: "#eab308" },
  { label: "Down", color: "#ef4444" },
  { label: "Setup", color: "#60a5fa" },
];

// ── shared primitives ─────────────────────────────────────────────────────────

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5 ${className}`}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4">
      {children}
    </p>
  );
}

function BigNumber({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <div className="flex items-end gap-1 leading-none">
      <span className="text-5xl font-extrabold text-gray-900 dark:text-zinc-50">
        {value}
      </span>
      {unit && (
        <span className="text-xl text-gray-400 dark:text-zinc-500 mb-0.5">
          {unit}
        </span>
      )}
    </div>
  );
}

// ── OEE gauge (pure SVG) ──────────────────────────────────────────────────────

function OeeGauge({ value }: { value: number }) {
  const pct = Math.min(99.9, Math.max(0.1, value ?? 0));
  const r = 68, cx = 100, cy = 88, sw = 14;

  const pt = (deg: number) => ({
    x: +(cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(2),
    y: +(cy - r * Math.sin((deg * Math.PI) / 180)).toFixed(2),
  });

  const left  = pt(180);
  const right = pt(0);
  const fill  = pt(180 - pct * 1.8);

  const bg   = `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${right.x} ${right.y}`;
  const arc  = `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${fill.x} ${fill.y}`;

  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-[200px] h-[108px]">
        <svg width="200" height="108" viewBox="0 0 200 108">
          <defs>
            <linearGradient id="oeeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor="#ef4444" />
              <stop offset="50%"  stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <path d={bg}  fill="none" stroke="#e5e7eb"        strokeWidth={sw} strokeLinecap="round" className="dark:[stroke:#27272a]" />
          <path d={arc} fill="none" stroke="url(#oeeGrad)"  strokeWidth={sw} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5 pointer-events-none">
          <span className="text-4xl font-extrabold text-gray-900 dark:text-zinc-50 leading-none">
            {value.toFixed(1)}
          </span>
          <span className="text-sm text-gray-400 dark:text-zinc-500 font-medium">%</span>
        </div>
      </div>
    </div>
  );
}

// ── downtime reason modal (timeline click) ────────────────────────────────────

function DowntimeModal({
  segment,
  onClose,
  onLogged,
}: {
  segment: { start: string; end: string };
  onClose: () => void;
  onLogged: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [custom, setCustom] = useState("");

  const reason = custom.trim() || selected;

  const submit = () => {
    if (!reason) return;
    onLogged();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-md mx-4 p-6 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-zinc-50">
            Log downtime reason
          </h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Down period:{" "}
            <span className="font-semibold text-red-500">
              {segment.start} – {segment.end}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ALL_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => { setSelected(r); setCustom(""); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                selected === r && !custom
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:border-blue-400"
              }`}
            >
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Or type custom reason
          </label>
          <input
            type="text"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value);
              setSelected("");
            }}
            placeholder="Describe the downtime cause…"
            className="text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!reason}
            onClick={submit}
            className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

const DT_PERIODS = [
  { label: "1 day",   hours: 24  },
  { label: "7 days",  hours: 168 },
  { label: "1 month", hours: 720 },
] as const;
type DtPeriod = typeof DT_PERIODS[number];

export default function MachinePage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [error, setError] = useState("");
  const [dtRefreshKey, setDtRefreshKey] = useState(0);
  const [dtPeriod, setDtPeriod] = useState<DtPeriod>(DT_PERIODS[0]);
  const [dtFilter, setDtFilter] = useState("");
  const [timelineModal, setTimelineModal] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const { machineStates, liveKw } = useWebSocket();
  const [costPeriod, setCostPeriod] = useState<CostPeriod>(COST_PERIODS[0]);
  const [metrics, setMetrics] = useState<{
    utilization: number | null;
    availability: number | null;
    cuttingHours: number | null;
    cuttingPct: number | null;
    cycles: number | null;
    downtimeHours: number | null;
    plannedHours: number | null;
    unplannedHours: number | null;
    plannedPct: number | null;
    unplannedPct: number | null;
  }>({
    utilization: null, availability: null, cuttingHours: null,
    cuttingPct: null, cycles: null, downtimeHours: null,
    plannedHours: null, unplannedHours: null,
    plannedPct: null, unplannedPct: null,
  });
  const [dtStats, setDtStats] = useState<DowntimeStats | null>(null);
  const { search } = useLocation();
  const machineId = new URLSearchParams(search).get("machineId") || "";

  const wsState = machineStates[machineId];
  const isRunning = wsState?.state?.toLowerCase() === "on";

  const livePower   = liveKw[machineId] || 0;
  const costPerHour = livePower * ENERGY_RATE;
  const costPerDay  = costPerHour * 24;

  const costTrend = (() => {
    const u = getMachineUtilization(machineId);
    const maxKw = machine?.maxPowerConsumption ?? 10;
    return Array.from({ length: costPeriod.days }, (_, i) => {
      const seed = (u.runtimePct + i * 3 + (machineId.charCodeAt(0) || 0)) % 20;
      const kwhDay = (u.runtimePct / 100) * maxKw * 24 * (0.85 + seed * 0.01);
      const today = new Date();
      today.setDate(today.getDate() - (costPeriod.days - 1 - i));
      return {
        date: today.toLocaleDateString([], { month: "short", day: "numeric" }),
        cost: +(kwhDay * ENERGY_RATE).toFixed(2),
      };
    });
  })();

  useEffect(() => {
    fetchMachineById(machineId).then((res) => {
      if (res.error) setError(res.error);
      else setMachine(res.machine || null);
    });
  }, [machineId]);

  useEffect(() => {
    if (!machineId) return;
    const p = toPeriod(dtPeriod.hours);
    Promise.allSettled([
      fetchUtilization(machineId, p),
      fetchCutting(machineId, p),
      fetchCycles(machineId, p),
      fetchDowntimeHours(machineId, p),
      fetchDowntimeStats(machineId, p),
      fetchPlannedUnplanned(machineId, p),
    ]).then(([util, cut, cyc, dth, dts, pu]) => {
      const downtimeHours = dth.status === "fulfilled" ? dth.value.downtimeHours : null;
      // availability derived from downtime (no dedicated backend endpoint)
      const availability  = downtimeHours !== null
        ? +Math.max(0, 100 - (downtimeHours / dtPeriod.hours) * 100).toFixed(1)
        : null;
      setMetrics({
        utilization:    util.status  === "fulfilled" ? util.value.utilizationPercentage   : null,
        availability,
        cuttingHours:   cut.status   === "fulfilled" ? cut.value.cuttingHours             : null,
        cuttingPct:     cut.status   === "fulfilled" ? cut.value.cuttingPercentage         : null,
        cycles:         cyc.status   === "fulfilled" ? cyc.value.cycles                   : null,
        downtimeHours,
        plannedHours:   pu.status    === "fulfilled" ? pu.value.plannedHours              : null,
        unplannedHours: pu.status    === "fulfilled" ? pu.value.unplannedHours            : null,
        plannedPct:     pu.status    === "fulfilled" ? pu.value.plannedPercentage         : null,
        unplannedPct:   pu.status    === "fulfilled" ? pu.value.unplannedPercentage       : null,
      });
      setDtStats(dts.status === "fulfilled" ? dts.value : null);
    });
  }, [machineId, dtPeriod.hours]);

  const oeeValue = metrics.availability != null && metrics.utilization != null
    ? +(metrics.availability * metrics.utilization / 100).toFixed(1)
    : null;

  const cycleTimeS = metrics.cuttingHours != null && metrics.cycles != null && metrics.cycles > 0
    ? +((metrics.cuttingHours * 3600) / metrics.cycles).toFixed(1)
    : null;

  const downtimeCauses = dtStats?.reasonCounts
    ? (Object.entries(dtStats.reasonCounts) as [DowntimeReason, number][])
        .filter(([, count]) => count > 0)
        .map(([reason, count]) => ({
          reason,
          count,
          pct: dtStats.total > 0 ? Math.round((count / dtStats.total) * 100) : 0,
        }))
        .sort((a, b) => b.count - a.count)
    : [];

  const handleExport = () => {
    const machineName = machine?.name ?? machineId;
    const date = new Date().toLocaleDateString();

    const rows: (string | number)[][] = [
      ["predicTech — Machine Export"],
      ["Machine", machineName],
      ["Date", date],
      [],
      ["KPI", "Value"],
      ["OEE (computed)",  oeeValue        !== null ? `${oeeValue}%`                        : "—"],
      ["Availability",    metrics.availability  != null ? `${metrics.availability.toFixed(1)}%`  : "—"],
      ["Utilization",     metrics.utilization   != null ? `${metrics.utilization.toFixed(1)}%`   : "—"],
      ["Cycles",          metrics.cycles        !== null ? metrics.cycles.toString()               : "—"],
      ["Cycle Time",      cycleTimeS            !== null ? `${cycleTimeS}s`                        : "—"],
      ["Downtime (h)",    metrics.downtimeHours != null ? metrics.downtimeHours.toFixed(2)        : "—"],
      [],
      ["DOWNTIME CAUSES"],
      ["Reason", "Events", "Share"],
      ...downtimeCauses.map(({ reason, count, pct }) => [REASON_LABEL[reason], count, `${pct}%`]),
    ];

    downloadCsv(
      `${machineName.replace(/\s+/g, "_")}_${date.replace(/\//g, "-")}.csv`,
      rows,
    );
  };

  return (
    <div className="w-full flex flex-col gap-0 pb-10 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      {error && (
        <div className="text-red-500 dark:text-red-400 px-5 py-2 text-sm">
          {error}
        </div>
      )}

      {/* header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-blue-400 border-b border-gray-800">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? "bg-green-400" : "bg-zinc-500"}`}
        />
        <h1 className="text-base font-bold tracking-tight text-white flex-1">
          {machine ? (
            machine.name
          ) : (
            <span className="text-zinc-500 animate-pulse">Loading…</span>
          )}
        </h1>
        <button
          onClick={handleExport}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-colors font-medium"
        >
          ↓ Export CSV
        </button>
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${isRunning ? "bg-green-500" : "bg-zinc-700"}`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-green-200" : "bg-zinc-500"}`}
          />
          <span className="text-white">
            {isRunning ? "Running" : "Offline"}
          </span>
        </span>
        <span className="text-xs text-white/60 ml-1">
          Morning Shift · 06:00–
        </span>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 p-5">
        {/* left column */}
        <div className="flex flex-col gap-4">
          <Card>
            <Label>Overall OEE</Label>
            <OeeGauge value={oeeValue ?? 0} />
            <div className="flex justify-between mt-5">
              {[
                { label: "Availability", value: metrics.availability },
                { label: "Utilization",  value: metrics.utilization  },
                { label: "Cutting",      value: metrics.cuttingPct   },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center flex-1 text-center"
                >
                  <span className="text-sm font-bold text-green-600 dark:text-green-500">
                    {value != null ? `${(value as number).toFixed(1)}%` : "—"}
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <Label>Cycles</Label>
            <BigNumber value={metrics.cycles ?? "—"} unit="cycles" />
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-right mt-2">
              in {dtPeriod.label}
            </p>
          </Card>

          <Card>
            <Label>Cycle Time</Label>
            <BigNumber value={cycleTimeS ?? "—"} unit={cycleTimeS !== null ? "s" : undefined} />
            <p className="text-xs text-gray-400 dark:text-zinc-500 font-medium mt-2">
              {metrics.cuttingHours != null
                ? `${metrics.cuttingHours.toFixed(1)} h cutting · ${metrics.cycles ?? "—"} cycles`
                : "No data for period"}
            </p>
          </Card>

          <Card>
            <div className="flex items-center justify-between mb-4">
              <Label>Energy Cost</Label>
              <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
                {COST_PERIODS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setCostPeriod(p)}
                    className={`px-2.5 py-0.5 text-[10px] transition-colors ${
                      costPeriod.label === p.label
                        ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                        : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[
                { label: "Live Power", value: livePower > 0 ? `${livePower.toFixed(1)} kW` : "— kW", color: "text-blue-600 dark:text-blue-400" },
                { label: "Cost / h",   value: costPerHour > 0 ? `€${costPerHour.toFixed(2)}` : "€—",  color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Daily est.", value: costPerDay > 0  ? `€${costPerDay.toFixed(0)}`  : "€—",  color: "text-emerald-600 dark:text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex flex-col items-center rounded-lg bg-gray-50 dark:bg-zinc-800/60 py-2.5 px-1">
                  <span className={`text-sm font-extrabold leading-none ${color}`}>{value}</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 uppercase tracking-wide text-center">{label}</span>
                </div>
              ))}
            </div>

            {/* trend sparkline */}
            <ResponsiveContainer width="100%" height={90}>
              <LineChart data={costTrend} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
                <Tooltip
                  formatter={(v: number) => [`€${v.toFixed(2)}`, "Cost"]}
                  contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb" }}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={costPeriod.days <= 7}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 text-right mt-1">
              Total {costPeriod.label}: €{costTrend.reduce((s, d) => s + d.cost, 0).toFixed(2)}
            </p>
          </Card>
        </div>

        {/* right column */}
        <div className="flex flex-col gap-4">
          {/* production timeline */}
          <Card>
            <Label>Production Timeline</Label>
            <div className="flex h-7 rounded-lg overflow-hidden gap-px">
              {TIMELINE_WITH_TIMES.map((seg, i) => (
                <div
                  key={i}
                  style={{
                    flexBasis: `${seg.pct}%`,
                    backgroundColor: seg.color,
                  }}
                  title={
                    seg.label === "Down"
                      ? `${seg.label} ${seg.start}–${seg.end} — click to log reason`
                      : `${seg.label}: ${seg.start}–${seg.end}`
                  }
                  onClick={
                    seg.label === "Down"
                      ? () =>
                          setTimelineModal({ start: seg.start, end: seg.end })
                      : undefined
                  }
                  className={
                    seg.label === "Down"
                      ? "cursor-pointer hover:brightness-110 transition-all relative group"
                      : undefined
                  }
                />
              ))}
            </div>

            {/* hint below bar */}
            <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1.5">
              Red (Down) segments are clickable — log reason for past downtime.
            </p>

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-4">
                {LEGEND_ITEMS.map(({ label, color }) => (
                  <span
                    key={label}
                    className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </span>
                ))}
              </div>
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                06:00 – now
              </span>
            </div>
          </Card>

          {/* top downtime causes */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <Label>Top Downtime Causes</Label>
              <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
                {DT_PERIODS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setDtPeriod(p)}
                    className={`px-2.5 py-0.5 text-[10px] transition-colors ${
                      dtPeriod.label === p.label
                        ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                        : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <input
              type="text"
              value={dtFilter}
              onChange={(e) => setDtFilter(e.target.value)}
              placeholder="Filter causes…"
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-2.5 py-1.5 mb-3 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-3">
              {downtimeCauses.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-zinc-500">
                  No downtime data for this period.
                </p>
              ) : (
                downtimeCauses
                  .filter((c) => REASON_LABEL[c.reason].toLowerCase().includes(dtFilter.toLowerCase()))
                  .map(({ reason, count, pct }) => (
                    <div key={reason} className="flex items-center gap-3">
                      <span className="w-28 text-sm text-gray-600 dark:text-zinc-400 shrink-0">
                        {REASON_LABEL[reason]}
                      </span>
                      <div className="flex-1 h-4 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: REASON_COLOR[reason] }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 w-16 text-right shrink-0 tabular-nums">
                        {count} events
                      </span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 w-8 text-right shrink-0 tabular-nums">
                        {pct}%
                      </span>
                    </div>
                  ))
              )}
            </div>
          </Card>

          <MachineSensors
            machineId={machineId}
            machineName={machine?.name ?? ""}
          />

          <Card>
            <DowntimeLog
              machineId={machineId}
              refreshKey={dtRefreshKey}
              periodHours={dtPeriod.hours}
            />
          </Card>
        </div>
      </div>

      {/* historical timeline – full width */}
      <div className="px-5 pb-2">
        <InteractiveTimeline machineId={machineId} />
      </div>

      {/* timeline modal */}
      {timelineModal && (
        <DowntimeModal
          segment={timelineModal}
          onClose={() => setTimelineModal(null)}
          onLogged={() => setDtRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
}
