import { useState, useEffect } from "react";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Button } from "@/lib/components/ui/button";
import { CheckCircle } from "lucide-react";

const ISSUE_TYPES = ["Hardware", "Software", "Safety", "Performance", "Other"] as const;
const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

const PRIORITY_COLOR: Record<typeof PRIORITIES[number], string> = {
  Low:      "bg-gray-100 text-gray-700 border-gray-300",
  Medium:   "bg-blue-100 text-blue-700 border-blue-300",
  High:     "bg-orange-100 text-orange-700 border-orange-300",
  Critical: "bg-red-100 text-red-700 border-red-300",
};

type FormState = {
  machineId: string;
  issueType: typeof ISSUE_TYPES[number];
  priority: typeof PRIORITIES[number];
  title: string;
  description: string;
};

const INITIAL: FormState = {
  machineId: "",
  issueType: "Hardware",
  priority: "Medium",
  title: "",
  description: "",
};

export default function ReportsPage() {
  const [machines, setMachines] = useState<{ _id: string; name: string }[]>([]);
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetchAllMachines()
      .then((res) => setMachines(Array.isArray(res?.machines) ? res.machines : []))
      .catch(() => {});
  }, []);

  const set = (field: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setForm(INITIAL);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="flex w-full justify-center items-center h-full pt-16">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <CheckCircle className="size-14 text-green-500" />
          <h2 className="text-xl font-bold">Report submitted</h2>
          <p className="text-sm text-muted-foreground">
            Your issue report has been logged. The team will review it shortly.
          </p>
          <Button variant="outline" onClick={handleReset}>Submit another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full justify-center pt-8 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg flex flex-col gap-5"
      >
        <div>
          <h1 className="text-2xl font-bold">Report an issue</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Use this form to report a problem, fault, or safety concern.
          </p>
        </div>

        {/* Machine */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Machine <span className="text-muted-foreground font-normal">(optional)</span></label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={form.machineId}
            onChange={set("machineId")}
          >
            <option value="">— No specific machine —</option>
            {machines.map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Issue type + Priority in one row */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Issue type</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.issueType}
              onChange={set("issueType")}
            >
              {ISSUE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Priority</label>
            <select
              className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              value={form.priority}
              onChange={set("priority")}
            >
              {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
            </select>
            {form.priority && (
              <span className={`text-xs px-2 py-0.5 rounded-full border w-fit ${PRIORITY_COLOR[form.priority]}`}>
                {form.priority}
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Title <span className="text-red-500">*</span></label>
          <input
            type="text"
            className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Short summary of the issue"
            value={form.title}
            onChange={set("title")}
            maxLength={120}
          />
        </div>

        {/* Description */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Description <span className="text-red-500">*</span></label>
          <textarea
            className="rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Describe the issue in detail — what happened, when, and any relevant context…"
            rows={5}
            value={form.description}
            onChange={set("description")}
          />
        </div>

        <Button
          type="submit"
          disabled={!form.title.trim() || !form.description.trim()}
          className="w-full"
        >
          Submit report
        </Button>
      </form>
    </div>
  );
}
