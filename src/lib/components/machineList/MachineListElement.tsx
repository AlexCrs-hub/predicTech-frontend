import { Button } from "../ui/button";
type Machine = {
  name: string;
  _id: string;
  onDelete: (id: string) => void;
  navigate: (path: string) => void;
};
export default function MachineListElement({ name, _id, onDelete, navigate }: Machine) {
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
      </div>
    </div>
  );
}
