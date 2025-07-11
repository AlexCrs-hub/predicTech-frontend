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
import { fetchUserLines } from "@/lib/api/lineApi";
import { addMachine } from "@/lib/api/machineApi";


const FormSchema = z.object({
  line_id: z.string().min(1, { message: "Production line is required." }),
  machine_name: z
    .string()
    .min(2, { message: "Machine name must be at least 2 characters." }),
});

export default function MachineInputForm() {
  const [lines, setLines] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [machineName, setMachineName] = useState(""); // stan dla machine_name

  useEffect(() => {
    const fetchLines = async () => {
      try {
        const response = await fetchUserLines();

        setLines(response.data);
      } catch (error) {
        console.error("Error fetching lines:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchLines();
  }, []);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      line_id: "",
      machine_name: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(
      "Final payload:",
      JSON.stringify({ machine_name: data.machine_name })
    );

    try {
      const response = await addMachine(
        data.line_id,
        data.machine_name
      );

      console.log(
        "Sending request to:",
        `https://localhost:8081/api/machines/line/${data.line_id}`
      );
      console.log(
        "Request body:",
        JSON.stringify({ machine_name: machineName })
      );

      if (!response.message)
        throw new Error(response.error || "Failed to add machine.");

      toast({
        title: "Success",
        description: "Machine has been added successfully!",
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
                    {loading ? "Loading..." : "Select a line"}
                  </option>
                  {!loading &&
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

        <FormField
          control={form.control}
          name="machine_name"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Machine Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter machine name"
                  {...field}
                  value={machineName} // kontrolowanie wartości przez useState
                  onChange={(e) => {
                    setMachineName(e.target.value); // aktualizacja wartości w stanie
                    field.onChange(e.target.value); // synchronizacja z react-hook-form
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={loading}>
          Add Machine
        </Button>
      </form>
      <Toaster />
    </Form>
  );
}
