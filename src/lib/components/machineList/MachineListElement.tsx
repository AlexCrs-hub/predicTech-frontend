import { useState } from "react";
import { Button } from "../ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
type Machine = {
  name: string;
  _id: string;
  onDelete: (id: string) => void;
  navigate: (path: string) => void;
};
export default function MachineListElement({ name, _id, onDelete, navigate }: Machine) {

  const [expanded, setExpanded] = useState(false);

  const handleDelete = async () => {
    try {
      onDelete(_id);
    } catch (error) {
      console.error("Error deleting machine:", error);
    }
  };

  const goToSensors = () => {
    navigate(`/app/sensors?machineId=${_id}`);
  }

  return (
    <div className="w-full">
      <div className="grid w-full border rounded p-4 items-center mb-4 grid-cols-5">
        <span className="w-full text-start">{name}</span>
        <span className="w-full text-center">50</span>
        <div className="w-full flex items-center justify-center">
          <span className="bg-teal-500 px-2 rounded text-center text-white font-semibold">
            In Progress
          </span>
        </div>
        <span className="w-full text-center">5h 32m</span>
        <div className="w-full flex items-center justify-end space-x-4">
          <Button className="rounded bg-predic" onClick={handleDelete}>
            Delete
          </Button>
          <Button className="rounded bg-predic" onClick={goToSensors}>
            Sensors
          </Button>
          <Button onClick={() => setExpanded(!expanded)}  className="p-0 m-0 bg-transparent hover:bg-transparent focus:outline-none border-none shadow-none">
            {expanded ? <ChevronUp size={18} color="black"/> : <ChevronDown size={18} color="black"/>}
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border border-t-0 rounded-b px-4 py-2 bg-gray-50 text-sm text-gray-700 mb-4">
          <p>Downtime: <strong> 2% </strong> today</p>
          <p>Maintenance in <strong> 15 days </strong></p>
        </div>
      )}
    </div>
  );
}
