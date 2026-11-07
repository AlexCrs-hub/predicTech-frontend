import MachineUpdateForm from "@/lib/components/forms/MachineUpdateForm";
import { PageHeader } from "@/lib/components/ui/field";

export default function UpdateMachinePage() {
  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <PageHeader
        title="Update machine"
        description="Rename machines and tune the power thresholds used for idle, downtime and cutting detection."
      />
      <MachineUpdateForm />
    </div>
  );
}
