import { fetchMachineById } from "@/lib/api/machineApi";
import { useWebSocket } from "@/context/WebSocketContext";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Machine } from "@/lib/components/machineList/types";
import {
  ResponsiveContainer,
  ComposedChart,
  LineChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import DowntimeLog from "@/lib/components/machine/DowntimeLog";
import MachineSensors from "@/lib/components/machine/MachineSensors";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { fetchReadingWindow, fetchPowerTimeseries } from "@/lib/api/readingWindowApi";
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

// ── time helpers ──────────────────────────────────────────────────────────────

const TZ = "Asia/Riyadh";
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });

type LivePoint = { t: string; kw: number };

// ── power sensor ID hook ──────────────────────────────────────────────────────

function usePowerSensorId(machineId: string): string | null {
  const [sensorId, setSensorId] = useState<string | null>(null);
  useEffect(() => {
    if (!machineId) return;
    setSensorId(null);
    fetchSensorsByMachine(machineId)
      .then((sensors: any) => {
        const ps = (Array.isArray(sensors) ? sensors : []).find((s: any) => {
          const name = String(s.normalizedName || s.name || "").toLowerCase();
          return s.role === "power" || name.includes("power") || name === "kw";
        });
        if (ps) setSensorId(ps._id);
      })
      .catch(() => {});
  }, [machineId]);
  return sensorId;
}

// ── Chart 1: Interactive (pan/zoom + live) ────────────────────────────────────

const WINDOW_PRESETS = [
  { label: "5m",  secs: 300   },
  { label: "15m", secs: 900   },
  { label: "1h",  secs: 3600  },
  { label: "6h",  secs: 21600 },
] as const;
type WindowPreset = typeof WINDOW_PRESETS[number];

function InteractivePowerChart({
  machineId,
  sensorId,
}: {
  machineId: string;
  sensorId: string | null;
}) {
  const { readings } = useWebSocket();
  const [preset, setPreset]       = useState<WindowPreset>(WINDOW_PRESETS[0]);
  const [mode, setMode]           = useState<"live" | "hist">("live");
  const [histToMs, setHistToMs]   = useState(0);
  const [points, setPoints]       = useState<LivePoint[]>([]);
  const [loading, setLoading]     = useState(false);
  const bufferRef                 = useRef<LivePoint[]>([]);

  const load = useCallback(async (fromMs: number, toMs: number) => {
    if (!sensorId) return;
    setLoading(true);
    try {
      const data = await fetchReadingWindow({
        sensorId,
        from:  new Date(fromMs).toISOString(),
        to:    new Date(toMs).toISOString(),
        limit: 2000,
        order: "asc",
      });
      const pts: LivePoint[] = data.points.map((p) => ({ t: fmtTime(new Date(p.t)), kw: p.v }));
      bufferRef.current = pts;
      setPoints(pts);
    } catch { /* keep empty */ }
    finally { setLoading(false); }
  }, [sensorId]);

  // Reload when sensor, preset, mode, or historical anchor changes
  useEffect(() => {
    if (!sensorId) return;
    if (mode === "live") {
      const to = Date.now();
      load(to - preset.secs * 1000, to);
    } else if (histToMs > 0) {
      load(histToMs - preset.secs * 1000, histToMs);
    }
  }, [sensorId, preset, mode, histToMs, load]);

  // Append SSE readings when in live mode
  useEffect(() => {
    if (mode !== "live" || !readings) return;
    try {
      const parsed = JSON.parse(readings);
      const kwR = (parsed.readings || []).find((r: any) => {
        if (r.machineId !== machineId) return false;
        const name = String(r.sensorName || r.normalizedName || "").toLowerCase();
        return name.includes("power") || name === "kw";
      });
      if (!kwR) return;
      const ts    = parsed.measuredAt ? new Date(parsed.measuredAt) : new Date();
      const point: LivePoint = { t: fmtTime(ts), kw: Number(kwR.value) };
      const buf   = bufferRef.current;
      const next  = buf.length >= preset.secs ? [...buf.slice(1), point] : [...buf, point];
      bufferRef.current = next;
      setPoints([...next]);
    } catch {}
  }, [readings, machineId, mode, preset]);

  const panLeft = () => {
    const currentTo = mode === "live" ? Date.now() : histToMs;
    setMode("hist");
    setHistToMs(currentTo - preset.secs * 1000);
  };
  const panRight = () => {
    const newTo = histToMs + preset.secs * 1000;
    if (newTo >= Date.now() - 10_000) setMode("live");
    else setHistToMs(newTo);
  };

  const latest = mode === "live" ? (points[points.length - 1]?.kw ?? null) : null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {latest !== null && (
          <div className="flex items-baseline gap-1 mr-2">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 tabular-nums leading-none">
              {latest.toFixed(2)}
            </span>
            <span className="text-sm text-gray-400 dark:text-zinc-500">kW</span>
          </div>
        )}

        {/* window presets */}
        <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
          {WINDOW_PRESETS.map((p) => (
            <button key={p.label} onClick={() => setPreset(p)}
              className={`px-2.5 py-1 text-[10px] transition-colors ${
                preset.label === p.label
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}>{p.label}</button>
          ))}
        </div>

        {/* pan */}
        <button onClick={panLeft}
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 text-base flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors">
          ‹
        </button>
        <button onClick={panRight} disabled={mode === "live"}
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 text-base flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors">
          ›
        </button>

        {/* live indicator */}
        {mode === "live" ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        ) : (
          <button onClick={() => setMode("live")}
            className="px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700 text-[10px] text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            Go Live
          </button>
        )}

        {loading && <span className="text-[10px] text-gray-400 dark:text-zinc-500 animate-pulse ml-1">Loading…</span>}
      </div>

      {points.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-zinc-500 italic">
          {loading ? "Loading…" : "No data for this window"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#27272a]" />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9ca3af" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={42} unit=" kW" domain={["auto", "auto"]} />
            <Tooltip formatter={(v: number) => [`${v.toFixed(2)} kW`, "Power"]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Line type="monotone" dataKey="kw" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Chart 2: Historical avg + min/max band ────────────────────────────────────

const HIST_PERIODS = [
  { label: "24h", hours: 24,  gran: "minute" as const },
  { label: "7d",  hours: 168, gran: "hour"   as const },
  { label: "30d", hours: 720, gran: "day"    as const },
];
type HistPeriod = typeof HIST_PERIODS[number];

type BandPoint = { t: string; avg: number; low: number; band: number };

function BandTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const find = (key: string) => payload.find((p: any) => p.dataKey === key)?.value as number | undefined;
  const avg = find("avg"), low = find("low"), band = find("band");
  const max = low != null && band != null ? +(low + band).toFixed(2) : null;
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
      <p className="text-gray-400 dark:text-zinc-500 mb-1">{label}</p>
      {avg != null && <p><span className="font-semibold text-blue-600 dark:text-blue-400">Avg </span>{avg.toFixed(2)} kW</p>}
      {low != null && <p><span className="text-gray-400 dark:text-zinc-500">Min </span>{low.toFixed(2)} kW</p>}
      {max != null && <p><span className="text-gray-400 dark:text-zinc-500">Max </span>{max} kW</p>}
    </div>
  );
}

function autoGranularity(fromMs: number, toMs: number): "minute" | "hour" | "day" {
  const diffH = (toMs - fromMs) / 3_600_000;
  if (diffH <= 48)  return "minute";
  if (diffH <= 336) return "hour";
  return "day";
}

function HistoricalPowerChart({ machineId }: { machineId: string }) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekAgoStr = new Date(Date.now() - 7 * 24 * 3_600_000).toISOString().slice(0, 10);

  const [mode, setMode]               = useState<"preset" | "custom">("preset");
  const [period, setPeriod]           = useState<HistPeriod>(HIST_PERIODS[1]);
  const [customFrom, setCustomFrom]   = useState(weekAgoStr);
  const [customTo, setCustomTo]       = useState(todayStr);
  const [applied, setApplied]         = useState<{ from: string; to: string } | null>(null);
  const [chartData, setChartData]     = useState<BandPoint[]>([]);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    if (!machineId) return;
    if (mode === "custom" && !applied) return;

    setLoading(true);

    let fromMs: number, toMs: number, gran: "minute" | "hour" | "day";

    if (mode === "preset") {
      toMs   = Date.now();
      fromMs = toMs - period.hours * 3_600_000;
      gran   = period.gran;
    } else {
      fromMs = new Date(applied!.from + "T00:00:00").getTime();
      toMs   = new Date(applied!.to   + "T23:59:59").getTime();
      gran   = autoGranularity(fromMs, toMs);
    }

    const fmtOpts: Intl.DateTimeFormatOptions = gran === "day"
      ? { month: "short", day: "numeric", timeZone: TZ }
      : { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ };

    fetchPowerTimeseries({
      machineId,
      from: new Date(fromMs).toISOString(),
      to:   new Date(toMs).toISOString(),
      granularity: gran,
    })
      .then((data) => {
        setChartData(data.points.map((p) => ({
          t:    new Date(p.t).toLocaleString("en-GB", fmtOpts),
          avg:  p.avgPowerKw,
          low:  p.minPowerKw,
          band: +(p.maxPowerKw - p.minPowerKw).toFixed(3),
        })));
      })
      .catch(() => setChartData([]))
      .finally(() => setLoading(false));
  }, [machineId, mode, period, applied]);

  const handleApply = () => {
    if (customFrom && customTo && customFrom <= customTo)
      setApplied({ from: customFrom, to: customTo });
  };

  const emptyMsg = loading ? "Loading…"
    : mode === "custom" && !applied ? "Select a date range and click Apply"
    : "No data for this period";

  return (
    <div>
      <div className="flex flex-col gap-2 mb-3">
        {/* top row: presets + custom toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
            {HIST_PERIODS.map((p) => (
              <button key={p.label}
                onClick={() => { setPeriod(p); setMode("preset"); }}
                className={`px-2.5 py-1 text-[10px] transition-colors ${
                  mode === "preset" && period.label === p.label
                    ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                    : "text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                }`}>{p.label}</button>
            ))}
          </div>

          <button
            onClick={() => setMode(mode === "custom" ? "preset" : "custom")}
            className={`px-2.5 py-1 text-[10px] rounded-md border transition-colors ${
              mode === "custom"
                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-semibold"
                : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
            }`}>
            Custom
          </button>

          {loading && <span className="text-[10px] text-gray-400 dark:text-zinc-500 animate-pulse">Loading…</span>}
        </div>

        {/* custom date pickers */}
        {mode === "custom" && (
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="date"
              value={customFrom}
              max={customTo || todayStr}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">–</span>
            <input
              type="date"
              value={customTo}
              min={customFrom}
              max={todayStr}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-xs rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-800 dark:text-zinc-200 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleApply}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="px-3 py-1 text-[10px] rounded-md bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-zinc-500 italic">
          {emptyMsg}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#27272a]" />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9ca3af" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={42} unit=" kW" domain={["auto", "auto"]} />
            <Tooltip content={<BandTooltip />} />
            <Area type="monotone" dataKey="low"  stroke="none" fill="none"    stackId="b" legendType="none" isAnimationActive={false} />
            <Area type="monotone" dataKey="band" stroke="none" fill="#3b82f6" fillOpacity={0.12} stackId="b" legendType="none" isAnimationActive={false} />
            <Line type="monotone" dataKey="avg"  stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
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
  const powerSensorId = usePowerSensorId(machineId);
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

          {/* interactive power chart — pan/zoom + live SSE */}
          <Card>
            <Label>Power — Live / Interactive</Label>
            <InteractivePowerChart machineId={machineId} sensorId={powerSensorId} />
          </Card>

          {/* historical power chart — avg + min/max band */}
          <Card>
            <Label>Power — Historical</Label>
            <HistoricalPowerChart machineId={machineId} />
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
