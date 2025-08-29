import { Machine } from "../machineList/types";
import MachineMetrics from "./MachineMetrics";

export default function MachineDetails(props: { machine: Machine | null }) {
  const { machine } = props;
  if (!machine) {
    return <div>Loading...</div>;
  }

  const machineStatus = "Idle";
  const statusColor =
    machine.status === "running"
      ? "bg-green-500"
      : machine.status === "stopped"
      ? "bg-red-500"
      : "bg-yellow-500";

  let stateColor = "";
  const machineState = "Running"
  switch (machine.currentState) {
    case "alarm":
      stateColor = "bg-red-300 dark:bg-red-900";
      break;
    case "unplanned downtime":
      stateColor = "bg-orange-300 dark:bg-orange-900";
      break;
    case "planned downtime":
      stateColor = "bg-gray-300 dark:bg-gray-900";
      break;
    default:
      stateColor = "bg-green-300 dark:bg-green-900";
  }
  return (
    <div className="w-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">{machine.name}</h1>
      <p className="mb-2">ID: {machine._id}</p>
      <div className="flex gap-4 mb-4">
        <div className={`px-3 py-1 rounded text-white text-sm font-semibold ${statusColor}`}>
          {machineStatus}
        </div>
        <div className={`px-3 py-1 rounded text-white text-sm font-semibold ${stateColor}`}>
          {machineState}
        </div>
      </div>
      <p className="mb-2">Live kW: 50</p>
      <p className="mb-2">Efficiency: 55%</p>
      <MachineMetrics />
    </div>
  );
}