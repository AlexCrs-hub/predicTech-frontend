import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, ExternalLink, Plus, Check } from "lucide-react";
import { fetchAllMachines, updateMachine } from "@/lib/api/machineApi";
import { Field } from "@/lib/components/ui/field";
import { inputClass, inputStateClass, primaryButtonClass, secondaryButtonClass } from "@/lib/components/ui/fieldStyles";

type MachineOption = {
  _id: string;
  name: string;
  mqttName?: string;
  maxPowerConsumption?: number;
  downtimeThreshold?: number;
  cuttingThreshold?: number | null;
};

type Draft = {
  name: string;
  maxPower: string;
  downtimeThreshold: string;
  cuttingThreshold: string;
};

const toStr = (v: number | null | undefined) => (v != null ? String(v) : "");

function draftFrom(m: MachineOption): Draft {
  return {
    name: m.name ?? "",
    maxPower: toStr(m.maxPowerConsumption),
    downtimeThreshold: toStr(m.downtimeThreshold),
    cuttingThreshold: toStr(m.cuttingThreshold),
  };
}

function validate(d: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {};
  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const max = num(d.maxPower);
  const idle = num(d.downtimeThreshold);
  const cut = num(d.cuttingThreshold);

  if (d.name.trim().length < 2) errors.name = "Name must be at least 2 characters.";
  if (max !== null && (Number.isNaN(max) || max < 0)) errors.maxPower = "Enter a number ≥ 0.";
  if (idle === null) errors.downtimeThreshold = "Required.";
  else if (Number.isNaN(idle) || idle < 0) errors.downtimeThreshold = "Enter a number ≥ 0.";
  else if (max && idle >= max) errors.downtimeThreshold = "Must be lower than max power.";
  if (cut !== null) {
    if (Number.isNaN(cut) || cut < 0) errors.cuttingThreshold = "Enter a number ≥ 0.";
    else if (idle !== null && !Number.isNaN(idle) && cut <= idle) errors.cuttingThreshold = "Must be higher than the idle threshold.";
    else if (max && cut > max) errors.cuttingThreshold = "Can't be higher than max power.";
  }
  return errors;
}

export default function MachineUpdateForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("machineId") ?? "";

  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<"saved" | "error" | null>(null);

  const loadMachines = async () => {
    try {
      const res = await fetchAllMachines();
      const list: MachineOption[] = Array.isArray(res) ? res : res?.machines ?? [];
      setMachines(list.sort((a, b) => a.name.localeCompare(b.name)));
      setStatus("ok");
      return list;
    } catch {
      setStatus("error");
      return [];
    }
  };

  useEffect(() => { loadMachines(); }, []);

  const selected = machines.find((m) => m._id === selectedId) ?? null;

  // (re)load the form whenever another machine is picked
  useEffect(() => {
    setDraft(selected ? draftFrom(selected) : null);
    setTouched(false);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?._id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return machines;
    return machines.filter((m) => m.name.toLowerCase().includes(q) || m.mqttName?.toLowerCase().includes(q));
  }, [machines, query]);

  const errors = draft ? validate(draft) : {};
  const isValid = Object.keys(errors).length === 0;
  const isDirty = !!(draft && selected && JSON.stringify(draft) !== JSON.stringify(draftFrom(selected)));

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));
    setResult(null);
  };

  const select = (id: string) => setSearchParams({ machineId: id }, { replace: true });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!selected || !draft || !isValid || !isDirty) return;
    setSaving(true);
    setResult(null);
    try {
      // never send mqttName — it's the hardware match key
      const res = await updateMachine(selected._id, {
        name: draft.name.trim(),
        maxPowerConsumption: draft.maxPower.trim() === "" ? 0 : Number(draft.maxPower),
        downtimeThreshold: Number(draft.downtimeThreshold),
        cuttingThreshold: draft.cuttingThreshold.trim() === "" ? null : Number(draft.cuttingThreshold),
      });
      if (!res || res.error) throw new Error(res?.error || "Update failed");
      const fresh = await loadMachines();
      const updated = fresh.find((m) => m._id === selected._id);
      if (updated) setDraft(draftFrom(updated));
      setTouched(false);
      setResult("saved");
    } catch {
      setResult("error");
    } finally {
      setSaving(false);
    }
  };

  const showError = (k: keyof Draft) => (touched || draft?.[k] !== (selected ? draftFrom(selected)[k] : "")) ? errors[k] : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
      {/* machine list */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search machines…"
              aria-label="Search machines"
              className={`${inputClass} ${inputStateClass()} pl-9 h-9`}
            />
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-1.5">
          {status === "loading" && (
            <div className="flex flex-col gap-1.5 p-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          )}
          {status === "error" && (
            <p className="text-sm text-red-600 dark:text-red-400 p-3">Could not load machines.</p>
          )}
          {status === "ok" && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">
              {machines.length === 0 ? "No machines yet." : "No machines match your search."}
            </p>
          )}
          {filtered.map((m) => {
            const active = m._id === selectedId;
            return (
              <button
                key={m._id}
                type="button"
                onClick={() => select(m._id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
                  active
                    ? "bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-800"
                    : "hover:bg-accent"
                }`}
              >
                <p className={`text-sm font-semibold truncate ${active ? "text-blue-700 dark:text-blue-300" : "text-foreground"}`}>
                  {m.name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {m.mqttName && m.mqttName !== m.name ? m.mqttName : `max ${m.maxPowerConsumption ?? 0} kW`}
                </p>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-border">
          <Link to="/app/add-machine" className={`${secondaryButtonClass} w-full h-9`}>
            <Plus className="size-4" /> Add machine
          </Link>
        </div>
      </div>

      {/* edit form */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {!selected || !draft ? (
          <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-16">
            <p className="text-base font-semibold text-foreground">
              {selectedId && status === "ok" ? "Machine not found" : "Select a machine"}
            </p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Pick a machine from the list to edit its name and the power thresholds used for idle and cutting detection.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate>
            <div className="flex flex-wrap items-start justify-between gap-3 px-6 py-5 border-b border-border">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{selected.name}</h2>
                {selected.mqttName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hardware ID{" "}
                    <code className="px-1.5 py-0.5 rounded bg-muted text-foreground/80">
                      {selected.mqttName}
                    </code>
                    <span className="ml-1">· matches incoming MQTT data, can't be changed</span>
                  </p>
                )}
              </div>
              <Link
                to={`/app/machine?machineId=${selected._id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                Open machine <ExternalLink className="size-3.5" />
              </Link>
            </div>

            <div className="px-6 py-5 flex flex-col gap-6">
              <Field label="Display name" htmlFor="m-name" required error={showError("name")}>
                <input
                  id="m-name"
                  value={draft.name}
                  onChange={set("name")}
                  placeholder="e.g. CNC 1"
                  className={`${inputClass} ${inputStateClass(!!showError("name"))}`}
                />
              </Field>

              <div>
                <p className="text-sm font-semibold text-foreground">Power thresholds</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Used to tell running, idle and cutting apart. The system may recalibrate the idle and cutting
                  thresholds automatically from recent power data.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Max power (kW)" htmlFor="m-max" error={showError("maxPower")} hint="Rated maximum.">
                  <input
                    id="m-max"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.1"
                    value={draft.maxPower}
                    onChange={set("maxPower")}
                    placeholder="0"
                    className={`${inputClass} ${inputStateClass(!!showError("maxPower"))}`}
                  />
                </Field>
                <Field label="Idle threshold (kW)" htmlFor="m-idle" required error={showError("downtimeThreshold")} hint="At or below = idle / downtime.">
                  <input
                    id="m-idle"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={draft.downtimeThreshold}
                    onChange={set("downtimeThreshold")}
                    placeholder="0.1"
                    className={`${inputClass} ${inputStateClass(!!showError("downtimeThreshold"))}`}
                  />
                </Field>
                <Field label="Cutting threshold (kW)" htmlFor="m-cut" error={showError("cuttingThreshold")} hint="Above = cutting. Empty = auto.">
                  <input
                    id="m-cut"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={draft.cuttingThreshold}
                    onChange={set("cuttingThreshold")}
                    placeholder="auto"
                    className={`${inputClass} ${inputStateClass(!!showError("cuttingThreshold"))}`}
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 px-6 py-4 border-t border-border bg-gray-50/60 dark:bg-zinc-900/60 rounded-b-xl">
              {result === "saved" && (
                <span className="mr-auto inline-flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400">
                  <Check className="size-4" /> Changes saved
                </span>
              )}
              {result === "error" && (
                <span className="mr-auto text-sm text-red-600 dark:text-red-400">Could not save — please try again.</span>
              )}
              <button
                type="button"
                disabled={!isDirty || saving}
                onClick={() => { setDraft(draftFrom(selected)); setTouched(false); setResult(null); }}
                className={secondaryButtonClass}
              >
                Reset
              </button>
              <button type="submit" disabled={!isDirty || saving || !isValid} className={primaryButtonClass}>
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
