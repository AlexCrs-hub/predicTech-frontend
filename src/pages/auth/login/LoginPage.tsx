import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Button } from "@/lib/components/ui/button";
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
    <div className="bg-gradient-to-r from-[#1F35EB] to-[#D56FDF] h-screen flex justify-center items-center">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-white p-6 rounded-lg w-full max-w-sm flex flex-col gap-1"
      >
        <h1 className="text-xl font-bold mb-3">Log in to PredicTech</h1>

        {/* server-side error banner */}
        {serverError && (
          <div className="flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2 mb-1">
            <span className="text-red-500 mt-0.5 shrink-0">✕</span>
            <p className="text-sm text-red-700">{serverError}</p>
          </div>
        )}

        {/* email */}
        <div className="flex flex-col gap-1">
          <input
            {...form.register("email")}
            placeholder="Email"
            autoComplete="email"
            className={`border rounded-md p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.email ? "border-red-400 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.email && (
            <p className="text-xs text-red-600">{errors.email.message}</p>
          )}
        </div>

        {/* password */}
        <div className="flex flex-col gap-1">
          <input
            {...form.register("password")}
            type="password"
            placeholder="Password"
            autoComplete="current-password"
            className={`border rounded-md p-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.password ? "border-red-400 bg-red-50" : "border-gray-300"
            }`}
          />
          {errors.password && (
            <p className="text-xs text-red-600">{errors.password.message}</p>
          )}
        </div>

        <Button type="submit" disabled={loading} className="w-full mt-3">
          {loading ? "Logging in…" : "Login"}
        </Button>
      </form>
    </div>
  );
}
