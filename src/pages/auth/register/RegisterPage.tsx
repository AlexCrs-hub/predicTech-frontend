import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Toaster } from "@/lib/components/ui/toaster";
import { Field } from "@/lib/components/ui/field";
import { inputClass, inputStateClass, primaryButtonClass } from "@/lib/components/ui/fieldStyles";
import AuthLayout from "../AuthLayout";
import { useState } from "react";
import { registerUser } from "@/lib/api/authApi";

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
  const [serverError, setServerError] = useState("");

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
    setServerError("");

    try {
      const response = await registerUser(data.email, data.name, data.password);

      if (!response.success) {
        setServerError(response.message || "Registration failed. Please try again.");
        return;
      }

      toast({ title: "Account created!", description: "You can now log in." });
      navigate("/login");
    } catch {
      setServerError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const { errors } = form.formState;

  const fields = [
    { name: "name", label: "Name", type: "text", placeholder: "Your name", autoComplete: "name" },
    { name: "email", label: "Email", type: "email", placeholder: "you@company.com", autoComplete: "email" },
    { name: "password", label: "Password", type: "password", placeholder: "At least 6 characters", autoComplete: "new-password" },
    { name: "repeatPassword", label: "Repeat password", type: "password", placeholder: "••••••••", autoComplete: "new-password" },
  ] as const;

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Start monitoring your machines with PredicTech."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-white underline underline-offset-2">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {serverError && (
          <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
            {serverError}
          </div>
        )}

        {fields.map((f) => (
          <Field key={f.name} label={f.label} htmlFor={`reg-${f.name}`} error={errors[f.name]?.message}>
            <input
              id={`reg-${f.name}`}
              {...form.register(f.name)}
              type={f.type}
              placeholder={f.placeholder}
              autoComplete={f.autoComplete}
              className={`${inputClass} ${inputStateClass(!!errors[f.name])}`}
            />
          </Field>
        ))}

        <button type="submit" disabled={isLoading} className={`${primaryButtonClass} w-full mt-2`}>
          {isLoading ? "Creating account…" : "Create account"}
        </button>
      </form>
      <Toaster />
    </AuthLayout>
  );
}
