import { fetchMachineById } from "@/lib/api/machineApi";
import MachineDetails from "@/lib/components/machine/MachineDetails";
import MachineSensors from "@/lib/components/machine/MachineSensors";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";



export default function MachinePage() {
  const [machine, setMachine] = useState(null);
  const [error, setError] = useState("");
  const { search } = useLocation();
  const queryParams = new URLSearchParams(search);
  const machineId = queryParams.get("machineId") || "";
  const halfHeight = true;

  useEffect(() => {
    const fetchMachine = async () => {
      const response = await fetchMachineById(machineId);
      if(response.error){
        setError(response.error);
        return;
      }
      setMachine(response.machine || null);
    };
    fetchMachine();
  }, [machineId]);

  return (
    <div className="w-full grid grid-cols-2 gap-4 p-4">
      {error !== "" && <div className="col-span-2 text-red-500">{error}</div>}
      <MachineDetails machine={machine} />
      <MachineSensors machineId={machineId} halfHeight={halfHeight}/>
    </div>
  );
}
