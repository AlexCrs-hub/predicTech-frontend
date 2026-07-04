"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/hooks/use-toast";
import { Button } from "@/lib/components/ui/button";
import { Input } from "@/lib/components/ui/input";
import { Toaster } from "@/lib/components/ui/toaster";
import { fetchAllMachines, updateMachine } from "@/lib/api/machineApi";

type MachineOption = {
  _id: string;
  name: string;
  mqttName?: string;
  maxPowerConsumption?: number;
  downtimeThreshold?: number;
};

export default function MachineUpdateForm() {
  const [machines, setMachines] = useState<MachineOption[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);

  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [maxPower, setMaxPower] = useState<string>("");
  const [downtimeThreshold, setDowntimeThreshold] = useState<string>("");

  const loadMachines = async () => {
    setLoadingList(true);
    try {
      const res = await fetchAllMachines();
      const list: MachineOption[] = Array.isArray(res) ? res : res?.machines ?? [];
      setMachines(list);
    } catch {
      setMachines([]);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadMachines();
  }, []);

  const selectMachine = (id: string) => {
    setSelectedId(id);
    const m = machines.find((x) => x._id === id);
    if (!m) return;
    setName(m.name ?? "");
    setMaxPower(m.maxPowerConsumption != null ? String(m.maxPowerConsumption) : "");
    setDowntimeThreshold(m.downtimeThreshold != null ? String(m.downtimeThreshold) : "");
  };

  const selected = machines.find((m) => m._id === selectedId);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    if (name.trim().length < 2) {
      toast({ title: "Invalid name", description: "Name must be at least 2 characters.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);
      // Only send editable fields — never mqttName (the hardware match key).
      const payload: { name: string; maxPowerConsumption?: number; downtimeThreshold?: number } = {
        name: name.trim(),
      };
      if (maxPower !== "") payload.maxPowerConsumption = Number(maxPower);
      if (downtimeThreshold !== "") payload.downtimeThreshold = Number(downtimeThreshold);

      const res = await updateMachine(selectedId, payload);
      if (!res || res.error) {
        throw new Error(res?.error || "Failed to update machine.");
      }

      toast({ title: "Success", description: "Machine updated successfully!" });
      await loadMachines();
    } catch (err) {
      console.error("Update error:", err);
      toast({ title: "Error", description: "Something went wrong.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-2/3 flex flex-col items-center gap-6">
      {/* Machine picker */}
      <div className="w-full space-y-2">
        <label className="text-sm font-medium">Select machine</label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          value={selectedId}
          disabled={loadingList}
          onChange={(e) => selectMachine(e.target.value)}
        >
          <option value="">
            {loadingList ? "Loading machines…" : "— Choose a machine —"}
          </option>
          {machines.map((m) => (
            <option key={m._id} value={m._id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Edit form — only once a machine is selected */}
      {selected && (
        <form onSubmit={onSubmit} className="w-full space-y-6 flex flex-col items-center">
          <div className="w-full space-y-2">
            <label className="text-sm font-medium">Display name</label>
            <Input
              placeholder="e.g. CNC1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="w-full space-y-2">
            <label className="text-sm font-medium">Max Power Consumption (kW)</label>
            <Input
              type="number"
              placeholder="Enter max power consumption"
              value={maxPower}
              onChange={(e) => setMaxPower(e.target.value)}
            />
          </div>

          <div className="w-full space-y-2">
            <label className="text-sm font-medium">Downtime Threshold (kW)</label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 0.1"
              value={downtimeThreshold}
              onChange={(e) => setDowntimeThreshold(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Update Machine"}
          </Button>
        </form>
      )}

      <Toaster />
    </div>
  );
}
