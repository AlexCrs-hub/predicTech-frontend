import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Field } from "@/lib/components/ui/field";
import { inputClass, inputStateClass, primaryButtonClass } from "@/lib/components/ui/fieldStyles";
import AuthLayout from "../AuthLayout";
import { loginUser } from "@/lib/api/authApi";

const FormSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z
    .string()
    .min(6, { message: "Password must be at least 6 characters." }),
});

export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: "", password: "" },
  });

  const navigate = useNavigate();

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    setServerError("");
    setLoading(true);
    try {
      const response = await loginUser(data.email, data.password);

      if (response.success) {
        login(response);
        toast({ title: "Logged in successfully", description: "Redirecting…" });
        setTimeout(() => navigate("/app"), 1000);
      } else {
        setServerError(response.message || "Invalid email or password.");
      }
    } catch {
      setServerError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const { errors } = form.formState;

  return (
    <AuthLayout
      title="Log in"
      subtitle="Welcome back — sign in to your workspace."
      footer={
        <>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-white underline underline-offset-2">
            Register
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

        <Field label="Email" htmlFor="login-email" error={errors.email?.message}>
          <input
            id="login-email"
            {...form.register("email")}
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            className={`${inputClass} ${inputStateClass(!!errors.email)}`}
          />
        </Field>

        <Field label="Password" htmlFor="login-password" error={errors.password?.message}>
          <input
            id="login-password"
            {...form.register("password")}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            className={`${inputClass} ${inputStateClass(!!errors.password)}`}
          />
        </Field>

        <button type="submit" disabled={loading} className={`${primaryButtonClass} w-full mt-2`}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>
    </AuthLayout>
  );
}
