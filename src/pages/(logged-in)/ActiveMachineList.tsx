import { useState, useEffect, useRef } from "react";
import { fetchAllMachines } from "@/lib/api/machineApi";
import MachineListElement from "@/lib/components/machineList/MachineListElement";
import ThresholdBreachModal, { BreachAlert } from "@/lib/components/machine/ThresholdBreachModal";
import { Machine } from "@/lib/components/machineList/types";
import { useWebSocket } from "@/context/WebSocketContext";
import { useNotifications, Report } from "@/context/NotificationContext";
import {
  getSimulatedSensorValue,
  SENSOR_THRESHOLD,
  logDowntimeEntry,
} from "@/lib/utils/machineSimulation";

type StateOverride = { state: Machine["currentState"]; since?: number };

export default function ActiveMachineList() {
  const [machines, setMachines]     = useState<Machine[]>([]);
  const [simValues, setSimValues]   = useState<Record<string, number>>({});
  const [alertQueue, setAlertQueue] = useState<BreachAlert[]>([]);
  const [overrides, setOverrides]   = useState<Record<string, StateOverride>>({});
  const triggerIndexRef = useRef(0);

  const { machineStates, liveKw } = useWebSocket();
  const { createTicket, reports }  = useNotifications();

  useEffect(() => {
    fetchAllMachines()
      .then((res) => setMachines(Array.isArray(res?.machines) ? res.machines : []))
      .catch(() => setMachines([]));
  }, []);

  // Sensor simulation — threshold breach detection only
  useEffect(() => {
    if (machines.length === 0) return;
    const tick = () => {
      const now = Date.now();
      const newVals: Record<string, number> = {};
      machines.forEach((m) => { newVals[m._id] = getSimulatedSensorValue(m._id, now); });
      setSimValues(newVals);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [machines]);

  // ── machine state helpers ────────────────────────────────────────────────────

  const setMachineState = (id: string, state: Machine["currentState"]) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { state, since: state === "in maintenance" ? Date.now() : undefined },
    }));
  };

  const deriveState = (machine: Machine): Machine["currentState"] => {
    if (overrides[machine._id]) return overrides[machine._id].state;
    const ws = machineStates[machine._id];
    if (ws?.state === "ON" && ws?.health === "HEALTHY") return "on";
    return "idle";
  };

  // ── threshold breach ─────────────────────────────────────────────────────────

  const triggerAlert = () => {
    if (machines.length === 0) return;
    const queued = new Set(alertQueue.map((a) => a.machineId));
    for (let i = 0; i < machines.length; i++) {
      const idx = (triggerIndexRef.current + i) % machines.length;
      const m = machines[idx];
      if (!queued.has(m._id)) {
        triggerIndexRef.current = (idx + 1) % machines.length;
        const value = +(Math.random() * (SENSOR_THRESHOLD - 1)).toFixed(1);
        setAlertQueue((prev) => [...prev, { machineId: m._id, machineName: m.name, value, threshold: SENSOR_THRESHOLD }]);
        setSimValues((prev) => ({ ...prev, [m._id]: value }));
        return;
      }
    }
  };

  const currentAlert = alertQueue[0];
  const dismissCurrent = () => setAlertQueue((prev) => prev.slice(1));

  const handleLogReason = (machineId: string, reason: string) => {
    logDowntimeEntry(machineId, reason);
    dismissCurrent();
  };

  const handleCreateTicket = (machineId: string, comment: string) => {
    const machine = machines.find((m) => m._id === machineId);
    if (!machine) return;
    createTicket({
      machineId,
      machineName: machine.name,
      sensorName: "Power",
      value: simValues[machineId] ?? 0,
      threshold: SENSOR_THRESHOLD,
      comment,
    });
    dismissCurrent();
  };

  // ── grouping ─────────────────────────────────────────────────────────────────

  type EnrichedMachine = Machine & { currentState: Machine["currentState"]; hasTickets: boolean };

  const enriched: EnrichedMachine[] = machines.map((machine) => ({
    ...machine,
    currentState: deriveState(machine),
    hasTickets: reports.some((r: Report) => r.machineId === machine._id && r.status !== "fixed"),
  }));

  const withTickets    = enriched.filter((m) => m.hasTickets);
  const running        = enriched.filter((m) => !m.hasTickets && m.currentState === "on");
  const idling         = enriched.filter((m) => !m.hasTickets && m.currentState === "idle");
  const inMaintenance  = enriched.filter((m) => !m.hasTickets && m.currentState === "in maintenance");

  const renderGrid = (list: EnrichedMachine[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {list.map((machine) => (
        <MachineListElement
          key={machine._id}
          name={machine.name}
          _id={machine._id}
          status={machine.status}
          currentState={machine.currentState}
          liveKw={liveKw[machine._id] || 0}
          maxPowerConsumption={machine.maxPowerConsumption}
          onStart={()       => setMachineState(machine._id, "on")}
          onStop={()        => setMachineState(machine._id, "idle")}
          onMaintenance={() => setMachineState(machine._id, "in maintenance")}
          maintenanceSince={overrides[machine._id]?.state === "in maintenance"
            ? overrides[machine._id].since : undefined}
        />
      ))}
    </div>
  );

  const SectionHeader = ({ label, count, dot }: { label: string; count: number; dot: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-zinc-400">{label}</span>
      <span className="text-xs text-gray-400 dark:text-zinc-600 ml-1">({count})</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 pb-10 bg-gray-50 dark:bg-zinc-950 min-h-screen p-5">
      <div>
        <button
          onClick={triggerAlert}
          className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 dark:border-zinc-700 text-gray-400 dark:text-zinc-500 hover:border-red-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
        >
          ⚡ Trigger threshold breach
        </button>
      </div>

      {withTickets.length > 0 && (
        <section>
          <SectionHeader label="Open tickets" count={withTickets.length} dot="bg-amber-400" />
          {renderGrid(withTickets)}
        </section>
      )}

      {running.length > 0 && (
        <section>
          <SectionHeader label="Running" count={running.length} dot="bg-green-500" />
          {renderGrid(running)}
        </section>
      )}

      {idling.length > 0 && (
        <section>
          <SectionHeader label="Idle" count={idling.length} dot="bg-amber-400" />
          {renderGrid(idling)}
        </section>
      )}

      {inMaintenance.length > 0 && (
        <section>
          <SectionHeader label="In Maintenance" count={inMaintenance.length} dot="bg-blue-500" />
          {renderGrid(inMaintenance)}
        </section>
      )}

      {machines.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-zinc-500">No machines found.</p>
      )}

      {currentAlert && (
        <ThresholdBreachModal
          alert={currentAlert}
          queueLength={alertQueue.length - 1}
          onLogReason={handleLogReason}
          onCreateTicket={handleCreateTicket}
        />
      )}
    </div>
  );
}
