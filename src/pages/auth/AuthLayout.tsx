import { Link } from "react-router-dom";
import predicTech from "@/lib/assets/logo_predic.svg";

export default function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-r from-[#1F35EB] to-[#D56FDF] flex flex-col items-center justify-center px-4 py-10">
      <Link to="/" className="flex items-center gap-2 mb-6 text-white">
        <img src={predicTech} className="w-9" alt="" />
        <span className="text-2xl font-semibold">PredicTech</span>
      </Link>
      <div className="w-full max-w-sm rounded-xl bg-card text-card-foreground shadow-2xl border p-6 sm:p-7">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-sm text-white/90">{footer}</div>}
    </div>
  );
}
