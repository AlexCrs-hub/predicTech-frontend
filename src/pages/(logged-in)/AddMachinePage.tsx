import { Link } from "react-router-dom";
import MachineInputForm from "@/lib/components/forms/MachineInputForm";
import { PageHeader } from "@/lib/components/ui/field";

export default function AddMachinePage() {
  return (
    <div className="w-full max-w-2xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <PageHeader
        title="Add machine"
        description="Machines are also created automatically when new MQTT data arrives — add one manually only if it isn't sending data yet."
        actions={
          <Link to="/app/update-machine" className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline">
            ← Back to machines
          </Link>
        }
      />
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <MachineInputForm />
      </div>
    </div>
  );
}
