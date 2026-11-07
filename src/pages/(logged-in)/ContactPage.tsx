import { Mail } from "lucide-react";
import { PageHeader } from "@/lib/components/ui/field";

const CONTACT_EMAIL = "ykhader05@gmail.com";

export default function ContactPage() {
  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <PageHeader title="Contact" description="Questions, feedback or a problem with PredicTech? Get in touch." />
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="group flex items-center gap-4 rounded-xl border border-border bg-card shadow-sm p-5 hover:border-blue-300 dark:hover:border-blue-800 transition-colors"
      >
        <span className="w-11 h-11 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
          <Mail className="size-5" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-muted-foreground">Email</span>
          <span className="block text-base font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
            {CONTACT_EMAIL}
          </span>
        </span>
      </a>
    </div>
  );
}
