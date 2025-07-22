import { Machine } from "../machineList/types";

export default function MachineDetails(props: { machine: Machine | null }) {
  const { machine } = props;
    if (!machine) {
        return <div>Loading...</div>;
    }
  return (
    <div className="w-full flex flex-col">
      <h1 className="text-2xl font-bold mb-4">{machine.name}</h1>
      <p className="mb-2">ID: {machine._id}</p>
      <p className="mb-2">Productivity: 123123</p>
      <p className="mb-2">Metrics: Add metrics</p>
      <p className="mb-2">More Metrics: Add metrics</p>
    </div>
  );
}