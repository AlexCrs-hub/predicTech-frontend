import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { CircleX, CircleAlert } from "lucide-react";

export default function ErrorCard({machineName, isWarning, message} : {machineName: string, isWarning: boolean, message: string}) {
    const title = isWarning ? "WARNING" : "ERROR";
    const icon = isWarning ? <CircleAlert className="size-6" /> : <CircleX className="size-6" />;

    return (
      <Card className={isWarning ? "bg-yellow-200 border-2 dark:bg-yellow-600 dark:border-yellow-800 border-yellow-300" : "bg-rose-200 border-2 border-rose-300 dark:bg-red-600 dark:border-red-800"}>
        <CardHeader className="p-3">
          <CardTitle className="flex gap-1 items-center justify-start w-full">
            {icon} {title} {machineName}
          </CardTitle>
        </CardHeader>
        <CardContent>{message}</CardContent>
      </Card>
    );
}
