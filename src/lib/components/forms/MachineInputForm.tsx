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
import { useAuth } from "@/context/AuthContext";


const FormSchema = z.object({
  machine_name: z
    .string()
    .min(2, { message: "Machine name must be at least 2 characters." }),
  max_power: z
    .coerce.number()
    .min(1, { message: "Max power consumption must be at least 1 KW." }),
});

export default function MachineInputForm() {

  const [loading, setLoading] = useState(false);
  const [machineName, setMachineName] = useState(""); // stan dla machine_name;
  const [maxPowerConsumption, setMaxPowerConsumption] = useState(0);
  const userId = useAuth().getUser()?.user._id || "";

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      machine_name: "",
      max_power: 0,
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    console.log(
      "Final payload:",
      JSON.stringify({ machine_name: data.machine_name, max_power: data.max_power })
    );

    try {
      setLoading(true);
      const response = await addMachine(
        data.machine_name,
        data.max_power,
        userId
      );

      console.log(
        "Sending request to:",
        `https://localhost:8081/api/machines`
      );
      console.log(
        "Request body:",
        JSON.stringify({ machine_name: data.machine_name, max_power: data.max_power })
      );

      if (!response.message)
      {
        setLoading(false);  
        throw new Error(response.error || "Failed to add machine.");
      }

      toast({
        title: "Success",
        description: "Machine has been added successfully!",
      });

      form.reset();
    } catch (error) {
      setLoading(false);  
      console.error("Fetch error: ", error);
      toast({
        title: "Error",
        description: "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

        <FormField
          control={form.control}
          name="max_power"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Max Power Consumption (KW)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Enter max power consumption"
                  {...field}
                  value={maxPowerConsumption}
                  onChange={(e) => {
                    setMaxPowerConsumption(Number(e.target.value));
                    field.onChange(e.target.value);
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
