import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useNotifications, Report, ReportStatus } from "@/context/NotificationContext";
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

// ── Report card helpers ───────────────────────────────────────────────────────
const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  needs_more_time: "Needs More Time",
  fixed: "Fixed",
};

const STATUS_BADGE: Record<ReportStatus, string> = {
  new:             "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 border-gray-300 dark:border-zinc-600",
  in_progress:     "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-700",
  needs_more_time: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-300 dark:border-orange-700",
  fixed:           "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700",
};

const BORDER_ACCENT: Record<ReportStatus, string> = {
  new:             "border-l-gray-400 dark:border-l-zinc-600",
  in_progress:     "border-l-blue-500",
  needs_more_time: "border-l-orange-500",
  fixed:           "border-l-green-500",
};

function CompactReportCard({ report }: { report: Report }) {
  return (
    <Link to="/app/reports">
      <div className={`rounded-md border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex border-l-4 ${BORDER_ACCENT[report.status]}`}>
        <div className="flex flex-col px-3 py-2 flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100 truncate">
              {report.sensorName} — {report.machineName}
            </span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_BADGE[report.status]}`}>
              {STATUS_LABEL[report.status]}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5 truncate">{report.comment}</span>
        </div>
      </div>
    </Link>
  );
}

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

// ── Aggregate energy cost hook (for cost KPI tiles only) ──────────────────────
function useAggregateCost(
  machines: Machine[],
  windowHours: number,
): { total: number; loading: boolean } {
  const [total, setTotal] = useState(0);
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
        let sum = 0;
        for (const res of results)
          for (const p of res.points)
            sum += p.avgPowerKw * durH * ENERGY_RATE;
        setTotal(+sum.toFixed(2));
      })
      .finally(() => setLoading(false));
  }, [machines.length, windowHours]);

  return { total, loading };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineStatus, setMachineStatus] = useState<"loading" | "ok" | "auth" | "empty" | "error">("loading");
  const [rangeOpt, setRangeOpt] = useState<RangeOpt>(RANGE_OPTS[2]);
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
  const totalKw       = machines.reduce((s, m) => s + (liveKw[m._id] || 0), 0);
  const hourlyCostSAR = totalKw * ENERGY_RATE;
  const dailyCostSAR  = hourlyCostSAR * 24;

  // Machine online count from live machine-state events
  const hasStateData  = machines.some((m) => machineStates[m._id] !== undefined);
  const onlineCount   = machines.filter((m) => machineStates[m._id]?.state === "on").length;

  // Historical cost aggregates for KPI tiles
  const { total: monthlySAR, loading: monthlyLoading } = useAggregateCost(machines, 720);
  const avgHourlySAR = monthlySAR > 0 ? monthlySAR / 720 : 0;
  const { total: rangeSAR,   loading: rangeLoading   } = useAggregateCost(machines, rangeOpt.hours);

  return (
    <div className="w-full p-6 flex flex-col gap-6 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Overview</h1>
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

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile
          label="Machines"
          value={hasStateData ? `${onlineCount} / ${machines.length}` : String(machines.length)}
          sub={
            hasStateData
              ? `online · ${activeReports.length} open ticket${activeReports.length !== 1 ? "s" : ""}`
              : `${activeReports.length} open ticket${activeReports.length !== 1 ? "s" : ""}`
          }
        />
        <KpiTile
          label="Live Power"
          value={totalKw > 0 ? `${totalKw.toFixed(1)} kW` : "— kW"}
          sub="total across all machines"
          accent="text-blue-600 dark:text-blue-400"
        />
        <KpiTile
          label="Est. Hourly Cost"
          value={hourlyCostSAR > 0 ? `SAR ${hourlyCostSAR.toFixed(2)}` : "SAR —"}
          sub={`@${ENERGY_RATE} SAR/kWh`}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <KpiTile
          label="Est. Daily Cost"
          value={dailyCostSAR > 0 ? `SAR ${dailyCostSAR.toFixed(0)}` : "SAR —"}
          sub="24 h projection"
          accent="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      {/* ── Live power chart ── */}
      <section className="flex flex-col gap-3">
        <SectionHeading>Live power</SectionHeading>
        <OverviewInteractiveChart machines={machines} sensorMap={sensorMap} mode="power" />
      </section>

      {/* ── Maintenance Tickets ── */}
      <section className="flex flex-col gap-3">
        <SectionHeading>
          Maintenance Tickets
          <span className="ml-2 text-xs font-normal normal-case text-gray-400 dark:text-zinc-600">
            ({reports.length} total)
          </span>
        </SectionHeading>

        <div className="grid grid-cols-4 gap-2">
          {(["new", "in_progress", "needs_more_time", "fixed"] as const).map((s) => {
            const count = reports.filter((r) => r.status === s).length;
            const cfg = {
              new:             { label: "New",         color: "bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border-gray-200 dark:border-zinc-700" },
              in_progress:     { label: "In Progress", color: "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800" },
              needs_more_time: { label: "Pending",     color: "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800" },
              fixed:           { label: "Fixed",       color: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800" },
            }[s];
            return (
              <div key={s} className={`flex flex-col items-center py-2.5 rounded-xl border ${cfg.color}`}>
                <span className="text-xl font-extrabold leading-none">{count}</span>
                <span className="text-[10px] font-medium mt-1 opacity-80">{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {reports.some((r) => r.escalation) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
            <span className="text-orange-600 dark:text-orange-400 text-sm">⬆</span>
            <span className="text-xs text-orange-700 dark:text-orange-400 font-medium">
              {reports.filter((r) => r.escalation).length} ticket(s) escalated to management
            </span>
          </div>
        )}

        {activeReports.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-zinc-500">No active reports.</p>
        ) : (
          activeReports.slice(0, 5).map((r) => <CompactReportCard key={r.id} report={r} />)
        )}
        {activeReports.length > 0 && (
          <Link to="/app/reports" className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-right">
            View all tickets →
          </Link>
        )}
      </section>

      {/* ── Energy Costs ── */}
      <section className="flex flex-col gap-4">
        <SectionHeading>Energy costs</SectionHeading>

        {/* KPI tiles — historical aggregates from /metrics/timeseries */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
              Monthly Cost
            </span>
            <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
              {monthlyLoading ? "…" : `SAR ${monthlySAR.toFixed(2)}`}
            </span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">last 30 days · all machines</span>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-1">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
              Avg Cost / h
            </span>
            <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
              {monthlyLoading ? "…" : `SAR ${avgHourlySAR.toFixed(3)}`}
            </span>
            <span className="text-xs text-gray-400 dark:text-zinc-500">average hourly · last 30 days</span>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm px-5 py-4 flex flex-col gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
              Period Cost
            </span>
            <span className="text-2xl font-extrabold leading-none text-emerald-600 dark:text-emerald-400">
              {rangeLoading ? "…" : `SAR ${rangeSAR.toFixed(2)}`}
            </span>
            <div className="flex gap-1 flex-wrap">
              {RANGE_OPTS.map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => setRangeOpt(opt)}
                  className={`px-2 py-0.5 text-[10px] rounded-full border font-semibold transition-colors ${
                    rangeOpt.label === opt.label
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-emerald-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Interactive cost chart — same data as power chart, values × ENERGY_RATE */}
        <OverviewInteractiveChart machines={machines} sensorMap={sensorMap} mode="cost" />
      </section>
    </div>
  );
}
