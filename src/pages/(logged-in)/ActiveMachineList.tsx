import { useState, useEffect } from "react";
import AddMachineCard from "@/lib/components/machineList/AddMachineCard";
import MachineCard from "@/lib/components/machineList/MachineCard";
import StatsCard from "@/lib/components/machineList/StatsCard";
import { useAuth } from "@/context/AuthContext";
import { ToastAction } from "@/lib/components/ui/toast";
import { useToast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/lib/components/ui/toaster";
import { addLine } from "@/lib/api/lineApi";
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
      // Clear the input after adding
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
         {machines?.map((machine) => (
           <div key={machine._id} className="w-1/5 min-w-[220px]">
             <MachineListElement
               name={machine.name}
               _id={machine._id}
               key={machine._id}
               status="running" // Placeholder, replace with actual status if available
               liveKw={50} // Placeholder, replace with actual liveKw if available
             />
           </div>
         ))}
         <div className="absolute bottom-2 right-2 p-4 bg-white dark:bg-zinc-800 w-full text-right">
          Total power consumption: {machines?.reduce((acc, machine) => acc + machine.liveKw, 0) || 0} kW
         </div>
    </div>
  );
}
