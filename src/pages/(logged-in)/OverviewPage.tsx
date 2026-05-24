import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useNotifications, Report, ReportStatus } from "@/context/NotificationContext";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Machine } from "@/lib/components/machineList/types";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";
import { useWebSocket } from "@/context/WebSocketContext";
import { downloadCsv } from "@/lib/utils/exportCsv";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, LineChart, Line,
} from "recharts";
import { Download } from "lucide-react";

// ── Period options ────────────────────────────────────────────────────────────
const PERIODS = [
  { label: "1 day",   hours: 24   },
  { label: "7 days",  hours: 168  },
  { label: "1 month", hours: 720  },
] as const;
type Period = typeof PERIODS[number];

// ── Cost chart periods ────────────────────────────────────────────────────────
const COST_PERIODS = [
  { label: "1 day",   days: 1  },
  { label: "7 days",  days: 7  },
  { label: "1 month", days: 30 },
] as const;
type CostPeriod = typeof COST_PERIODS[number];

function buildCostData(machines: Machine[], days: number): { date: string; cost: number }[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (days - 1 - i));
    const label = days === 1
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
    // deterministic daily cost: sum utilisation-based kWh per machine
    const dailyCost = machines.reduce((sum, m) => {
      const u = getMachineUtilization(m._id);
      // seed per machine+day so values are stable but vary by day
      const seed = (u.runtimePct + i * 3 + m._id.charCodeAt(0)) % 20;
      const kwhDay = (u.runtimePct / 100) * (m.maxPowerConsumption ?? 10) * 24 * (0.85 + seed * 0.01);
      return sum + kwhDay * ENERGY_RATE;
    }, 0);
    return { date: label, cost: +dailyCost.toFixed(2) };
  });
}

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

// ── Downtime causes (bar chart) ───────────────────────────────────────────────
const DOWNTIME_CAUSES = [
  { name: "Tool change",   minutes: 18, pct: 38, color: "#ef4444" },
  { name: "Material wait", minutes: 12, pct: 25, color: "#f97316" },
  { name: "Micro-stops",   minutes: 9,  pct: 19, color: "#eab308" },
  { name: "Setup",         minutes: 5,  pct: 11, color: "#60a5fa" },
  { name: "Other",         minutes: 3,  pct: 6,  color: "#6b7280" },
];

const ENERGY_RATE = 0.15; // €/kWh

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

function ExportBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 text-xs text-gray-400 dark:text-zinc-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-2 py-1 rounded border border-gray-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700"
    >
      <Download className="size-3" />
      Export
    </button>
  );
}

// ── KPI tile ─────────────────────────────────────────────────────────────────
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

// ── Page ─────────────────────────────────────────────────────────────────────
export default function OverviewPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [period, setPeriod] = useState<Period>(PERIODS[0]);
  const [selectedMachine, setSelectedMachine] = useState<string>("all");
  const [costPeriod, setCostPeriod] = useState<CostPeriod>(COST_PERIODS[1]);
  const { reports } = useNotifications();
  const { liveKw } = useWebSocket();

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

  // Power & cost KPIs
  const totalKw = machines.length > 0
    ? machines.reduce((sum, m) => sum + (liveKw[m._id] || 0), 0)
    : 0;
  const hourlyCostEur = totalKw * ENERGY_RATE;
  const dailyCostEur  = hourlyCostEur * 24;

  const costData = buildCostData(machines, costPeriod.days);
  const totalCostInPeriod = costData.reduce((s, d) => s + d.cost, 0);

  // Export helpers
  const exportCostChart = () => {
    downloadCsv(`energy_cost_${costPeriod.days}d.csv`, [
      ["Date", "Cost (EUR)"],
      ...costData.map((d) => [d.date, d.cost]),
    ]);
  };

  const exportTimeBreakdown = () => {
    downloadCsv("time_breakdown.csv", [
      ["Category", "Hours"],
      ...chartData.map((d) => [d.name, d.value]),
    ]);
  };

  const exportLeaderboard = () => {
    downloadCsv("utilization_leaderboard.csv", [
      ["Machine", "Runtime %", "Cutting %", "Cycles"],
      ...leaderboard.map((m) => {
        const u = getMachineUtilization(m._id);
        return [m.name, u.runtimePct, u.cuttingPct, u.cycles];
      }),
    ]);
  };

  const exportDowntimeCauses = () => {
    downloadCsv("downtime_causes.csv", [
      ["Cause", "Minutes", "Percent"],
      ...DOWNTIME_CAUSES.map((d) => [d.name, d.minutes, d.pct]),
    ]);
  };

  return (
    <div className="w-full p-6 flex flex-col gap-6 bg-gray-50 dark:bg-zinc-950 min-h-screen">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Overview</h1>
        <Link to="/app/bigscreen" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          Big screen →
        </Link>
      </div>

      {/* ── KPI tiles ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiTile
          label="Machines"
          value={String(machines.length)}
          sub={`${activeReports.length} open ticket${activeReports.length !== 1 ? "s" : ""}`}
        />
        <KpiTile
          label="Live Power"
          value={totalKw > 0 ? `${totalKw.toFixed(1)} kW` : "— kW"}
          sub="total across all machines"
          accent="text-blue-600 dark:text-blue-400"
        />
        <KpiTile
          label="Est. Hourly Cost"
          value={hourlyCostEur > 0 ? `€${hourlyCostEur.toFixed(2)}` : "€—"}
          sub={`@€${ENERGY_RATE}/kWh`}
          accent="text-emerald-600 dark:text-emerald-400"
        />
        <KpiTile
          label="Est. Daily Cost"
          value={dailyCostEur > 0 ? `€${dailyCostEur.toFixed(0)}` : "€—"}
          sub="24 h projection"
          accent="text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-6">

          {/* Time breakdown chart */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionHeading>Time breakdown</SectionHeading>
              <div className="flex items-center gap-2 flex-wrap">
                <ExportBtn onClick={exportTimeBreakdown} />
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
              <div className="flex items-center justify-between">
                <SectionHeading>Utilization leaderboard</SectionHeading>
                <ExportBtn onClick={exportLeaderboard} />
              </div>
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

          {/* Downtime causes — bar chart */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <SectionHeading>Top downtime causes</SectionHeading>
              <ExportBtn onClick={exportDowntimeCauses} />
            </div>
            <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5">
              <div className="flex flex-col gap-3">
                {DOWNTIME_CAUSES.map(({ name, minutes, pct, color }) => (
                  <div key={name} className="flex items-center gap-3">
                    <span className="w-28 text-sm text-gray-600 dark:text-zinc-400 shrink-0">{name}</span>
                    <div className="flex-1 h-4 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 dark:text-zinc-200 w-14 text-right shrink-0 tabular-nums">
                      {minutes} min
                    </span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 w-8 text-right shrink-0 tabular-nums">
                      {pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Maintenance Tickets */}
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
        </div>
      </div>

      {/* ── Energy Cost Trend ── */}
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <SectionHeading>Energy cost trend</SectionHeading>
            {machines.length > 0 && (
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                Total: €{totalCostInPeriod.toFixed(2)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ExportBtn onClick={exportCostChart} />
            <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
              {COST_PERIODS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setCostPeriod(p)}
                  className={`px-3 py-1 text-sm transition-colors ${
                    costPeriod.label === p.label
                      ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
                      : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-4">
          {machines.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-500 text-center py-8">No machine data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={costData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  interval={costPeriod.days <= 7 ? 0 : Math.floor(costPeriod.days / 6)}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `€${v}`}
                  width={46}
                />
                <Tooltip
                  formatter={(value: number) => [`€${value.toFixed(2)}`, "Cost"]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                  cursor={{ stroke: "#e5e7eb" }}
                />
                <Line
                  type="monotone"
                  dataKey="cost"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={costPeriod.days <= 7}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>
    </div>
  );
}
