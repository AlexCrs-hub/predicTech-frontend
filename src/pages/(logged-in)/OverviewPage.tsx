import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNotifications, Report, ReportStatus } from "@/context/NotificationContext";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Machine } from "@/lib/components/machineList/types";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie, Legend,
} from "recharts";

// ── Period options ────────────────────────────────────────────────────────────
const PERIODS = [
  { label: "1 day",   hours: 24   },
  { label: "7 days",  hours: 168  },
  { label: "1 month", hours: 720  },
] as const;
type Period = typeof PERIODS[number];

// ── Status bar definitions ────────────────────────────────────────────────────
const STATUS_BARS = [
  { key: "cutting",     label: "Cutting",       color: "#3b82f6" },
  { key: "reloading",   label: "Reloading",     color: "#a855f7" },
  { key: "idle",        label: "Idle",          color: "#f59e0b" },
  { key: "plannedDT",   label: "Planned DT",    color: "#6b7280" },
  { key: "unplannedDT", label: "Unplanned DT",  color: "#f97316" },
] as const;

type StatusKey = typeof STATUS_BARS[number]["key"];

function computeHours(machineId: string, totalHours: number): Record<StatusKey, number> {
  const u = getMachineUtilization(machineId);
  const runtime   = (u.runtimePct / 100) * totalHours;
  const cutting   = (u.cuttingPct / 100) * runtime;
  const reloading = runtime * 0.12;
  const idle      = Math.max(0, runtime - cutting - reloading);
  const dt        = totalHours - runtime;
  return {
    cutting:     +cutting.toFixed(1),
    reloading:   +reloading.toFixed(1),
    idle:        +idle.toFixed(1),
    plannedDT:   +(dt * 0.65).toFixed(1),
    unplannedDT: +(dt * 0.35).toFixed(1),
  };
}

// ── Downtime pie data ─────────────────────────────────────────────────────────
const DOWNTIME_PIE_DATA = [
  { name: "Maintenance",        value: 35, color: "#3b82f6" },
  { name: "Unplanned downtime", value: 25, color: "#f97316" },
  { name: "Planned downtime",   value: 28, color: "#6b7280" },
  { name: "Broken / fault",     value: 12, color: "#ef4444" },
];

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

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
      {children}
    </h2>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const { reports } = useNotifications();

  useEffect(() => {
    fetchAllMachines()
      .then((res) => setMachines(Array.isArray(res?.machines) ? res.machines : []))
      .catch(() => setMachines([]));
  }, []);

  const activeReports = reports.filter((r) => r.status !== "fixed");

  const leaderboard = [...machines]
    .map((m) => ({ ...m, utilPct: getMachineUtilization(m._id).runtimePct }))
    .sort((a, b) => b.utilPct - a.utilPct);

  const sourceMachines =
    selectedMachine === "all"
      ? machines
      : machines.filter((m) => m._id === selectedMachine);

  const chartData = STATUS_BARS.map(({ key, label, color }) => {
    const total = sourceMachines.reduce(
      (sum, m) => sum + computeHours(m._id, period.hours)[key],
      0,
    );
    return { name: label, value: +total.toFixed(1), color };
  });

  return (
    <div className="w-full p-6 flex flex-col gap-6 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Overview</h1>
        <Link to="/app/bigscreen" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Big screen →
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">

          {/* Time breakdown chart */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading>Time breakdown</SectionHeading>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="text-sm border border-gray-200 dark:border-zinc-700 rounded-md px-2 py-1 bg-white dark:bg-zinc-900 text-gray-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                >
                  <option value="all">All machines</option>
                  {machines.map((m) => (
                    <option key={m._id} value={m._id}>{m.name}</option>
                  ))}
                </select>
                <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
                  {PERIODS.map((p) => (
                    <button
                      key={p.label}
                      className={`px-3 py-1 text-sm transition-colors ${
                        period.label === p.label
                          ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
                          : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                      onClick={() => setPeriod(p)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}h`}
                    width={40}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value} h`, "Hours"]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    cursor={{ fill: "#f9fafb" }}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Utilization leaderboard */}
          {leaderboard.length > 0 && (
            <section className="flex flex-col gap-3">
              <SectionHeading>Utilization leaderboard</SectionHeading>
              <div className="rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-zinc-800 text-xs text-gray-500 dark:text-zinc-400 uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left w-8">#</th>
                      <th className="px-3 py-2 text-left">Machine</th>
                      <th className="px-3 py-2 text-right">Runtime</th>
                      <th className="px-3 py-2 text-right">Cutting</th>
                      <th className="px-3 py-2 text-right">Cycles</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                    {leaderboard.map((m, i) => {
                      const u = getMachineUtilization(m._id);
                      return (
                        <tr key={m._id} className="hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
                          <td className="px-3 py-2 text-gray-400 dark:text-zinc-600 font-mono">{i + 1}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-zinc-100">
                            <Link to={`/app/machine?machineId=${m._id}`} className="font-medium hover:text-blue-600 dark:hover:text-blue-400">
                              {m.name}
                            </Link>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-gray-100 dark:bg-zinc-700 overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full" style={{ width: `${u.runtimePct}%` }} />
                              </div>
                              <span className="font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{u.runtimePct}%</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600 dark:text-zinc-400 tabular-nums">{u.cuttingPct}%</td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-zinc-100">{u.cycles}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-6">

          {/* Downtime reasons pie */}
          <section className="flex flex-col gap-3">
            <SectionHeading>Downtime reasons</SectionHeading>
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={DOWNTIME_PIE_DATA}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {DOWNTIME_PIE_DATA.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, ""]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={10}
                    formatter={(value) => (
                      <span style={{ fontSize: 12 }} className="text-gray-600 dark:text-zinc-400">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Active Reports */}
          <section className="flex flex-col gap-3">
            <SectionHeading>
              Active Reports
              <span className="ml-2 text-xs font-normal normal-case text-gray-400 dark:text-zinc-600">
                ({activeReports.length})
              </span>
            </SectionHeading>
            {activeReports.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-zinc-500">No active reports.</p>
            ) : (
              activeReports.map((r) => <CompactReportCard key={r.id} report={r} />)
            )}
            {activeReports.length > 0 && (
              <Link to="/app/reports" className="text-xs text-blue-600 dark:text-blue-400 hover:underline text-right">
                View all reports →
              </Link>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
