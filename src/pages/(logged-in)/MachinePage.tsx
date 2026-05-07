import { fetchMachineById } from "@/lib/api/machineApi";
import { useWebSocket } from "@/context/WebSocketContext";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Machine } from "@/lib/components/machineList/types";
import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  LineChart,
  Line,
  Tooltip,
} from "recharts";
import DowntimeLog from "@/lib/components/machine/DowntimeLog";
import MachineSensors from "@/lib/components/machine/MachineSensors";

// ── fake data ─────────────────────────────────────────────────────────────────

const OEE = 82.7;
const OEE_DELTA = +5.2;
const AVAILABILITY = 91.2;
const PERFORMANCE = 88.4;
const QUALITY = 97.1;

const PARTS_PRODUCED = 347;
const PARTS_TARGET = 420;

const CYCLE_TIME_S = 42.3;
const CYCLE_TARGET_S = 45;

const CYCLE_TREND = [38, 41, 43, 40, 42, 44, 42.3].map((v, i) => ({ i, v }));

type TimelineSegment = {
  label: "Running" | "Idle" | "Down" | "Setup";
  color: string;
  pct: number;
};

const TIMELINE: TimelineSegment[] = [
  { label: "Running", color: "#22c55e", pct: 62 },
  { label: "Idle", color: "#eab308", pct: 8 },
  { label: "Running", color: "#22c55e", pct: 4 },
  { label: "Down", color: "#ef4444", pct: 5 },
  { label: "Running", color: "#22c55e", pct: 15 },
  { label: "Setup", color: "#60a5fa", pct: 3 },
  { label: "Running", color: "#22c55e", pct: 3 },
];

const DOWNTIME_CAUSES = [
  { name: "Tool change", minutes: 18, pct: 38, color: "#ef4444" },
  { name: "Material wait", minutes: 12, pct: 25, color: "#f97316" },
  { name: "Micro-stops", minutes: 9, pct: 19, color: "#eab308" },
  { name: "Setup", minutes: 5, pct: 11, color: "#60a5fa" },
  { name: "Other", minutes: 3, pct: 6, color: "#6b7280" },
];

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

// ── OEE gauge ─────────────────────────────────────────────────────────────────

function OeeGauge() {
  const data = [{ value: OEE, fill: "url(#oeeGrad)" }];
  return (
    <div className="relative w-52 h-32 mx-auto">
      <ResponsiveContainer width="100%" height={200}>
        <RadialBarChart
          cx="50%"
          cy="85%"
          innerRadius="70%"
          outerRadius="100%"
          startAngle={180}
          endAngle={0}
          data={data}
          barSize={18}
        >
          <defs>
            <linearGradient id="oeeGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          <RadialBar
            dataKey="value"
            cornerRadius={6}
            background={{ fill: "transparent" }}
            isAnimationActive={false}
          />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
        <span className="text-4xl font-extrabold text-gray-900 dark:text-zinc-50 leading-none">
          {OEE}
        </span>
        <span className="text-sm text-gray-400 dark:text-zinc-500 font-medium">
          %
        </span>
        <span className="text-xs font-semibold text-green-600 dark:text-green-500 mt-1">
          ▲ +{OEE_DELTA}%
        </span>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function MachinePage() {
  const [machine, setMachine] = useState<Machine | null>(null);
  const [error, setError] = useState("");
  const { machineStates } = useWebSocket();
  const { search } = useLocation();
  const machineId = new URLSearchParams(search).get("machineId") || "";

  const wsState = machineStates[machineId];
  const isRunning = wsState?.state?.toLowerCase() === "on";

  const currentState =
    wsState?.health?.toLowerCase() === "healthy"
      ? "normal"
      : wsState?.health?.toLowerCase() === "stale"
        ? "unplanned downtime"
        : wsState?.health?.toLowerCase() === "disconnected"
          ? "alarm"
          : "planned downtime";

  useEffect(() => {
    fetchMachineById(machineId).then((res) => {
      if (res.error) setError(res.error);
      else setMachine(res.machine || null);
    });
  }, [machineId]);

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
        <span className="text-xs text-zinc-500 ml-1">
          Morning Shift · 06:00–
        </span>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-4 p-5">
        {/* ── left column ── */}
        <div className="flex flex-col gap-4">
          {/* OEE */}
          <Card>
            <Label>Overall OEE</Label>
            <OeeGauge />
            <div className="flex justify-between mt-5">
              {[
                { label: "Availability", value: AVAILABILITY },
                { label: "Performance", value: PERFORMANCE },
                { label: "Quality", value: QUALITY },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center flex-1 text-center"
                >
                  <span className="text-sm font-bold text-green-600 dark:text-green-500">
                    {value}%
                  </span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Parts produced */}
          <Card>
            <Label>Parts Produced</Label>
            <BigNumber value={PARTS_PRODUCED} unit={`/${PARTS_TARGET}`} />
            <div className="mt-4 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500"
                style={{ width: `${(PARTS_PRODUCED / PARTS_TARGET) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-right mt-1.5">
              {((PARTS_PRODUCED / PARTS_TARGET) * 100).toFixed(1)}%
            </p>
          </Card>

          {/* Cycle time */}
          <Card>
            <Label>Cycle Time</Label>
            <div className="flex items-end justify-between">
              <BigNumber value={CYCLE_TIME_S} unit="s" />
              <div className="w-24 h-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={CYCLE_TREND}>
                    <Line
                      type="monotone"
                      dataKey="v"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 11,
                        borderRadius: 8,
                        border: "1px solid #e5e7eb",
                      }}
                      formatter={(v: number) => [`${v}s`, "Cycle"]}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-xs text-green-600 dark:text-green-500 font-semibold mt-2">
              Target: {CYCLE_TARGET_S}s ✓
            </p>
          </Card>
        </div>

        {/* ── right column ── */}
        <div className="flex flex-col gap-4">
          {/* Production timeline */}
          <Card>
            <Label>Production Timeline</Label>
            <div className="flex h-7 rounded-lg overflow-hidden gap-px">
              {TIMELINE.map((seg, i) => (
                <div
                  key={i}
                  style={{
                    flexBasis: `${seg.pct}%`,
                    backgroundColor: seg.color,
                  }}
                  title={`${seg.label}: ${seg.pct}%`}
                />
              ))}
            </div>
            <div className="flex items-center justify-between mt-3">
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

          {/* Top downtime causes */}
          <Card>
            <Label>Top Downtime Causes</Label>
            <div className="flex flex-col gap-3">
              {DOWNTIME_CAUSES.map(({ name, minutes, pct, color }) => (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-28 text-sm text-gray-600 dark:text-zinc-400 shrink-0">
                    {name}
                  </span>
                  <div className="flex-1 h-4 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 w-14 text-right shrink-0">
                    {minutes} min
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500 w-8 text-right shrink-0">
                    {pct}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Real sensors (hidden when none have data) */}
          <MachineSensors
            machineId={machineId}
            machineName={machine?.name ?? ""}
          />

          {/* Downtime log */}
          <Card>
            <DowntimeLog machineId={machineId} currentState={currentState} />
          </Card>
        </div>
      </div>
    </div>
  );
}
