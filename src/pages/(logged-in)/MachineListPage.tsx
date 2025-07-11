import { useState, useEffect } from "react";
import MachineListElement from "@/lib/components/machineList/MachineListElement";
import { deleteMachine, fetchAllMachines } from "@/lib/api/machineApi";
import { useNavigate } from "react-router-dom";

type Machine = {
  name: string;
  _id: string;
};
export default function MachineListPage() {
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

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

  const handleDeleteMachine = async (id: string) => {
    await deleteMachine(id);
    setMachines((prevMachines) =>
      prevMachines ? prevMachines.filter((machine) => machine._id !== id) : null
    );
  };

  console.log(machines);
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="gap-8 flex flex-col">
      <div className="flex gap-4 w-[10rem]"></div>
      <div className="grid">
        <div className="border rounded p-4 gap-4 flex flex-col mb-4">
          <div className="p-2 border-b">
            <h1 className="text-2xl font-semibold">Job list</h1>
          </div>
          <div className="grid w-full items-center grid-cols-5 px-10 font-medium">
            <span className="w-full text-start flex items-center justify-start">
              WO
            </span>
            <span className="w-full text-center">OP</span>
            <span className="w-full text-center">Progress</span>
            <span className="w-full text-center">Estimated</span>
            <span className="w-full text-end">Action</span>
          </div>
        </div>
        {machines?.map((machine) => (
          <MachineListElement
            name={machine.name}
            _id={machine._id}
            onDelete={handleDeleteMachine}
            navigate={navigate}
            key={machine._id}
          />
        ))}
      </div>
    </div>
  );
}
