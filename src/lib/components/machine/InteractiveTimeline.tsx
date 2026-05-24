import { useState, useMemo } from "react";
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
  label: string;
  power: number;
  state: State;
}

interface StatePeriod {
  x1: string;
  x2: string;
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
  "24h": { label: "Today",    hours: 24,     intervalMin: 5,   tickEvery: 24  },
  "7d":  { label: "7 days",   hours: 168,    intervalMin: 30,  tickEvery: 16  },
  "30d": { label: "30 days",  hours: 720,    intervalMin: 120, tickEvery: 12  },
} as const;

type PeriodKey = keyof typeof PERIODS;

// ── Data generation ───────────────────────────────────────────────────────────

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

    const d = new Date(startMs + i * intervalMin * 60_000);

    let label: string;
    if (periodKey === "24h") {
      label = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (periodKey === "7d") {
      label = `${d.toLocaleDateString([], { weekday: "short" })} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      label = d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    const power =
      state === "running" ? 4 + rand() * 6
      : state === "idle"  ? 0.8 + rand() * 1.5
      : state === "setup" ? 2   + rand() * 3
      :                     rand() * 0.3;

    points.push({ label, power: +power.toFixed(2), state });
  }
  return points;
}

function getStatePeriods(data: DataPoint[]): StatePeriod[] {
  const out: StatePeriod[] = [];
  if (!data.length) return out;
  let start = 0;
  for (let i = 1; i <= data.length; i++) {
    if (i === data.length || data[i].state !== data[start].state) {
      out.push({ x1: data[start].label, x2: data[i - 1].label, fill: STATE_COLOR[data[start].state] });
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
      <p className="font-semibold text-gray-700 dark:text-zinc-200 mb-1.5">{d.label}</p>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATE_COLOR[d.state] }} />
        <span className="text-gray-600 dark:text-zinc-300">{STATE_LABEL[d.state]}</span>
      </div>
      <p className="text-gray-500 dark:text-zinc-400">
        Power:{" "}
        <span className="font-bold text-gray-800 dark:text-zinc-100">{d.power} kW</span>
      </p>
    </div>
  );
}

// ── Custom brush tick ─────────────────────────────────────────────────────────

function BrushTick({ x, y, payload }: any) {
  return (
    <text x={x} y={y + 10} textAnchor="middle" fontSize={9} fill="#9ca3af">
      {payload?.value}
    </text>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function InteractiveTimeline({ machineId }: { machineId: string }) {
  const [period, setPeriod] = useState<PeriodKey>("24h");

  const { data, periods } = useMemo(() => {
    const d = generateData(machineId, period);
    return { data: d, periods: getStatePeriods(d) };
  }, [machineId, period]);

  const { tickEvery } = PERIODS[period];

  // Default brush shows last 20% of data
  const brushStart = Math.max(0, Math.floor(data.length * 0.8));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
      {/* header row */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
            Historical Timeline
          </p>
          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
            Drag the selector below to zoom · scroll to pan
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
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* state background shading */}
          {periods.map((p, i) => (
            <ReferenceArea
              key={i}
              x1={p.x1}
              x2={p.x2}
              fill={p.fill}
              fillOpacity={0.13}
              ifOverflow="hidden"
            />
          ))}

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#f0f0f0"
            className="dark:[stroke:#27272a]"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#9ca3af" }}
            interval={tickEvery}
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
          <Brush
            dataKey="label"
            startIndex={brushStart}
            height={36}
            stroke="#e5e7eb"
            fill="#f9fafb"
            className="dark:[fill:#18181b] dark:[stroke:#3f3f46]"
            travellerWidth={8}
            gap={1}
            tick={<BrushTick />}
          />

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

      {/* legend */}
      <div className="flex items-center flex-wrap gap-x-5 gap-y-1.5 mt-4 pt-3 border-t border-gray-100 dark:border-zinc-800">
        {(Object.entries(STATE_LABEL) as [State, string][]).map(([s, lbl]) => (
          <span key={s} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: STATE_COLOR[s], opacity: 0.6 }}
            />
            {lbl}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 ml-auto">
          <span className="inline-block w-5 h-0.5 rounded bg-indigo-500" />
          Power (kW)
        </span>
      </div>
    </div>
  );
}
