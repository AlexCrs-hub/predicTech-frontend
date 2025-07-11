import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/lib/components/ui/form";
import { Input } from "@/lib/components/ui/input";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Toaster } from "@/lib/components/ui/toaster";
import { Button } from "@/lib/components/ui/button";
import { useState } from "react";
import { registerUser } from "@/lib/api/authApi";

// Schemat walidacji
const FormSchema = z
  .object({
    name: z.string().min(2, { message: "Name must be at least 2 characters." }),
    email: z.string().email({ message: "Invalid email address." }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
    repeatPassword: z
      .string()
      .min(6, { message: "Password must be at least 6 characters." }),
  })
  .refine((data) => data.password === data.repeatPassword, {
    message: "Passwords do not match.",
    path: ["repeatPassword"],
  });

export default function RegisterPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      repeatPassword: "",
    },
  });

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setIsLoading(true);

    try {
      const response = await registerUser(
        data.email,
        data.name,
        data.password
      );

      if (!response.success) {
        const errorData = await response.message;
        console.error("Backend error:", errorData);
        throw new Error(errorData.error || "Something went wrong.");
      }

      toast({
        title: "Success!",
        description: "Account created successfully.",
      });
      navigate("/login");
    } catch (error) {
      console.error("Błąd rejestracji:", error);
      toast({ title: "Error", description: "lol", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-gradient-to-r from-[#1F35EB] to-[#D56FDF] h-screen flex items-center justify-center">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-1/4 pb-8 space-y-3 flex flex-col items-center bg-white rounded-xl border border-white/30 backdrop-blur-sm p-4"
        >
          <h1 className="text-3xl font-medium text-black/60">Register to</h1>
          <h1 className="text-4xl font-medium pb-4">PredicTech</h1>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="text-center w-3/5">
                <FormLabel className="text-lg">Email</FormLabel>
                <FormControl>
                  <Input
                    className="placeholder:text-black/50 rounded"
                    placeholder="example1@example.com"
                    {...field}
                    type="email"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem className="text-center w-3/5">
                <FormLabel className="text-lg">Name</FormLabel>
                <FormControl>
                  <Input
                    className="placeholder:text-black/50 rounded"
                    placeholder="Michal"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem className="text-center w-3/5">
                <FormLabel className="text-lg">Password</FormLabel>
                <FormControl>
                  <Input
                    className="placeholder:text-black/50 rounded"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="repeatPassword"
            render={({ field }) => (
              <FormItem className="text-center w-3/5">
                <FormLabel className="text-lg">Repeat Password</FormLabel>
                <FormControl>
                  <Input
                    className="placeholder:text-black/50 rounded"
                    type="password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="w-3/5 justify-between flex gap-4">
            <Button
              type="submit"
              className="w-1/2 rounded bg-predic hover:bg-predic/80 text-white h-10"
              disabled={isLoading}
            >
              {isLoading ? "Registering..." : "Submit"}
            </Button>
            <Link
              to="/login"
              className="w-1/2 rounded h-10 bg-predic text-white hover:bg-predic/80 duration-100 flex items-center justify-center text-sm font-medium"
            >
              Sign in
            </Link>
          </div>
        </form>
      </Form>
      <Toaster />
    </div>
  );
}
