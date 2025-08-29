"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "@/lib/hooks/use-toast";
import { Button } from "@/lib/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/lib/components/ui/form";
import { Input } from "@/lib/components/ui/input";
import { Toaster } from "../ui/toaster";
import jsPDF from "jspdf";
import { useState, useEffect } from "react";
import { fetchAllMachines, getMachineReport } from "@/lib/api/machineApi";

const FormSchema = z.object({
  machine_id: z
    .string()
    .min(1, { message: "Machine is required." }),
  startDate: z.string().min(1, { message: "Start date is required." }),
  endDate: z.string().min(1, { message: "End date is required." }),
});

export default function MachineReportForm() {

  const [machines, setMachines] = useState<{ _id: string; name: string }[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      machine_id: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    // const doc = new jsPDF();
    // doc.setFontSize(16);
    // doc.text("Machine Report", 10, 15);
    // doc.setFontSize(12);
    // toast({
    //   title: "Form submitted",
    //   description: "Your report has been sent successfully.",
    // });
    // console.log(data);
    const { machine_id, startDate, endDate } = data;
    const response = await getMachineReport(machine_id, startDate, endDate);
  }

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        setLoadingMachines(true);
        const response = await fetchAllMachines();
        if(!response || !response.machines) {
          throw new Error("No machines found");
        }
        setMachines(response.machines);
      } catch (error) {
        console.error("Error fetching machines:", error);
      } finally {
        setLoadingMachines(false);
      }
    };
    fetchMachines();
  }, []);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-2/3 space-y-6 flex flex-col items-center"
      >
        <FormField
                control={form.control}
                name="machine_id"
                render={({ field }) => (
                <FormItem className="w-full">
                    <FormLabel>Machine</FormLabel>
                    <FormControl>
                    <select
                        {...field}
                        className="border rounded-lg p-2 w-full bg-white"
                        onChange={(e) => field.onChange(e.target.value)}
                        value={field.value}
                    >
                        <option value="" disabled>
                        {loadingMachines ? "Loading..." : "Select a machine"}
                        </option>
                        {!loadingMachines &&
                        machines.map((machine) => (
                            <option key={machine._id} value={machine._id}>
                                {machine.name}
                            </option>
                        ))}
                    </select>
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
          />
        <FormField
          control={form.control}
          name="startDate"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Start Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  placeholder="Define start date"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="endDate"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>End Date</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  placeholder="Define end date"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
      <Toaster />
    </Form>
  );
}
