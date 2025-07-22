import { Machine } from "../machineList/types";

export default function MachineDetails(props: { machine: Machine | null }) {
  const { machine } = props;
    if (!machine) {
        return <div>Loading...</div>;
    }
  return (
    <div className="w-full flex flex-col">
    </div>
  );
}