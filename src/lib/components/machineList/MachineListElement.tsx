import { useState } from "react";
import { Button } from "../ui/button";
import { ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Link } from "react-router-dom";
import { Machine } from "./types";

export default function MachineListElement({ name, _id, liveKw, status }: Machine) {

  // const [expanded, setExpanded] = useState(false);

  // const handleDelete = async () => {
  //   try {
  //     onDelete(_id);
  //   } catch (error) {
  //     console.error("Error deleting machine:", error);
  //   }
  // };

  // const goToSensors = () => {
  //   navigate(`/app/sensors?machineId=${_id}`);
  // }
  status = "running";
  const statusColor =
    status === "running"
      ? "bg-green-500"
      : status === "stopped"
      ? "bg-red-500"
      : "bg-yellow-500";

  return (
    <>
      <Link to={`/app/machine?machineId=${_id}`}>
        <Card className="relative dark:bg-zinc-900 light:bg-zinc-300 border-zinc-400 w-full mb-4">
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-xl">{name}</CardTitle>
            <Zap className="size-6 stroke-predic" />
          </CardHeader>
          <CardContent className="flex flex-col">
            <span>
              Live KW: {liveKw}
            </span>
            <span>
              Efficiency: 55% {/* Placeholder for efficiency, replace with actual logic if needed */}
            </span>
            <div
              className={`absolute bottom-2 right-2 w-4 h-4 rounded-full ${statusColor} shadow-md animate-pulse`}
            />
          </CardContent>
        </Card>
      </Link>
    </>
  );
}
