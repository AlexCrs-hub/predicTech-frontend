import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useWebSocket } from "@/context/WebSocketContext";
import { useNotifications } from "@/context/NotificationContext";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Machine } from "@/lib/components/machineList/types";
import { getMachineUtilization } from "@/lib/utils/machineSimulation";

const STATE_BG: Record<Machine["currentState"], string> = {
  normal: "bg-green-500",
  alarm: "bg-red-500",
  "unplanned downtime": "bg-orange-500",
  "planned downtime": "bg-gray-400",
};

const STATE_LABEL: Record<Machine["currentState"], string> = {
  normal: "Running",
  alarm: "Alarm",
  "unplanned downtime": "Unpl. DT",
  "planned downtime": "Planned DT",
};

function BigMachineCard({
  machine,
  currentState,
  liveKw,
}: {
  machine: Machine;
  currentState: Machine["currentState"];
  liveKw: number;
}) {
  const u = getMachineUtilization(machine._id);
  const bg = STATE_BG[currentState];
  const label = STATE_LABEL[currentState];
  const r = 42;
  const circ = 2 * Math.PI * r;
  const filled = (u.runtimePct / 100) * circ;

  return (
    <div className="rounded-xl border-2 border-gray-700 bg-gray-800 text-white overflow-hidden flex flex-col">
      {/* Header */}
      <div className={`px-4 py-2 ${bg} flex items-center justify-between`}>
        <span className="font-bold text-lg truncate">{machine.name}</span>
        <span className="text-sm font-semibold opacity-90">{label}</span>
      </div>

      {/* Body */}
      <div className="flex items-center justify-around px-4 py-4 gap-4">
        {/* Donut */}
        <svg width="108" height="108" viewBox="0 0 108 108" className="shrink-0">
          <circle cx="54" cy="54" r={r} fill="none" stroke="#374151" strokeWidth="12" />
          <circle
            cx="54" cy="54" r={r}
            fill="none"
            stroke="#22c55e"
            strokeWidth="12"
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="butt"
            transform="rotate(-90 54 54)"
          />
          <text x="54" y="59" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">
            {u.runtimePct}%
          </text>
        </svg>

        {/* Stats */}
        <div className="flex flex-col gap-2 text-sm min-w-0">
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Cutting</span>
            <span className="font-semibold">{u.cuttingPct}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Idle</span>
            <span className="font-semibold">{u.idlePct}%</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Cycles</span>
            <span className="font-semibold">{u.cycles}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Power</span>
            <span className="font-semibold">{liveKw > 0 ? `${liveKw.toFixed(1)} kW` : "—"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BigScreenPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const { machineStates, liveKw } = useWebSocket();
  const { reports, alerts } = useNotifications();

  useEffect(() => {
    fetchAllMachines()
      .then((res) => setMachines(Array.isArray(res?.machines) ? res.machines : []))
      .catch(() => setMachines([]));
  }, []);

  const activeAlertCount = alerts.length;
  const activeReports = reports.filter((r) => r.status !== "fixed");

  const leaderboard = [...machines]
    .map((m) => ({ ...m, utilPct: getMachineUtilization(m._id).runtimePct }))
    .sort((a, b) => b.utilPct - a.utilPct);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col gap-6 p-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Live Dashboard</h1>
        <div className="flex items-center gap-4 text-sm">
          {activeAlertCount > 0 && (
            <span className="bg-red-600 text-white font-bold px-3 py-1 rounded-full animate-pulse">
              {activeAlertCount} alert{activeAlertCount !== 1 ? "s" : ""}
            </span>
          )}
          {activeReports.length > 0 && (
            <span className="bg-orange-500 text-white font-semibold px-3 py-1 rounded-full">
              {activeReports.length} open report{activeReports.length !== 1 ? "s" : ""}
            </span>
          )}
          <Link to="/app/overview" className="text-gray-400 hover:text-white text-xs underline">
            ← Exit big screen
          </Link>
        </div>
      </div>

      {/* Machine grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {machines.map((m) => {
          const ws = machineStates[m._id];
          const currentState: Machine["currentState"] =
            ws?.health?.toLowerCase() === "healthy"
              ? "normal"
              : ws?.health?.toLowerCase() === "stale"
              ? "unplanned downtime"
              : ws?.health?.toLowerCase() === "disconnected"
              ? "alarm"
              : "planned downtime";

          return (
            <Link key={m._id} to={`/app/machine?machineId=${m._id}`}>
              <BigMachineCard
                machine={m}
                currentState={currentState}
                liveKw={liveKw[m._id] || 0}
              />
            </Link>
          );
        })}
        {machines.length === 0 && (
          <p className="text-gray-400 col-span-full">No machines connected.</p>
        )}
      </div>

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="rounded-xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-800 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
            Utilization leaderboard
          </div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-700">
              {leaderboard.map((m, i) => {
                const u = getMachineUtilization(m._id);
                return (
                  <tr key={m._id} className="hover:bg-gray-800">
                    <td className="px-4 py-2 text-gray-500 font-mono w-8">{i + 1}</td>
                    <td className="px-4 py-2 font-medium">{m.name}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 rounded-full bg-gray-700 overflow-hidden">
                          <div
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${u.runtimePct}%` }}
                          />
                        </div>
                        <span className="font-bold tabular-nums w-10 text-right">{u.runtimePct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-gray-400 tabular-nums text-right">{u.cycles} cycles</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
