import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/lib/components/ui/card";
import MachineInputForm from "@/lib/components/forms/MachineInputForm";

export default function AddMachinePage() {
  return (
    <div className="flex w-full max-h-screen h-full items-center justify-center border">
      <Card className=" h-[38rem] w-full p-2 flex flex-col items-end">
        <CardHeader className="font-medium text-center h-16 text-lg w-full">
          <CardTitle className="flex items-center justify-center">
            <h2>Add new connection</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex w-full p-0 items-center justify-center h-full">
          <MachineInputForm />
        </CardContent>
      </Card>
    </div>
  );
}
