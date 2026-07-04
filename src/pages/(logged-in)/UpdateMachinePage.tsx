import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/lib/components/ui/card";
import MachineUpdateForm from "@/lib/components/forms/MachineUpdateForm";

export default function UpdateMachinePage() {
  return (
    <div className="flex w-full max-h-screen h-full items-center justify-center border">
      <Card className=" h-[38rem] w-full p-2 flex flex-col items-end">
        <CardHeader className="font-medium text-center h-16 text-lg w-full">
          <CardTitle className="flex items-center justify-center">
            <h2>Update machine</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex w-full p-0 items-center justify-center h-full overflow-y-auto">
          <MachineUpdateForm />
        </CardContent>
      </Card>
    </div>
  );
}
