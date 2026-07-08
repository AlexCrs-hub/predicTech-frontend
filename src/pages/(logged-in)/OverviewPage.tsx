import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "@/context/NotificationContext";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Machine } from "@/lib/components/machineList/types";
import { useWebSocket } from "@/context/WebSocketContext";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import {
  fetchReadingWindow, fetchPowerTimeseries,
  WindowPoint, TimeseriesPoint,
} from "@/lib/api/readingWindowApi";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
  PieChart, Pie, Cell,
} from "recharts";

const ENERGY_RATE = 0.18; // SAR/kWh
const TZ = "Asia/Riyadh";
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });

const WINDOW_PRESETS = [
  { label: "5m",  secs: 300   },
  { label: "15m", secs: 900   },
  { label: "1h",  secs: 3600  },
  { label: "6h",  secs: 21600 },
] as const;
type WindowPreset = typeof WINDOW_PRESETS[number];

type LivePoint = { t: string; v: number };

const RANGE_OPTS = [
  { label: "1h",  hours: 1    },
  { label: "24h", hours: 24   },
  { label: "7d",  hours: 168  },
  { label: "30d", hours: 720  },
  { label: "1y",  hours: 8760 },
] as const;
type RangeOpt = typeof RANGE_OPTS[number];

const PIE_PERIODS = [
  { label: "24h", hours: 24  },
  { label: "7d",  hours: 168 },
  { label: "30d", hours: 720 },
] as const;
type PiePeriod = typeof PIE_PERIODS[number];

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#84cc16",
];

const EST_PERIODS = [
  { label: "1h",  mult: 1   },
  { label: "1d",  mult: 24  },
  { label: "1w",  mult: 168 },
  { label: "1mo", mult: 720 },
] as const;
type EstPeriod = typeof EST_PERIODS[number];

const AVG_PERIODS = [
  { label: "1h",  divH: 1   },
  { label: "1d",  divH: 24  },
  { label: "1w",  divH: 168 },
  { label: "1mo", divH: 720 },
] as const;
type AvgPeriod = typeof AVG_PERIODS[number];


function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
      {children}
    </h2>
  );
}

function KpiTile({
  label, value, sub, accent,
}: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
        {label}
      </span>
      <span className={`text-2xl font-extrabold leading-none ${accent ?? "text-gray-900 dark:text-zinc-50"}`}>
        {value}
      </span>
      {sub && <span className="text-xs text-gray-400 dark:text-zinc-500">{sub}</span>}
    </div>
  );
}

// ── Fetch power sensor ID for each machine ────────────────────────────────────
function useAllPowerSensorIds(machines: Machine[]): Map<string, string> {
  const [sensorMap, setSensorMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (machines.length === 0) return;
    Promise.all(
      machines.map((m) =>
        fetchSensorsByMachine(m._id)
          .then((sensors: unknown) => {
            const list = Array.isArray(sensors) ? sensors : [];
            const ps = list.find((s: any) => {
              const name = String(s.normalizedName || s.name || "").toLowerCase();
              return s.role === "power" || name.includes("power") || name === "kw";
            });
            return ps ? ([m._id, ps._id] as [string, string]) : null;
          })
          .catch(() => null)
      )
    ).then((results) => {
      const map = new Map<string, string>();
      for (const r of results) if (r) map.set(r[0], r[1]);
      setSensorMap(map);
    });
  }, [machines.length]);
  return sensorMap;
}

// ── Unified interactive chart — power (kW) or cost (SAR/h) ───────────────────
// Identical UX to InteractivePowerChart in machine details.
// mode="cost" multiplies every kW value by ENERGY_RATE to show SAR/h.
function OverviewInteractiveChart({
  machines,
  sensorMap,
  mode,
}: {
  machines: Machine[];
  sensorMap: Map<string, string>;
  mode: "power" | "cost";
}) {
  const { readings } = useWebSocket();
  const [machineFilter, setMachineFilter] = useState("all");
  const [preset, setPreset]         = useState<WindowPreset>(WINDOW_PRESETS[0]);
  const [viewMode, setViewMode]     = useState<"live" | "hist">("live");
  const [histToMs, setHistToMs]     = useState(0);
  const [points, setPoints]         = useState<LivePoint[]>([]);
  const [loading, setLoading]       = useState(false);
  const bufferRef                   = useRef<LivePoint[]>([]);
  const latestKwRef                 = useRef<Map<string, number>>(new Map());

  const unit        = mode === "cost" ? "SAR/h" : "kW";
  const lineColor   = mode === "cost" ? "#10b981" : "#3b82f6";
  const tooltipLabel = mode === "cost" ? "Cost" : "Power";
  const valueAccent = mode === "cost"
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-blue-600 dark:text-blue-400";
  const decimals    = mode === "cost" ? 4 : 2;
  const toV         = (kw: number) => +(kw * (mode === "cost" ? ENERGY_RATE : 1)).toFixed(decimals);

  const load = useCallback(async (fromMs: number, toMs: number) => {
    setLoading(true);
    try {
      let pts: LivePoint[];
      if (machineFilter === "all") {
        const sensorIds = Array.from(sensorMap.values());
        if (sensorIds.length === 0) return;
        const results = await Promise.all(
          sensorIds.map((sid) =>
            fetchReadingWindow({
              sensorId: sid,
              from: new Date(fromMs).toISOString(),
              to: new Date(toMs).toISOString(),
              limit: 2000,
              order: "asc",
            }).catch((): { points: WindowPoint[] } => ({ points: [] }))
          )
        );
        const bySecond = new Map<number, number>();
        for (const res of results) {
          for (const p of res.points) {
            const bucket = Math.round(p.t / 1000) * 1000;
            bySecond.set(bucket, (bySecond.get(bucket) ?? 0) + p.v);
          }
        }
        pts = Array.from(bySecond.entries())
          .sort(([a], [b]) => a - b)
          .map(([t, kw]) => ({ t: fmtTime(new Date(t)), v: toV(kw) }));
      } else {
        const sensorId = sensorMap.get(machineFilter);
        if (!sensorId) return;
        const data = await fetchReadingWindow({
          sensorId,
          from: new Date(fromMs).toISOString(),
          to: new Date(toMs).toISOString(),
          limit: 2000,
          order: "asc",
        });
        pts = data.points.map((p) => ({ t: fmtTime(new Date(p.t)), v: toV(p.v) }));
      }
      bufferRef.current = pts;
      setPoints(pts);
    } catch { /* keep empty */ }
    finally { setLoading(false); }
  }, [machineFilter, sensorMap, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sensorMap.size === 0) return;
    if (viewMode === "live") {
      const to = Date.now();
      load(to - preset.secs * 1000, to);
    } else if (histToMs > 0) {
      load(histToMs - preset.secs * 1000, histToMs);
    }
  }, [sensorMap.size, preset, viewMode, histToMs, load]);

  useEffect(() => {
    if (viewMode !== "live" || !readings) return;
    try {
      const parsed = JSON.parse(readings);
      const powerReadings = (parsed.readings || []).filter((r: any) => {
        const name = String(r.sensorName || r.normalizedName || "").toLowerCase();
        return name.includes("power") || name === "kw";
      });
      if (powerReadings.length === 0) return;

      for (const r of powerReadings) {
        if (r.machineId) latestKwRef.current.set(r.machineId, Number(r.value));
      }

      let totalKw: number;
      if (machineFilter === "all") {
        totalKw = Array.from(latestKwRef.current.values()).reduce((s, v) => s + v, 0);
      } else {
        if (!latestKwRef.current.has(machineFilter)) return;
        totalKw = latestKwRef.current.get(machineFilter)!;
      }

      const ts = parsed.measuredAt ? new Date(parsed.measuredAt) : new Date();
      const point: LivePoint = { t: fmtTime(ts), v: toV(totalKw) };
      const buf  = bufferRef.current;
      const next = buf.length >= preset.secs ? [...buf.slice(1), point] : [...buf, point];
      bufferRef.current = next;
      setPoints([...next]);
    } catch {}
  }, [readings, machineFilter, viewMode, preset, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const panLeft = () => {
    const currentTo = viewMode === "live" ? Date.now() : histToMs;
    setViewMode("hist");
    setHistToMs(currentTo - preset.secs * 1000);
  };
  const panRight = () => {
    const newTo = histToMs + preset.secs * 1000;
    if (newTo >= Date.now() - 10_000) setViewMode("live");
    else setHistToMs(newTo);
  };
  const goLive = () => {
    bufferRef.current = [];
    latestKwRef.current = new Map();
    setPoints([]);
    setViewMode("live");
  };

  const latest = viewMode === "live" ? (points[points.length - 1]?.v ?? null) : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {/* machine selector */}
        <select
          className="text-sm border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={machineFilter}
          onChange={(e) => { setMachineFilter(e.target.value); goLive(); }}
        >
          <option value="all">All machines</option>
          {machines.map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>

        {latest !== null && (
          <div className="flex items-baseline gap-1 mr-2">
            <span className={`text-2xl font-extrabold tabular-nums leading-none ${valueAccent}`}>
              {latest.toFixed(decimals)}
            </span>
            <span className="text-sm text-gray-400 dark:text-zinc-500">{unit}</span>
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
        <button onClick={panRight} disabled={viewMode === "live"}
          className="w-7 h-7 rounded-md border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 text-base flex items-center justify-center hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-30 transition-colors">
          ›
        </button>

        {/* live indicator */}
        {viewMode === "live" ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-[10px] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live
          </span>
        ) : (
          <button onClick={goLive}
            className="px-2.5 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700 text-[10px] text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
            Go Live
          </button>
        )}

        {loading && (
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 animate-pulse ml-1">Loading…</span>
        )}
      </div>

      {points.length === 0 ? (
        <div className="flex items-center justify-center h-[220px] text-sm text-gray-400 dark:text-zinc-500 italic">
          {loading ? "Loading…" : sensorMap.size === 0 ? "Loading sensors…" : "No data for this window"}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:[stroke:#27272a]" />
            <XAxis dataKey="t" tick={{ fontSize: 9, fill: "#9ca3af" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={56} unit={` ${unit}`} domain={["auto", "auto"]} />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(decimals)} ${unit}`, tooltipLabel]}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
            />
            <Line type="monotone" dataKey="v" stroke={lineColor} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Per-machine cost breakdown hook (for pie chart) ──────────────────────────
function useMachineCostBreakdown(
  machines: Machine[],
  hours: number,
): { data: { id: string; name: string; sar: number }[]; loading: boolean } {
  const [data, setData] = useState<{ id: string; name: string; sar: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (machines.length === 0) return;
    const gran: "hour" | "day" = hours <= 720 ? "hour" : "day";
    const to   = new Date();
    const from = new Date(to.getTime() - hours * 3_600_000);
    const durH = gran === "day" ? 24 : 1;

    setLoading(true);
    Promise.allSettled(
      machines.map((m) =>
        fetchPowerTimeseries({
          machineId: m._id,
          from: from.toISOString(),
          to: to.toISOString(),
          granularity: gran,
        }).then((res): { id: string; name: string; sar: number } => ({
          id: m._id,
          name: m.name,
          sar: +res.points
            .reduce((s, p) => s + p.avgPowerKw * durH * ENERGY_RATE, 0)
            .toFixed(2),
        }))
      )
    ).then((results) => {
      setData(
        results
          .filter((r): r is PromiseFulfilledResult<{ id: string; name: string; sar: number }> =>
            r.status === "fulfilled" && r.value.sar > 0
          )
          .map((r) => r.value)
          .sort((a, b) => b.sar - a.sar)
      );
    }).finally(() => setLoading(false));
  }, [machines.length, hours]);

  return { data, loading };
}

// ── Machine cost pie chart ────────────────────────────────────────────────────
function MachineCostPie({ machines }: { machines: Machine[] }) {
  const [period, setPeriod] = useState<PiePeriod>(PIE_PERIODS[1]);
  const { data, loading } = useMachineCostBreakdown(machines, period.hours);
  const total = data.reduce((s, d) => s + d.sar, 0);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          Cost by machine
        </span>
        <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
          {PIE_PERIODS.map((p) => (
            <button key={p.label} onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-[10px] transition-colors ${
                period.label === p.label
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 animate-pulse text-center py-10">Loading…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-10">No cost data for this period.</p>
      ) : (
        <div className="flex flex-row items-center gap-4">
          {/* donut pie */}
          <div className="shrink-0 w-[200px]">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  paddingAngle={2}
                  dataKey="sar"
                  nameKey="name"
                >
                  {data.map((_d, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`SAR ${v.toFixed(2)}`, "Cost"]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* legend */}
          <div className="flex-1 min-w-0 flex flex-col gap-2.5">
            {data.map((d, i) => (
              <div key={d.id} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-sm text-gray-700 dark:text-zinc-300 truncate">{d.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 tabular-nums">
                  <span className="text-xs text-gray-400 dark:text-zinc-500 w-8 text-right">
                    {total > 0 ? `${Math.round((d.sar / total) * 100)}%` : "—"}
                  </span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    SAR {d.sar.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-1 pt-2.5 border-t border-gray-100 dark:border-zinc-800 flex justify-between items-center">
              <span className="text-xs text-gray-400 dark:text-zinc-500">Total ({period.label})</span>
              <span className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                SAR {total.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Aggregate energy period hook (SAR + kWh for KPI tiles) ───────────────────
function useAggregatePeriod(
  machines: Machine[],
  windowHours: number,
): { totalSAR: number; totalKwh: number; loading: boolean } {
  const [totalSAR, setTotalSAR] = useState(0);
  const [totalKwh, setTotalKwh] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (machines.length === 0) return;
    const gran: "hour" | "day" = windowHours <= 720 ? "hour" : "day";
    const to   = new Date();
    const from = new Date(to.getTime() - windowHours * 3_600_000);
    const durH = gran === "day" ? 24 : 1;

    setLoading(true);
    Promise.all(
      machines.map((m) =>
        fetchPowerTimeseries({
          machineId: m._id,
          from: from.toISOString(),
          to: to.toISOString(),
          granularity: gran,
        }).catch((): { points: TimeseriesPoint[] } => ({ points: [] }))
      )
    )
      .then((results) => {
        let sar = 0;
        let kwh = 0;
        for (const res of results)
          for (const p of res.points) {
            kwh += p.avgPowerKw * durH;
            sar += p.avgPowerKw * durH * ENERGY_RATE;
          }
        setTotalSAR(+sar.toFixed(2));
        setTotalKwh(+kwh.toFixed(2));
      })
      .finally(() => setLoading(false));
  }, [machines.length, windowHours]);

  return { totalSAR, totalKwh, loading };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineStatus, setMachineStatus] = useState<"loading" | "ok" | "auth" | "empty" | "error">("loading");
  const [rangeOpt, setRangeOpt] = useState<RangeOpt>(RANGE_OPTS[2]);
  const [estPeriod, setEstPeriod] = useState<EstPeriod>(EST_PERIODS[0]);
  const [avgPeriod, setAvgPeriod] = useState<AvgPeriod>(AVG_PERIODS[0]);
  const { reports } = useNotifications();
  const { liveKw, machineStates } = useWebSocket();

  useEffect(() => {
    fetchAllMachines()
      .then((res) => {
        if (res?.message === "You need to Login") { setMachineStatus("auth"); return; }
        const list = Array.isArray(res?.machines) ? res.machines : [];
        setMachines(list);
        setMachineStatus(list.length > 0 ? "ok" : "empty");
      })
      .catch(() => setMachineStatus("error"));
  }, []);

  const sensorMap = useAllPowerSensorIds(machines);
  const activeReports = reports.filter((r) => r.status !== "fixed");

  // Live KPI values — sourced directly from SSE liveKw
  const totalKw      = machines.reduce((s, m) => s + (liveKw[m._id] || 0), 0);
  const estCostSAR   = totalKw * ENERGY_RATE * estPeriod.mult;
  const estEnergyKwh = totalKw * estPeriod.mult;

  // Machine online count from live machine-state events
  const hasStateData = machines.some((m) => machineStates[m._id] !== undefined);
  const onlineCount  = machines.filter((m) => machineStates[m._id]?.state === "on").length;

  // Historical cost aggregates for KPI tiles
  const { totalSAR: monthlySAR, totalKwh: monthlyKwh, loading: monthlyLoading } = useAggregatePeriod(machines, 720);
  const avgCostSAR   = monthlySAR  > 0 ? monthlySAR  / (720 / avgPeriod.divH) : 0;
  const avgEnergyKwh = monthlyKwh  > 0 ? monthlyKwh  / (720 / avgPeriod.divH) : 0;
  const { totalSAR: rangeSAR, totalKwh: rangeKwh, loading: rangeLoading } = useAggregatePeriod(machines, rangeOpt.hours);

  return (
    <div className="w-full p-6 flex flex-col gap-6 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Overview</h1>
          {machines.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                hasStateData && onlineCount > 0
                  ? "bg-green-500 animate-pulse"
                  : "bg-gray-300 dark:bg-zinc-600"
              }`} />
              {hasStateData ? `${onlineCount} / ${machines.length} online` : `${machines.length} machines`}
              {activeReports.length > 0 && (
                <span className="ml-0.5 text-amber-500 dark:text-amber-400">
                  · {activeReports.length} ticket{activeReports.length !== 1 ? "s" : ""}
                </span>
              )}
            </span>
          )}
        </div>
        <Link to="/app/bigscreen" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Big screen →
        </Link>
      </div>

      {machineStatus === "loading" && (
        <p className="text-sm text-gray-400 dark:text-zinc-500 animate-pulse">Loading machines…</p>
      )}
      {machineStatus === "auth" && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-3 text-sm text-amber-700 dark:text-amber-400">
          Session expired — please <a href="/login" className="underline font-semibold">log in again</a> to see live data.
        </div>
      )}
      {machineStatus === "error" && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-3 text-sm text-red-700 dark:text-red-400">
          Could not reach the server — check that the backend is running on port 8081.
        </div>
      )}
      {machineStatus === "empty" && (
        <div className="rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-3 text-sm text-gray-500 dark:text-zinc-400">
          No machines found for this account. Add a machine to start seeing data.
        </div>
      )}

      {/* ── KPI tiles row 1 — energy ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Live Power */}
        <KpiTile
          label="Live Power"
          value={totalKw > 0 ? `${totalKw.toFixed(1)} kW` : "— kW"}
          sub="total across all machines"
          accent="text-blue-600 dark:text-blue-400"
        />

        {/* Avg Energy — derived from 30-day history */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Avg Energy</span>
          <span className="text-2xl font-extrabold leading-none text-blue-600 dark:text-blue-400">
            {monthlyLoading ? "…" : `${avgEnergyKwh.toFixed(avgPeriod.divH >= 24 ? 1 : 2)} kWh`}
          </span>
          <div className="flex gap-1 flex-wrap">
            {AVG_PERIODS.map((p) => (
              <button key={p.label} onClick={() => setAvgPeriod(p)}
                className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                  avgPeriod.label === p.label
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-blue-400"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Est. Energy — live projection */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Est. Energy</span>
          <span className="text-2xl font-extrabold leading-none text-blue-600 dark:text-blue-400">
            {totalKw > 0 ? `${estEnergyKwh.toFixed(1)} kWh` : "— kWh"}
          </span>
          <div className="flex gap-1 flex-wrap">
            {EST_PERIODS.map((p) => (
              <button key={p.label} onClick={() => setEstPeriod(p)}
                className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                  estPeriod.label === p.label
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-blue-400"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Energy — historical */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Period Energy</span>
          <span className="text-2xl font-extrabold leading-none text-blue-600 dark:text-blue-400">
            {rangeLoading ? "…" : `${rangeKwh.toFixed(1)} kWh`}
          </span>
          <div className="flex gap-1 flex-wrap">
            {RANGE_OPTS.map((opt) => (
              <button key={opt.label} onClick={() => setRangeOpt(opt)}
                className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                  rangeOpt.label === opt.label
                    ? "bg-blue-600 border-blue-600 text-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-blue-400"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI tiles row 2 — costs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Monthly Cost */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Monthly Cost</span>
          <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
            {monthlyLoading ? "…" : `SAR ${monthlySAR.toFixed(2)}`}
          </span>
          <span className="text-xs text-gray-400 dark:text-zinc-500">last 30 days · all machines</span>
        </div>

        {/* Avg Cost — switchable per h / day / week */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Avg Cost</span>
          <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
            {monthlyLoading ? "…" : `SAR ${avgCostSAR.toFixed(avgPeriod.divH >= 24 ? 2 : 3)}`}
          </span>
          <div className="flex gap-1 flex-wrap">
            {AVG_PERIODS.map((p) => (
              <button key={p.label} onClick={() => setAvgPeriod(p)}
                className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                  avgPeriod.label === p.label
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-emerald-400"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Est. Cost — live projection with period selector */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Est. Cost</span>
          <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
            {totalKw > 0 ? `SAR ${estCostSAR.toFixed(2)}` : "SAR —"}
          </span>
          <div className="flex gap-1 flex-wrap">
            {EST_PERIODS.map((p) => (
              <button key={p.label} onClick={() => setEstPeriod(p)}
                className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                  estPeriod.label === p.label
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-emerald-400"
                }`}>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Period Cost — real historical data */}
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">Period Cost</span>
          <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
            {rangeLoading ? "…" : `SAR ${rangeSAR.toFixed(2)}`}
          </span>
          <div className="flex gap-1 flex-wrap">
            {RANGE_OPTS.map((opt) => (
              <button key={opt.label} onClick={() => setRangeOpt(opt)}
                className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                  rangeOpt.label === opt.label
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-emerald-400"
                }`}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Live power chart ── */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Live power</SectionHeading>
        <OverviewInteractiveChart machines={machines} sensorMap={sensorMap} mode="power" />
      </section>

      {/* ── Energy Costs ── */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Energy costs</SectionHeading>

        {/* Pie chart (1/3) + interactive cost chart (2/3) */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch">
          <div className="lg:basis-1/3 min-w-0">
            <MachineCostPie machines={machines} />
          </div>
          <div className="lg:basis-2/3 min-w-0">
            <OverviewInteractiveChart machines={machines} sensorMap={sensorMap} mode="cost" />
          </div>
        </div>
      </section>
    </div>
  );
}
