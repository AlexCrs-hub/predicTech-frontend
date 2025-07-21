import { useAuth } from "@/context/AuthContext"; // Importujemy kontekst
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
  const { login } = useAuth(); // Pobieramy funkcję login z kontekstu
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: { email: "", password: "" },
  });

  const navigate = useNavigate();

  async function onSubmit(data: z.infer<typeof FormSchema>) {
    try {
      const response = await loginUser(data.email, data.password);

      if (response.success) {
        const userData = response;
        login(userData);

        toast({
          title: "Logged in successfully",
          description: "Redirecting...",
        });
        setTimeout(() => {
          navigate("/app");
        }, 1000);
      } else {
        const errorData = response.message;
        toast({
          title: "Login failed",
          description: errorData || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast({
        title: "Something went wrong",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  }

  return (
    <div className="bg-gradient-to-r from-[#1F35EB] to-[#D56FDF] h-screen flex justify-center items-center">
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="bg-white p-6 rounded-lg"
      >
        <h1 className="text-xl font-bold">Log in to PredicTech</h1>
        <input
          {...form.register("email")}
          placeholder="Email"
          className="border p-2 w-full my-2"
        />
        <input
          {...form.register("password")}
          type="password"
          placeholder="Password"
          className="border p-2 w-full my-2"
        />
        <Button type="submit" className="w-full mt-4">
          Login
        </Button>
      </form>
    </div>
  );
}
