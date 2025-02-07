"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Toaster } from "../ui/toaster";

const FormSchema = z.object({
  machineId: z.number().min(1, {
    message: "pass any number.",
  }),
  warning: z.string().email({
    message: "Invalid email address.",
  }),
  messageText: z.string().min(6, {
    message: "Password must be at least 6 characters.",
  }),
});

export default function MachineReportForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      machineId: 0,
      warning: "",
      messageText: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    toast({
      title: "Form submitted",
      description: "Your report has been sent successfully.",
    });
    console.log(data);
  }
  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="w-2/3 space-y-6 flex flex-col items-center"
      >
        <FormField
          control={form.control}
          name="machineId"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Machine ID</FormLabel>
              <FormControl>
                <Input placeholder="00" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="warning"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Error type</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Define type of warning/error"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="messageText"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  placeholder="Describe the error"
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
