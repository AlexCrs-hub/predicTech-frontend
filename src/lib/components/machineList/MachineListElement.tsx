import { Button } from "../ui/button";
type Machine = {
  name: string;
  _id: string;
  onDelete: (id: string) => void;
};
export default function MachineListElement({ name, _id, onDelete }: Machine) {
  const handleDelete = async () => {
    try {
      const response = await fetch(
        `https://localhost:8081/api/machines/${_id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to delete machine.");
      }

      onDelete(_id);
    } catch (error) {
      console.error("Error deleting machine:", error);
    }
  };
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
      <div className="w-full flex items-center justify-end">
        <Button className="rounded bg-predic" onClick={handleDelete}>
          Delete
        </Button>
      </div>
    </div>
  );
}
