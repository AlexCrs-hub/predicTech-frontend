import { Machine } from "../machineList/types";
import MachineMetrics from "./MachineMetrics";

type MachineDetailsProps = {
  machine: Machine | null;
  liveKw: number;
};

export default function MachineDetails(props: MachineDetailsProps) {
  const { machine, liveKw } = props;
  if (!machine) {
    return <div>Loading...</div>;
  }

  return (
    <div className="w-full flex flex-col justify-center">
      <p className="mb-2">Live kW: {liveKw.toFixed(2)}</p>
      <p className="mb-2">Max kW: {machine.maxPowerConsumption ?? "N/A"}</p>
      {/* <MachineMetrics id={machine._id} /> */}
      {/* <p className="mb-2">Efficiency: 55%</p> */}
    </div>
  );
}
