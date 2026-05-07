import { Machine } from "../machineList/types";

type MachineHeaderProps = {
  machine: Machine | null;
  status: Machine["status"];
  currentState: Machine["currentState"];
};

const STATUS_STYLES: Record<Machine["status"], string> = {
  on: "bg-green-500 text-white",
  off: "bg-red-500 text-white",
  idle: "bg-yellow-400 text-gray-900",
};

const STATE_STYLES: Record<Machine["currentState"], string> = {
  normal: "bg-green-100 text-green-800 border border-green-300",
  alarm: "bg-red-100 text-red-800 border border-red-300",
  "unplanned downtime":
    "bg-orange-100 text-orange-800 border border-orange-300",
  "planned downtime": "bg-gray-100 text-gray-700 border border-gray-300",
};

export default function MachineHeader({
  machine,
  status,
  currentState,
}: MachineHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-5 border bg-card shadow-sm">
      <h1 className="text-2xl font-bold tracking-tight">
        {machine ? (
          machine.name
        ) : (
          <span className="text-muted-foreground animate-pulse">Loading…</span>
        )}
      </h1>
      <div className="flex items-center gap-3">
        <span
          className={`px-3 py-1 rounded-full text-sm font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
        >
          {status}
        </span>
        <span
          className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${STATE_STYLES[currentState]}`}
        >
          {currentState}
        </span>
      </div>
    </div>
  );
}
