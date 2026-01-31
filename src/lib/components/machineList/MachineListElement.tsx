import { Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Link } from "react-router-dom";
import { Machine } from "./types";

export default function MachineListElement({ name, _id, liveKw, status, currentState }: Machine) {

  const statusColor =
    status === "on"
      ? "bg-green-500"
      : status === "off"
      ? "bg-red-500"
      : "bg-yellow-500";

  let currentStateColor = "";

  switch (currentState) {
    case "alarm":
      currentStateColor = "dark:bg-red-900 bg-red-300";
      break;
    case "unplanned downtime":
      currentStateColor = "dark:bg-orange-900 bg-orange-300";
      break;
    case "planned downtime":
      currentStateColor = "dark:bg-gray-900 bg-gray-300";
      break;
    default:
      currentStateColor = "dark:bg-green-900 bg-green-300";
  }

  return (
    <>
      <Link to={`/app/machine?machineId=${_id}`}>
        <Card className={`relative ${currentStateColor} border-zinc-400 w-full mb-4`}>
          <CardHeader className="flex flex-row justify-between items-center">
            <CardTitle className="text-xl">{name}</CardTitle>
            <Zap className="size-6 stroke-predic" />
          </CardHeader>
          <CardContent className="flex flex-col">
            <span>
              Live KW: {liveKw}
            </span>
            <span>
              Efficiency: 55% {/* Placeholder for efficiency, replace with actual logic once that can be done*/}
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
