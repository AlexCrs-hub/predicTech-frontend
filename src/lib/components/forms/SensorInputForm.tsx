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
import { useEffect, useState } from "react";


const FormSchema = z.object({
    line_id: z.string().min(1, { message: "Production line is required." }),
    machine_id: z
        .string()
        .min(1, { message: "Machine is required." }),
    sensor_name: z
        .string()
        .min(2, { message: "Sensor name must be at least 2 characters." }),
});

export default function SensorInputForm() {
    const [lines, setLines] = useState<{ _id: string; name: string }[]>([]);
    const [machines, setMachines] = useState<{ _id: string; name: string }[]>([]);
    const [loadingLines, setLoadingLines] = useState(true);
    const [loadingMachines, setLoadingMachines] = useState(false);

    const form = useForm<z.infer<typeof FormSchema>>({
        resolver: zodResolver(FormSchema),
        defaultValues: {
        line_id: "",
        machine_id: "",
        sensor_name: "",
        },
    });

    useEffect(() => {
        const fetchLines = async () => {
        try {
            const response = await fetch(
            "https://localhost:8081/api/lines",
            { credentials: "include" }
            );

            const data = await response.json();

            setLines(data.data);
        } catch (error) {
            console.error("Error fetching lines:", error);
        } finally {
            setLoadingLines(false);
        }
        };
        fetchLines();
    }, []);

    // fetch machines based on selected line
    useEffect(() => {
        const lineId = form.watch("line_id");
        if (!lineId) {
        setMachines([]);
        form.setValue("machine_id", "");
        return;
        }
        setLoadingMachines(true);
        const fetchMachines = async () => {
            try{
                const response = await fetch(
                    `https://localhost:8081/api/machines/line/${lineId}`,
                    { credentials: "include" }
                );
                const data = await response.json();
                console.log("Fetched machines:", data.machines);
                setMachines(data.machines || []);
                form.setValue("machine_id", ""); // Reset machine_id when line changes
            } catch (error) {
                console.error("Error fetching machines:", error);
                setMachines([]);
            } finally {
                setLoadingMachines(false);
            }
        }
        fetchMachines();
    }, [form.watch("line_id")]);
  

    async function onSubmit(data: z.infer<typeof FormSchema>) {
        console.log(
        "Final payload:",
        JSON.stringify({ name: data.sensor_name,  machine: data.machine_id })
        );

        try {
        const response = await fetch(
            `https://localhost:8081/api/sensors`,
            {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ name: data.sensor_name, machine: data.machine_id }),
            }
        );

        const result = await response.json();
        
        if (!response.ok)
            throw new Error(result.error || "Failed to add sensor.");

        toast({
            title: "Success",
            description: "Sensor has been added successfully!",
        });
        form.reset();
        } catch (error) {
        console.error("Fetch error: ", error);
        toast({
            title: "Error",
            description: "Something went wrong.",
            variant: "destructive",
        });
        }
    }

    return (
        <Form {...form}>
        <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="w-2/3 space-y-6 flex flex-col items-center"
        >
            <FormField
            control={form.control}
            name="line_id"
            render={({ field }) => (
                <FormItem className="w-full">
                <FormLabel>Production Line</FormLabel>
                <FormControl>
                    <select
                    {...field}
                    className="border rounded-lg p-2 w-full bg-white"
                    onChange={(e) => field.onChange(e.target.value)}
                    value={field.value}
                    >
                    <option value="" disabled>
                        {loadingLines ? "Loading..." : "Select a line"}
                    </option>
                    {!loadingLines &&
                        lines.map((line) => (
                        <option key={line._id} value={line._id}>
                            {line.name}
                        </option>
                        ))}
                    </select>
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />

            {/* Machine select, only show if line selected */}
             {form.watch("line_id") && (
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
        )}
         {/* Sensor name input, only show if machine selected */}
        {form.watch("machine_id") && (
          <FormField
            control={form.control}
            name="sensor_name"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Sensor Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Enter sensor name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <Button
          type="submit"
          disabled={loadingLines || (!!form.watch("line_id") && loadingMachines)}
        >
          Add Sensor
        </Button>
        </form>
        <Toaster />
        </Form>
    );
}
