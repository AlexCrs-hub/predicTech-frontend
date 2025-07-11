import SensorInputForm from "@/lib/components/forms/SensorInputForm";
import { Card, CardHeader, CardTitle, CardContent } from "@/lib/components/ui/card";

export default function AddSensorPage() {
    return (
        <div className="flex w-full max-h-screen h-full items-center justify-center border">
          <Card className=" h-[38rem] w-full p-2 flex flex-col items-end">
            <CardHeader className="font-medium text-center h-16 text-lg w-full">
              <CardTitle className="flex items-center justify-center">
                <h2>Add new sensor</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex w-full p-0 items-center justify-center h-full">
              <SensorInputForm />
            </CardContent>
          </Card>
        </div>
    );
}