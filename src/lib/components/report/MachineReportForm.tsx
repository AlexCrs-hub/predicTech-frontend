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

const FormSchema = z.object({
  machineName: z.string().min(2).max(100),
  warning: z.string().min(2,{
    message: "Invalid warning message.",
  }).max(100),
  messageText: z.string().min(6, {
    message: "Reason of report must be at least 6 characters.",
  }),
});

export default function MachineReportForm() {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      machineName: "",
      warning: "",
      messageText: "",
    },
  });

  function onSubmit(data: z.infer<typeof FormSchema>) {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Machine Report", 10, 15);
    doc.setFontSize(12);
    doc.text(`Machine Name: ${data.machineName}`, 10, 30);
    doc.text(`Warning: ${data.warning}`, 10, 40);
    doc.text(`Message: ${data.messageText}`, 10, 50);
    doc.text(data.messageText, 10, 60, { maxWidth: 180 });
    doc.save(`machine_report_${data.machineName}.pdf`);
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
          name="machineName"
          render={({ field }) => (
            <FormItem className="w-full">
              <FormLabel>Machine Name</FormLabel>
              <FormControl>
                <Input placeholder="Machine Name" {...field} />
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
