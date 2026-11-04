import { useState, useMemo, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts";
import { fetchPowerTimeseries } from "@/lib/api/readingWindowApi";
import {
  fetchDowntimeTimeline,
  downtimeEnd,
  downtimeColor,
  formatDuration,
  DowntimeRecord,
  REASON_LABEL,
  UNREPORTED_COLOR,
} from "@/lib/api/downtimeRecordsApi";

// ── types ─────────────────────────────────────────────────────────────────────

type State = "running" | "idle" | "down" | "setup";

const STATE_COLOR: Record<State, string> = {
  running: "#22c55e",
  idle:    "#eab308",
  down:    "#ef4444",
  setup:   "#60a5fa",
};

const STATE_LABEL: Record<State, string> = {
  running: "Running",
  idle:    "Idle",
  down:    "Down",
  setup:   "Setup",
};

interface DataPoint {
  t: number;
  power: number;
  /** only set for simulated data (no real telemetry available) */
  state?: State;
}

interface StatePeriod {
  x1: number;
  x2: number;
  fill: string;
}

// ── PRNG (seeded, deterministic per machineId) ────────────────────────────────

function makePRNG(seed: string) {
  let h = 0x811c9dc5;
  for (const c of seed) {
    h ^= c.charCodeAt(0);
    h = (Math.imul(h, 0x01000193) >>> 0);
  }
  let s = h | 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

// ── Period config ─────────────────────────────────────────────────────────────

const PERIODS = {
  "24h": { label: "Today",    hours: 24,  intervalMin: 5,   granularity: "minute" },
  "7d":  { label: "7 days",   hours: 168, intervalMin: 30,  granularity: "hour"   },
  "30d": { label: "30 days",  hours: 720, intervalMin: 120, granularity: "hour"   },
} as const;

type PeriodKey = keyof typeof PERIODS;

function formatTick(t: number, periodKey: PeriodKey) {
  const d = new Date(t);
  if (periodKey === "24h") return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (periodKey === "7d")  return `${d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFull(t: number) {
  return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Simulated data (fallback when the machine has no telemetry, e.g. demo) ─────

function generateData(machineId: string, periodKey: PeriodKey): DataPoint[] {
  const { hours, intervalMin } = PERIODS[periodKey];
  const rand = makePRNG(machineId + periodKey);
  const numPoints = Math.floor((hours * 60) / intervalMin);
  const startMs = Date.now() - hours * 3_600_000;

  let state: State = "running";
  let remaining = 0;
  const points: DataPoint[] = [];

  for (let i = 0; i < numPoints; i++) {
    if (remaining <= 0) {
      const r = rand();
      state = r < 0.64 ? "running" : r < 0.77 ? "idle" : r < 0.90 ? "setup" : "down";
      remaining = Math.floor(rand() * 12) + 2;
    }
    remaining--;

    const power =
      state === "running" ? 4 + rand() * 6
      : state === "idle"  ? 0.8 + rand() * 1.5
      : state === "setup" ? 2   + rand() * 3
      :                     rand() * 0.3;

    points.push({ t: startMs + i * intervalMin * 60_000, power: +power.toFixed(2), state });
  }
  return points;
}

function getStatePeriods(data: DataPoint[]): StatePeriod[] {
  const out: StatePeriod[] = [];
  if (!data.length || !data[0].state) return out;
  let start = 0;
  for (let i = 1; i <= data.length; i++) {
    if (i === data.length || data[i].state !== data[start].state) {
      out.push({ x1: data[start].t, x2: data[i - 1].t, fill: STATE_COLOR[data[start].state!] });
      start = i;
    }
  }
  return out;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DataPoint;
  if (!d) return null;
  return (
    <div className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 shadow-xl text-xs min-w-[120px]">
      <p className="font-semibold text-gray-700 dark:text-zinc-200 mb-1.5">{formatFull(d.t)}</p>
      {d.state && (
        <div className="flex items-center gap-1.5 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATE_COLOR[d.state] }} />
          <span className="text-gray-600 dark:text-zinc-300">{STATE_LABEL[d.state]}</span>
        </div>
      )}
      <p className="text-gray-500 dark:text-zinc-400">
        Power:{" "}
        <span className="font-bold text-gray-800 dark:text-zinc-100">{d.power} kW</span>
      </p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InteractiveTimeline({
  machineId,
  refreshKey = 0,
  onDowntimeClick,
}: {
  machineId: string;
  /** bump to reload downtime records (e.g. after a report was saved) */
  refreshKey?: number;
  /** clicked downtime + all downtimes in the selected period, oldest first */
  onDowntimeClick?: (record: DowntimeRecord, all: DowntimeRecord[]) => void;
}) {
  const [period, setPeriod] = useState<PeriodKey>("24h");
  const [realData, setRealData] = useState<DataPoint[] | null>(null);
  const [downtimes, setDowntimes] = useState<DowntimeRecord[]>([]);

  const { hours, granularity } = PERIODS[period];

  // real power data from the per-minute metric buckets
  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;
    setRealData(null);
    const to = new Date();
    const from = new Date(to.getTime() - hours * 3_600_000);
    fetchPowerTimeseries({ machineId, from: from.toISOString(), to: to.toISOString(), granularity })
      .then((res) => {
        if (cancelled) return;
        const pts = Array.isArray(res?.points) ? res.points : [];
        setRealData(pts.map((p) => ({ t: p.t, power: p.avgPowerKw })));
      })
      .catch(() => { if (!cancelled) setRealData([]); });
    return () => { cancelled = true; };
  }, [machineId, hours, granularity]);

  useEffect(() => {
    if (!machineId) return;
    let cancelled = false;
    fetchDowntimeTimeline(machineId, hours)
      .then((list) => { if (!cancelled) setDowntimes(Array.isArray(list) ? list : []); })
      .catch(() => { if (!cancelled) setDowntimes([]); });
    return () => { cancelled = true; };
  }, [machineId, hours, refreshKey]);

  const simulated = realData !== null && realData.length < 2;

  const { data, periods } = useMemo(() => {
    const d = simulated ? generateData(machineId, period) : realData ?? [];
    return { data: d, periods: getStatePeriods(d) };
  }, [machineId, period, realData, simulated]);

  // Default brush shows last 20% of data
  const brushStart = Math.max(0, Math.floor(data.length * 0.8));

  const windowStart = Date.now() - hours * 3_600_000;
  const downtimeAreas = downtimes.map((r) => ({
    record: r,
    x1: Math.max(new Date(r.startedAt).getTime(), windowStart),
    x2: downtimeEnd(r).getTime(),
  }));
  const unreportedCount = downtimes.filter((r) => !r.reasonRecorded).length;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
      {/* header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Historical Timeline
          </p>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
            Drag the selector below to zoom · click a downtime to report it
            {simulated && " · simulated power data"}
          </p>
        </div>
        {/* period tabs */}
        <div className="flex rounded-lg border border-gray-200 dark:border-zinc-700 overflow-hidden text-xs">
          {(Object.entries(PERIODS) as [PeriodKey, typeof PERIODS[PeriodKey]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={`px-3 py-1.5 font-medium transition-colors ${
                period === key
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* main chart */}
      {realData === null ? (
        <div className="flex items-center justify-center h-[300px] text-xs text-gray-400 dark:text-zinc-500 animate-pulse">
          Loading timeline…
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
              </linearGradient>
            </defs>

            {/* simulated state background shading */}
            {periods.map((p, i) => (
              <ReferenceArea
                key={`s${i}`}
                x1={p.x1}
                x2={p.x2}
                fill={p.fill}
                fillOpacity={0.13}
                ifOverflow="hidden"
              />
            ))}

            {/* real downtime records — click to report */}
            {downtimeAreas.map(({ record, x1, x2 }) => (
              <ReferenceArea
                key={record._id}
                x1={x1}
                x2={x2}
                fill={downtimeColor(record)}
                fillOpacity={record.reasonRecorded ? 0.18 : 0.28}
                stroke={downtimeColor(record)}
                strokeOpacity={0.5}
                ifOverflow="hidden"
                className={onDowntimeClick ? "cursor-pointer" : undefined}
                onClick={onDowntimeClick ? () => onDowntimeClick(record, downtimes) : undefined}
              />
            ))}

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f0f0f0"
              className="dark:[stroke:#27272a]"
              vertical={false}
            />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(t: number) => formatTick(t, period)}
              minTickGap={40}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}kW`}
              width={42}
              domain={[0, "auto"]}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* brush / zoom-pan */}
            {data.length > 1 && (
              <Brush
                dataKey="t"
                startIndex={brushStart}
                height={36}
                stroke="#e5e7eb"
                fill="#f9fafb"
                className="dark:[fill:#18181b] dark:[stroke:#3f3f46]"
                travellerWidth={8}
                gap={1}
                tickFormatter={(t: number) => formatTick(t, period)}
              />
            )}

            <Area
              type="monotone"
              dataKey="power"
              stroke="#6366f1"
              strokeWidth={1.5}
              fill="url(#powerGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#6366f1", strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* downtimes in the selected period */}
      {downtimes.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Downtimes · {downtimes.length}
            {unreportedCount > 0 && (
              <span className="ml-2 normal-case tracking-normal font-semibold text-red-500">
                {unreportedCount} not reported
              </span>
            )}
          </p>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {downtimes.map((r) => {
              const color = downtimeColor(r);
              const start = new Date(r.startedAt).getTime();
              return (
                <button
                  key={r._id}
                  onClick={() => onDowntimeClick?.(r, downtimes)}
                  className="shrink-0 flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border transition-colors hover:brightness-95"
                  style={{ borderColor: color, color, backgroundColor: `${color}12` }}
                >
                  <span className="tabular-nums">{formatFull(start)}</span>
                  <span className="opacity-70 tabular-nums">· {formatDuration(downtimeEnd(r).getTime() - start)}</span>
                  <span className="font-semibold">
                    · {r.reasonRecorded && r.reason ? REASON_LABEL[r.reason] : "Not reported"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* legend */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
        {simulated &&
          (Object.entries(STATE_LABEL) as [State, string][]).map(([s, lbl]) => (
            <span key={s} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
              <span
                className="inline-block w-3 h-3 rounded-sm"
                style={{ backgroundColor: STATE_COLOR[s], opacity: 0.6 }}
              />
              {lbl}
            </span>
          ))}
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: UNREPORTED_COLOR, opacity: 0.5 }} />
          Downtime (not reported)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
          <span className="inline-block w-3 h-3 rounded-sm bg-gradient-to-r from-indigo-400 via-blue-400 to-amber-400 opacity-60" />
          Downtime (reported — colour = reason)
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 ml-auto">
          <span className="inline-block w-5 h-0.5 rounded bg-indigo-500" />
          Power (kW)
        </span>
      </div>
    </div>
  );
}
