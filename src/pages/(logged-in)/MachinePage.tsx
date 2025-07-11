import { Link, useParams } from "react-router-dom";
import GradientChart from "@/lib/components/machine/GradientChart";
import MachineStatsCard from "@/lib/components/machine/MachineStatsCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/lib/components/ui/card";
import { Button } from "@/lib/components/ui/button";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import ErrorCard from "@/lib/components/machine/ErrorCard";
import { useEffect } from "react";
import { getCompanyDetails } from "@/lib/api/company";
import { useState } from "react";


export default function MachinePage() {
  const [machine, setMachine] = useState<any>(null); // Stan na przechowywanie danych firmy

  const { id } = useParams<{ id: string }>();
  let line: string;
  let machineId: string;

  if (id) {
    line = id.slice(0, 1);
    machineId = id.slice(1);
  }

  useEffect(() => {
    const fetchMachinesData = async () => {
      try {
        const machineData = await getCompanyDetails(0);
        if (machineData && !machineData.error) {
          setMachine(machineData.production_lines[line].machines[0]);
          console.log(machineData.production_lines[line].machines[0]);
        }
      } catch (error) {
        console.error("Error fetching company data:", error);
      }
    };
    fetchMachinesData();
  }, []);

  // const machine = machinesData.find((m) => m.machine_id === Number(id));
  console.log(machine);
  if (!machine) {
    return <h1>Maszyna nie znaleziona</h1>;
  }

  return (
    <div className="w-full flex flex-col">
      <h1 className="text-3xl font-medium p-2 px-0">Machine ID: {id}</h1>
      <MachineStatsCard />
      <div className="grid grid-cols-5 gap-8 h-[30rem]">
        <div className="col-span-4">
          <GradientChart data={machine.dataset} />
        </div>
        <Card className="col-span-1 h-[30rem]">
          <CardHeader>
            <CardTitle className="items-center grid grid-cols-2 ">
              Recent Raports
              <Link to="/report">
                <Button className="rounded bg-predic dark:bg-predic text-white dark:text-white">
                  Report Machine
                </Button>
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="flex flex-col gap-4 overflow-y-auto h-[24rem]">
              {/* TUTAJ MAPOWANIE PO UZYSKANIU API */}
              <ErrorCard
                machineId={7}
                isWarning={true}
                message={
                  "The effectiveness of machine is dropping. Action required"
                }
              />
              <ErrorCard
                machineId={7}
                isWarning={false}
                message={
                  "some kind of a warning, some kind of a warning, some kind of a warning. "
                }
              />
              <ErrorCard
                machineId={7}
                isWarning={true}
                message={
                  "The effectiveness of machine is dropping. Action required"
                }
              />
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
