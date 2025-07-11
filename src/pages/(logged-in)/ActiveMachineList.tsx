import { useState, useEffect } from "react";
import AddMachineCard from "@/lib/components/machineList/AddMachineCard";
import MachineCard from "@/lib/components/machineList/MachineCard";
import StatsCard from "@/lib/components/machineList/StatsCard";
import { useAuth } from "@/context/AuthContext";
import { ToastAction } from "@/lib/components/ui/toast";
import { useToast } from "@/lib/hooks/use-toast";
import { Toaster } from "@/lib/components/ui/toaster";

type Machine = {
  id: string;
};

export default function ActiveMachineList() {
  const [lines, setLines] = useState<string[]>([]);
  const [selectedLine, setSelectedLine] = useState<string>("");
  const [newLineName, setNewLineName] = useState<string>(""); // Nowy input
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
        const userId = userData?.user._id;

        if (!selectedLine || !userId) {
          setError("Name and userId are required");
          setLoading(false);
          return;
        }

        const requestBody = { name: selectedLine, userId };

        const response = await fetch(
          "https://localhost:8081/api/lines",
          {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          }
        );

        const data = await response.json();

        if (response.status == 409) {
          setMessage("Line with this name already exists for this user");
          setTitleMessage("Error adding line:");
        }

        if (!response.ok) {
          throw new Error(
            data.message || `HTTP error! Status: ${response.status}`
          );
        }

        setMachines(data);
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
    <div className="gap-8 flex flex-col">
      <StatsCard />
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="New line name"
          value={newLineName}
          onChange={handleNewLineNameChange}
          className="border border-gray-300 rounded-lg p-2 text-sm dark:bg-gray-700 dark:text-white"
        />

        <button
          onClick={() => {
            toast({
              title: titleMessage,
              description: message,
            }),
              handleAddLine,
              setSelectedLine(newLineName);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          Add line
        </button>
      </div>
      <Toaster />
      <div className="grid gap-8 grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <AddMachineCard />
      </div>
    </div>
  );
}
