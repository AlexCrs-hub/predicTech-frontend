import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/lib/hooks/use-toast";
import { fetchAllMachines } from "@/lib/api/machineApi";
import MachineListElement from "@/lib/components/machineList/MachineListElement";
import { Machine } from "@/lib/components/machineList/types";

export default function ActiveMachineList() {
  const [lines, setLines] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [newLineName, setNewLineName] = useState<string>("");
  const [machines, setMachines] = useState<Machine[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [titleMessage, setTitleMessage] = useState("");

  const handleLineChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLine(event.target.value);
  };

  const handleNewLineNameChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setNewLineName(event.target.value);
  };

  const handleAddLine = () => {
    if (newLineName && !lines.includes(newLineName)) {
      setLines([...lines, newLineName]);
      setSelectedLine(newLineName);
      setTitleMessage("New line added successfully!");
      setNewLineName("");
    }
  };

  const { getUser } = useAuth();
  const userData = getUser();
  useEffect(() => {
    const fetchMachines = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchAllMachines();
        const data = response;
        setMachines(data.machines);
        setTitleMessage("Successfully added new line!");
        setMessage("");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchMachines();
  }, [selectedLine]);

  return (
   <div className="flex flex-wrap gap-6">
         {machines?.map((machine) => {

          const statuses = ["running", "stopped", "idle"];
          const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
          const currentStates = ["alarm", "normal", "unplanned downtime", "planned downtime"];
          const randomCurrentState = currentStates[Math.floor(Math.random() * currentStates.length)];

          return (
           <div key={machine._id} className="w-1/5 min-w-[220px]">
             <MachineListElement
               name={machine.name}
               _id={machine._id}
               key={machine._id}
               status={randomStatus}
               currentState={randomCurrentState}
               liveKw={50} // Placeholder, replace with actual liveKw if available
             />
           </div>)
          })}
        <div className="absolute bottom-2 right-2 p-4 bg-white dark:bg-zinc-800 w-full text-right">
          <div className="flex justify-end gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-green-300 dark:bg-green-900"></div>
              <span className="text-sm">On</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-300 dark:bg-red-900"></div>
              <span className="text-sm">Off</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-300 dark:bg-yellow-900"></div>
              <span className="text-sm">Idle</span>
            </div>
          </div>
          <div className="flex justify-end gap-4 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-green-300 dark:bg-green-900"></div>
              <span className="text-sm">Running</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-red-300 dark:bg-red-900"></div>
              <span className="text-sm">Alarm</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-orange-300 dark:bg-orange-500"></div>
              <span className="text-sm">Unplanned Downtime</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm bg-gray-300 dark:bg-gray-900"></div>
              <span className="text-sm">Planned Downtime</span>
            </div>
          </div>
          <span className="font-semibold">
            Total power consumption: {machines?.reduce((acc, machine) => acc + 50, 0) || 0} kW
          </span>
        </div>
    </div>
  );
}
