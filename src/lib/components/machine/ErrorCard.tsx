import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { CircleX, CircleAlert } from "lucide-react";

export default function ErrorCard({machineId, isWarning, message} : {machineId: number, isWarning: boolean, message: string}) {
    return isWarning ? (
      <Card className="bg-yellow-200 border-2 dark:bg-yellow-600 dark:border-yellow-800 border-yellow-300">
        <CardHeader className="p-3">
          <CardTitle className="flex gap-1 items-center justify-start w-full">
            <CircleAlert className="size-6" /> WARNING: Cutter Machine
          </CardTitle>
        </CardHeader>
        <CardContent>{message}</CardContent>
      </Card>
    ) : (
      <Card className="bg-rose-200 border-2 border-rose-300 dark:bg-red-600 dark:border-red-800">
        <CardHeader className="p-3">
          <CardTitle className="flex gap-2 items-center justify-start w-full">
            <CircleX className="size-6" /> ERROR: Assembler Machine
          </CardTitle>
        </CardHeader>
        <CardContent>{message}</CardContent>
      </Card>
    );
}
