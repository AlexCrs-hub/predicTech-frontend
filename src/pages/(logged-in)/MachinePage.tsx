import { fetchMachineById } from "@/lib/api/machineApi";
import { useWebSocket } from "@/context/WebSocketContext";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Machine } from "@/lib/components/machineList/types";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import DowntimeLog from "@/lib/components/machine/DowntimeLog";
import MachineSensors from "@/lib/components/machine/MachineSensors";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { fetchReadingsForSensor } from "@/lib/api/readingApi";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";
import { downloadCsv } from "@/lib/utils/exportCsv";
import _InteractiveTimeline from "@/lib/components/machine/InteractiveTimeline";
import { toPeriod, fetchMetricSummary } from "@/lib/api/metricsApi";

import {
  fetchDowntimeStats, DowntimeStats, DowntimeReason,
  REASON_LABEL, REASON_COLOR, ALL_REASONS,
} from "@/lib/api/downtimeRecordsApi";

// ── constants (kept for future use) ──────────────────────────────────────────

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

// Hardcoded timeline — kept for future real-data integration
const TIMELINE: TimelineSegment[] = [
  { label: "Running", color: "#22c55e", pct: 62 },
  { label: "Idle",    color: "#eab308", pct: 8  },
  { label: "Running", color: "#22c55e", pct: 4  },
  { label: "Down",    color: "#ef4444", pct: 5  },
  { label: "Running", color: "#22c55e", pct: 15 },
  { label: "Setup",   color: "#60a5fa", pct: 3  },
  { label: "Running", color: "#22c55e", pct: 3  },
];

function minsToHHMM(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = Math.floor(total % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// @ts-ignore — kept for future use when Production Timeline uses real data
const _TIMELINE_WITH_TIMES = (() => {
  let cursor = 0;
  return TIMELINE.map((seg) => {
    const start = minsToHHMM(SHIFT_START_MIN + (cursor / 100) * SHIFT_DURATION_MIN);
    cursor += seg.pct;
    const end   = minsToHHMM(SHIFT_START_MIN + (cursor / 100) * SHIFT_DURATION_MIN);
    return { ...seg, start, end };
  });
})();

// @ts-ignore — kept for future use
const _LEGEND_ITEMS = [
  { label: "Running", color: "#22c55e" },
  { label: "Idle",    color: "#eab308" },
  { label: "Down",    color: "#ef4444" },
  { label: "Setup",   color: "#60a5fa" },
];

// ── shared primitives ─────────────────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5 ${className}`}>
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

// @ts-ignore — kept for future use
function BigNumber({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <div className="flex items-end gap-1 leading-none">
      <span className="text-5xl font-extrabold text-gray-900 dark:text-zinc-50">{value}</span>
      {unit && <span className="text-xl text-gray-400 dark:text-zinc-500 mb-0.5">{unit}</span>}
    </div>
  );
}

// ── CuttingGauge — kept for future use when cuttingPct endpoint is wired ─────
// @ts-ignore
function CuttingGauge({ value }: { value: number }) {
  const pct = Math.min(99.9, Math.max(0.1, value ?? 0));
  const r = 68, cx = 100, cy = 88, sw = 14;
  const pt = (deg: number) => ({
    x: +(cx + r * Math.cos((deg * Math.PI) / 180)).toFixed(2),
    y: +(cy - r * Math.sin((deg * Math.PI) / 180)).toFixed(2),
  });
  const left = pt(180), right = pt(0), fill = pt(180 - pct * 1.8);
  const bg  = `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${right.x} ${right.y}`;
  const arc = `M ${left.x} ${left.y} A ${r} ${r} 0 0 1 ${fill.x} ${fill.y}`;
  return (
    <div className="flex flex-col items-center w-full">
      <div className="relative w-[200px] h-[108px]">
        <svg width="200" height="108" viewBox="0 0 200 108">
          <path d={bg}  fill="none" stroke="#e5e7eb" strokeWidth={sw} strokeLinecap="round" className="dark:[stroke:#27272a]" />
          <path d={arc} fill="none" stroke="#3b82f6" strokeWidth={sw} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-0.5 pointer-events-none">
          <span className="text-4xl font-extrabold text-gray-900 dark:text-zinc-50 leading-none">{value.toFixed(1)}</span>
          <span className="text-sm text-gray-400 dark:text-zinc-500 font-medium">%</span>
        </div>
      </div>
    </div>
  );
}

// ── DowntimeModal — kept for future use when Production Timeline is real ──────
function DowntimeModal({
  segment, onClose, onLogged,
}: {
  segment: { start: string; end: string };
  onClose: () => void;
  onLogged: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [custom, setCustom]     = useState("");
  const reason = custom.trim() || selected;
  const submit = () => { if (!reason) return; onLogged(); onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-700 w-full max-w-md mx-4 p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-zinc-50">Log downtime reason</h2>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1">
            Down period: <span className="font-semibold text-red-500">{segment.start} – {segment.end}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ALL_REASONS.map((r) => (
            <button key={r} onClick={() => { setSelected(r); setCustom(""); }}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                selected === r && !custom
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                  : "border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:border-blue-400"
              }`}>
              {REASON_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Or type custom reason</label>
          <input type="text" value={custom} onChange={(e) => { setCustom(e.target.value); setSelected(""); }}
            placeholder="Describe the downtime cause…"
            className="text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-3 py-2 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">Cancel</button>
          <button disabled={!reason} onClick={submit} className="text-sm px-4 py-2 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Live power rolling-window hook ────────────────────────────────────────────

const DEFAULT_LIVE_WINDOW = 300;
const MIN_WINDOW = 100;
const MAX_WINDOW = 3000;
const WINDOW_STEP = 100;
type LivePoint = { t: string; kw: number };

function useLivePowerBuffer(machineId: string, windowSize: number): LivePoint[] {
  const { readings } = useWebSocket();
  const bufferRef = useRef<LivePoint[]>([]);
  const [points, setPoints] = useState<LivePoint[]>([]);

  // Re-fetch history whenever machineId or windowSize changes
  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;

    bufferRef.current = [];
    setPoints([]);

    (async () => {
      try {
        const sensors = await fetchSensorsByMachine(machineId);
        const powerSensor = (sensors as any[]).find((s) => {
          const name = String(s.normalizedName || s.name || "").toLowerCase();
          return s.role === "power" || name.includes("power") || name === "kw";
        });
        if (!powerSensor || cancelled) return;

        const allReadings = await fetchReadingsForSensor(powerSensor._id);
        if (cancelled) return;

        const cutoff = Date.now() - windowSize * 1000;
        const historical: LivePoint[] = (allReadings as any[])
          .filter((r) => new Date(r.measuredAt).getTime() >= cutoff)
          .slice(-windowSize)
          .map((r) => ({
            t: new Date(r.measuredAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
            kw: Number(r.measurement),
          }));

        bufferRef.current = historical;
        setPoints(historical);
      } catch { /* start empty if fetch fails */ }
    })();

    return () => { cancelled = true; };
  }, [machineId, windowSize]);

  // Append live readings from WebSocket
  useEffect(() => {
    if (!readings) return;
    try {
      const parsed = JSON.parse(readings);
      const kwReading = (parsed.readings || []).find((r: any) => {
        if (r.machineId !== machineId) return false;
        const name = String(r.sensorName || r.normalizedName || "").toLowerCase();
        return name.includes("power") || name === "kw";
      });
      if (!kwReading) return;

      const point: LivePoint = {
        t: new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        kw: Number(kwReading.value),
      };

      const buf = bufferRef.current;
      const next = buf.length >= windowSize
        ? [...buf.slice(buf.length - windowSize + 1), point]
        : [...buf, point];
      bufferRef.current = next;
      setPoints(next);
    } catch { /* ignore malformed */ }
  }, [readings, machineId, windowSize]);

  return points;
}

// ── Live Power Chart ──────────────────────────────────────────────────────────

function LivePowerChart({ machineId }: { machineId: string }) {
  const [windowSize, setWindowSize] = useState(DEFAULT_LIVE_WINDOW);
  const [inputStr, setInputStr]     = useState(String(DEFAULT_LIVE_WINDOW));
  const points = useLivePowerBuffer(machineId, windowSize);

  const applyWindow = (val: number) => {
    const clamped = Math.max(MIN_WINDOW, Math.min(MAX_WINDOW, Math.round(val / WINDOW_STEP) * WINDOW_STEP));
    setWindowSize(clamped);
    setInputStr(String(clamped));
  };

  const handleInputBlur = () => {
    const num = parseInt(inputStr, 10);
    applyWindow(isNaN(num) ? windowSize : num);
  };

  const latest = points[points.length - 1]?.kw ?? null;

  return (
    <div>
      {/* top row: current value + window controls */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 leading-none tabular-nums">
            {latest !== null ? latest.toFixed(2) : "—"}
          </span>
          <span className="text-sm text-gray-400 dark:text-zinc-500">kW</span>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide mr-1">Window</span>
          <button
            onClick={() => applyWindow(windowSize - WINDOW_STEP)}
            disabled={windowSize <= MIN_WINDOW}
            className="w-7 h-7 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >−</button>
          <input
            type="number"
            value={inputStr}
            onChange={(e) => setInputStr(e.target.value)}
            onBlur={handleInputBlur}
            onKeyDown={(e) => e.key === "Enter" && handleInputBlur()}
            className="w-16 text-center text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 tabular-nums"
          />
          <button
            onClick={() => applyWindow(windowSize + WINDOW_STEP)}
            disabled={windowSize >= MAX_WINDOW}
            className="w-7 h-7 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 text-sm font-bold hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors"
          >+</button>
          <span className="text-[10px] text-gray-400 dark:text-zinc-500">s</span>
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 ml-2 tabular-nums">{points.length}/{windowSize}</span>
        </div>
      </div>

      {points.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-zinc-500 italic">
          Waiting for live data…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#27272a]" />
            <XAxis
              dataKey="t"
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              interval="preserveStartEnd"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              width={42}
              unit=" kW"
            />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(2)} kW`, "Power"]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Line
              type="monotone"
              dataKey="kw"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
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
  const [machine, setMachine]       = useState<Machine | null>(null);
  const [error, setError]           = useState("");
  const [dtRefreshKey, setDtRefreshKey] = useState(0);
  const [dtPeriod, setDtPeriod]     = useState<DtPeriod>(DT_PERIODS[0]);
  const [dtFilter, setDtFilter]     = useState("");
  const [timelineModal, setTimelineModal] = useState<{ start: string; end: string } | null>(null);
  const { machineStates, liveKw }   = useWebSocket();
  // @ts-ignore — setCostPeriod kept for future cost sparkline
  const [costPeriod, setCostPeriod] = useState<CostPeriod>(COST_PERIODS[0]);
  const [metrics, setMetrics]       = useState<{
    utilization:    number | null;
    availability:   number | null;
    cuttingHours:   number | null;
    cuttingPct:     number | null;
    cycles:         number | null;
    downtimeHours:  number | null;
    plannedHours:   number | null;
    unplannedHours: number | null;
    plannedPct:     number | null;
    unplannedPct:   number | null;
  }>({
    utilization: null, availability: null, cuttingHours: null,
    cuttingPct: null, cycles: null, downtimeHours: null,
    plannedHours: null, unplannedHours: null,
    plannedPct: null, unplannedPct: null,
  });
  const [dtStats, setDtStats] = useState<DowntimeStats | null>(null);

  const { search }  = useLocation();
  const machineId   = new URLSearchParams(search).get("machineId") || "";
  const wsState     = machineStates[machineId];
  const isRunning   = wsState?.state?.toLowerCase() === "on";
  const livePower   = liveKw[machineId] ?? 0;
  const costPerHour = livePower * ENERGY_RATE;
  const costPerDay  = costPerHour * 24;

  // Kept for future use — cost sparkline (currently simulated, not rendered)
  // @ts-ignore
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

  // Fetch machine details
  useEffect(() => {
    if (!machineId) return;
    fetchMachineById(machineId)
      .then(setMachine)
      .catch(() => setError("Failed to load machine details."));
  }, [machineId]);

  // Fetch metrics + downtime stats
  useEffect(() => {
    if (!machineId) return;
    const p = toPeriod(dtPeriod.hours);

    Promise.allSettled([
      fetchMetricSummary(machineId, p),
      fetchDowntimeStats(machineId, p),
    ]).then(([summary, dts]) => {
      const s = summary.status === "fulfilled" ? summary.value : null;
      setMetrics({
        utilization:    s?.utilizationPercentage ?? null,
        availability:   s ? +Math.max(0, 100 - (s.downtimeHours / dtPeriod.hours) * 100).toFixed(1) : null,
        cuttingHours:   null,
        cuttingPct:     null,
        cycles:         s?.cycles ?? null,
        downtimeHours:  s?.downtimeHours ?? null,
        plannedHours:   null,
        unplannedHours: null,
        plannedPct:     null,
        unplannedPct:   null,
      });
      setDtStats(dts.status === "fulfilled" ? dts.value : null);
    });
  }, [machineId, dtPeriod.hours]);

  // Kept for future use — cycle time (requires cuttingHours endpoint)
  // @ts-ignore
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
      ["Utilization",   metrics.utilization  != null ? `${metrics.utilization.toFixed(1)}%`  : "—"],
      ["Availability",  metrics.availability != null ? `${metrics.availability.toFixed(1)}%` : "—"],
      ["Cycles",        metrics.cycles       != null ? metrics.cycles.toString()              : "—"],
      ["Downtime (h)",  metrics.downtimeHours != null ? metrics.downtimeHours.toFixed(2)      : "—"],
      [],
      ["DOWNTIME CAUSES"],
      ["Reason", "Events", "Share"],
      ...downtimeCauses.map(({ reason, count, pct }) => [REASON_LABEL[reason], count, `${pct}%`]),
    ];
    downloadCsv(`${machineName.replace(/\s+/g, "_")}_${date.replace(/\//g, "-")}.csv`, rows);
  };

  return (
    <div className="w-full flex flex-col gap-0 pb-10 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      {error && (
        <div className="text-red-500 dark:text-red-400 px-5 py-2 text-sm">{error}</div>
      )}

      {/* header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-blue-400 border-b border-gray-800">
        <span className={`w-2 h-2 rounded-full shrink-0 ${isRunning ? "bg-green-400" : "bg-zinc-500"}`} />
        <h1 className="text-base font-bold tracking-tight text-white flex-1">
          {machine ? machine.name : <span className="text-white/50 animate-pulse">Loading…</span>}
        </h1>
        <button onClick={handleExport}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/30 transition-colors font-medium">
          ↓ Export CSV
        </button>
        <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${isRunning ? "bg-green-500" : "bg-zinc-700"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-green-200" : "bg-zinc-500"}`} />
          <span className="text-white">{isRunning ? "Running" : "Offline"}</span>
        </span>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-4 p-5">

        {/* left column — real metrics from API */}
        <div className="flex flex-col gap-4">

          {/* period selector + metric KPIs */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <Label>Machine Stats</Label>
              <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
                {DT_PERIODS.map((p) => (
                  <button key={p.label} onClick={() => setDtPeriod(p)}
                    className={`px-2.5 py-0.5 text-[10px] transition-colors ${
                      dtPeriod.label === p.label
                        ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                        : "bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Utilization",   value: metrics.utilization  != null ? `${metrics.utilization.toFixed(1)}%`  : "—" },
                { label: "Availability",  value: metrics.availability != null ? `${metrics.availability.toFixed(1)}%` : "—" },
                { label: "Cycles",        value: metrics.cycles       != null ? metrics.cycles.toString()              : "—" },
                { label: "Downtime",      value: metrics.downtimeHours != null ? `${metrics.downtimeHours.toFixed(1)}h` : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="flex flex-col rounded-lg bg-gray-50 dark:bg-zinc-800/60 py-3 px-3 gap-1">
                  <span className="text-lg font-extrabold text-gray-900 dark:text-zinc-50 leading-none tabular-nums">{value}</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* live power stats — from WebSocket */}
          <Card>
            <Label>Live Power</Label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { label: "Current Power", value: livePower > 0 ? `${livePower.toFixed(2)} kW` : "— kW",          color: "text-blue-600 dark:text-blue-400" },
                { label: "Cost / h",      value: costPerHour > 0 ? `€${costPerHour.toFixed(2)}`  : "€—",          color: "text-emerald-600 dark:text-emerald-400" },
                { label: "Daily est.",    value: costPerDay  > 0 ? `€${costPerDay.toFixed(0)}`   : "€—",          color: "text-emerald-600 dark:text-emerald-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between rounded-lg bg-gray-50 dark:bg-zinc-800/60 py-2.5 px-3">
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 uppercase tracking-wide">{label}</span>
                  <span className={`text-sm font-extrabold leading-none ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/*
            ── KEPT FOR FUTURE USE (not rendered — data not yet wired) ─────────

            <Card>
              <Label>Productive Cutting Time</Label>
              <CuttingGauge value={metrics.cuttingPct ?? 0} />
            </Card>

            <Card>
              <Label>Cycle Time</Label>
              <BigNumber value={cycleTimeS ?? "—"} unit={cycleTimeS !== null ? "s" : undefined} />
            </Card>

            <Card>  (Energy cost sparkline — costTrend uses getMachineUtilization simulation)
              <ResponsiveContainer width="100%" height={90}>
                <LineChart data={costTrend} ...>...</LineChart>
              </ResponsiveContainer>
            </Card>
          */}
        </div>

        {/* right column */}
        <div className="flex flex-col gap-4">

          {/* live power chart — 300-sample rolling window from WebSocket */}
          <Card>
            <Label>Live Power — real-time</Label>
            <LivePowerChart machineId={machineId} />
          </Card>

          {/*
            ── KEPT FOR FUTURE USE (not rendered — hardcoded data) ─────────────

            Production Timeline:
            <Card>
              <Label>Production Timeline</Label>
              {TIMELINE_WITH_TIMES.map(...)}
            </Card>

            InteractiveTimeline (PRNG-simulated data):
            <InteractiveTimeline machineId={machineId} />
          */}

          {/* top downtime causes — from fetchDowntimeStats */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <Label>Top Downtime Causes</Label>
            </div>
            <input type="text" value={dtFilter} onChange={(e) => setDtFilter(e.target.value)}
              placeholder="Filter causes…"
              className="w-full text-xs rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 px-2.5 py-1.5 mb-3 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <div className="flex flex-col gap-3">
              {downtimeCauses.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-zinc-500">No downtime data for this period.</p>
              ) : (
                downtimeCauses
                  .filter((c) => REASON_LABEL[c.reason].toLowerCase().includes(dtFilter.toLowerCase()))
                  .map(({ reason, count, pct }) => (
                    <div key={reason} className="flex items-center gap-3">
                      <span className="w-28 text-sm text-gray-600 dark:text-zinc-400 shrink-0">{REASON_LABEL[reason]}</span>
                      <div className="flex-1 h-4 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${pct}%`, backgroundColor: REASON_COLOR[reason] }} />
                      </div>
                      <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 w-16 text-right shrink-0 tabular-nums">{count} events</span>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 w-8 text-right shrink-0 tabular-nums">{pct}%</span>
                    </div>
                  ))
              )}
            </div>
          </Card>

          {/* sensor history charts — from fetchSensorsByMachine + fetchReadingsForSensor */}
          <MachineSensors machineId={machineId} machineName={machine?.name ?? ""} />

          {/* downtime log — from fetchUnresolvedDowntime */}
          <Card>
            <DowntimeLog machineId={machineId} refreshKey={dtRefreshKey} periodHours={dtPeriod.hours} />
          </Card>
        </div>
      </div>

      {/* DowntimeModal — kept for future use when Production Timeline uses real data */}
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
