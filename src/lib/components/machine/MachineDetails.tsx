import { Machine } from "../machineList/types";
import MachineMetrics from "./MachineMetrics";

type MachineDetailsProps = {
  machine: Machine | null;
  status: Machine["status"];
  currentState: Machine["currentState"];
  liveKw: number;
};

export default function MachineDetails(props: MachineDetailsProps) {
  const { machine, status, currentState, liveKw } = props;
  if (!machine) {
    return <div>Loading...</div>;
  }

  const statusColor =
    status === "on"
      ? "bg-green-500"
      : status === "off"
      ? "bg-red-500"
      : "bg-yellow-500";

  let stateColor = "";
  switch (currentState) {
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
      <div className="flex gap-4 mb-4">
        <div className={`px-3 py-1 rounded text-white text-sm font-semibold ${statusColor}`}>
          {status.toUpperCase()}
        </div>
        <div className={`px-3 py-1 rounded text-white text-sm font-semibold ${stateColor}`}>
          {currentState}
        </div>
      </div>
      <p className="mb-2">Live kW: {liveKw.toFixed(2)}</p>
      <p className="mb-2">Max kW: {machine.maxPowerConsumption ?? "N/A"}</p>
      {/* <p className="mb-2">Efficiency: 55%</p> */}
      <MachineMetrics id={machine._id} />
    </div>
  );
}
