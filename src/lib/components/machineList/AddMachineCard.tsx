import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/lib/components/ui/card";
import { Link } from "react-router-dom";

export default function AddMachineCard() {
  return (
    <Link to="/app/add-machine">
      <Card className="dark:bg-zinc-900 border-zinc-400 h-56">
        <CardHeader className="font-medium text-center h-16 text-lg">
          Add new connection
        </CardHeader>
        <CardContent className="flex h-36 w-full p-0">
          <button className="flex items-center w-full justify-center h-full">
            <Plus className="size-16" />
          </button>
        </CardContent>
      </Card>
    </Link>
  );
}
