import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { addMachine } from "@/lib/api/machineApi";
import { useAuth } from "@/context/AuthContext";
import { Field } from "@/lib/components/ui/field";
import { inputClass, inputStateClass, primaryButtonClass } from "@/lib/components/ui/fieldStyles";

const FormSchema = z.object({
  machine_name: z.string().trim().min(2, { message: "Machine name must be at least 2 characters." }),
  mqtt_name: z.string().trim().optional(),
  max_power: z.coerce.number({ invalid_type_error: "Enter a number." }).min(1, { message: "Max power must be at least 1 kW." }),
});

type FormValues = z.infer<typeof FormSchema>;

export default function MachineInputForm() {
  const userId = useAuth().getUser()?.user._id || "";
  const [serverError, setServerError] = useState("");
  const [created, setCreated] = useState<{ _id: string; name: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { machine_name: "", mqtt_name: "", max_power: undefined },
  });

  async function onSubmit(data: FormValues) {
    setServerError("");
    setCreated(null);
    try {
      const response = await addMachine(data.machine_name, data.max_power, userId, data.mqtt_name || undefined);
      if (!response?.message) throw new Error(response?.error || "Failed to add machine.");
      setCreated(response.machine ?? { _id: "", name: data.machine_name });
      reset();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {created && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-3 py-2.5 text-sm text-green-800 dark:text-green-300">
          <Check className="size-4 mt-0.5 shrink-0" />
          <span>
            <strong>{created.name}</strong> was added.{" "}
            {created._id && (
              <Link to={`/app/update-machine?machineId=${created._id}`} className="underline font-medium">
                Set its thresholds →
              </Link>
            )}
          </span>
        </div>
      )}
      {serverError && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2.5 text-sm text-red-700 dark:text-red-300">
          {serverError}
        </div>
      )}

      <Field label="Display name" htmlFor="add-name" required error={errors.machine_name?.message}>
        <input
          id="add-name"
          {...register("machine_name")}
          placeholder="e.g. CNC 1"
          className={`${inputClass} ${inputStateClass(!!errors.machine_name)}`}
        />
      </Field>

      <Field
        label="Hardware ID (MQTT name)"
        htmlFor="add-mqtt"
        error={errors.mqtt_name?.message}
        hint="The machine name sent in MQTT messages. Leave empty to use the display name."
      >
        <input
          id="add-mqtt"
          {...register("mqtt_name")}
          placeholder="e.g. Machine_Pipe_7"
          className={`${inputClass} ${inputStateClass(!!errors.mqtt_name)}`}
        />
      </Field>

      <Field label="Max power consumption (kW)" htmlFor="add-max" required error={errors.max_power?.message}>
        <input
          id="add-max"
          type="number"
          inputMode="decimal"
          min={1}
          step="0.1"
          {...register("max_power")}
          placeholder="e.g. 12"
          className={`${inputClass} ${inputStateClass(!!errors.max_power)}`}
        />
      </Field>

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? "Adding…" : "Add machine"}
        </button>
      </div>
    </form>
  );
}
