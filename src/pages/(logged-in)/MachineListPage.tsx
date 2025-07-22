import { useState, useEffect } from "react";
import MachineListElement from "@/lib/components/machineList/MachineListElement";
import { deleteMachine, fetchAllMachines } from "@/lib/api/machineApi";
import { useLocation, useNavigate } from "react-router-dom";

type Machine = {
  name: string;
  _id: string;
};

export default function MachineListPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // const { search } = useLocation();
  // const queryParams = new URLSearchParams(search);
  // const lineId = queryParams.get("lineId") || "";
  // const navigate = useNavigate();

  useEffect(() => {
    const fetchMachines = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchAllMachines();
        const data = response;
        setMachines(data.machines);
      } catch (error) {
        console.log("Error fetching machines:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMachines();
  }, []);

  // const handleDeleteMachine = async (id: string) => {
  //   await deleteMachine(id);
  //   setMachines((prevMachines) =>
  //     prevMachines ? prevMachines.filter((machine) => machine._id !== id) : null
  //   );
  // };

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="flex flex-wrap gap-6">
      {machines?.map((machine) => (
        <div key={machine._id} className="w-1/5 min-w-[220px]">
          <MachineListElement
            name={machine.name}
            _id={machine._id}
            key={machine._id}
            status="running" // Placeholder, replace with actual status if available
            liveKw={0} // Placeholder, replace with actual liveKw if available
          />
        </div>
      ))}
    </div>
  );
}
