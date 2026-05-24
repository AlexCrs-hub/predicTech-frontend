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
  SENSOR_LABEL,
  logDowntimeEntry,
} from "@/lib/utils/machineSimulation";

export default function ActiveMachineList() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [simValues, setSimValues] = useState<Record<string, number>>({});
  const [alertQueue, setAlertQueue] = useState<BreachAlert[]>([]);
  const triggerIndexRef = useRef(0);

  const { machineStates, liveKw } = useWebSocket();
  const { createTicket, reports } = useNotifications();

  useEffect(() => {
    fetchAllMachines()
      .then((res) => setMachines(Array.isArray(res?.machines) ? res.machines : []))
      .catch(() => setMachines([]));
  }, []);

  // Visual-only tick — updates the sensor bars, no auto-alerting
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

  const triggerAlert = () => {
    if (machines.length === 0) return;
    const queued = new Set(alertQueue.map((a) => a.machineId));
    // Find next machine not already in queue, cycling through list
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
    const value = simValues[machineId] ?? 0;
    createTicket({
      machineId,
      machineName: machine.name,
      sensorName: SENSOR_LABEL,
      value,
      threshold: SENSOR_THRESHOLD,
      comment,
    });
    dismissCurrent();
  };

  // Resolve each machine's state + open tickets for grouping
  type EnrichedMachine = Machine & {
    currentState: Machine["currentState"];
    status: "on" | "off" | "idle";
    hasTickets: boolean;
  };

  const enriched: EnrichedMachine[] = machines.map((machine) => {
    const wsState = machineStates[machine._id];
    let status: "on" | "off" | "idle" = "off";
    if (wsState?.state) {
      const s = wsState.state.toLowerCase();
      if (s === "on" || s === "off" || s === "idle") status = s as typeof status;
    }
    const currentState: Machine["currentState"] =
      wsState?.health?.toLowerCase() === "healthy"
        ? "normal"
        : wsState?.health?.toLowerCase() === "stale"
        ? "unplanned downtime"
        : wsState?.health?.toLowerCase() === "disconnected"
        ? "alarm"
        : "planned downtime";
    const hasTickets = reports.some(
      (r: Report) => r.machineId === machine._id && r.status !== "fixed",
    );
    return { ...machine, currentState, status, hasTickets };
  });

  const withTickets = enriched.filter((m) => m.hasTickets);
  const running     = enriched.filter((m) => !m.hasTickets && m.currentState === "normal");
  const offline     = enriched.filter((m) => !m.hasTickets && m.currentState !== "normal");

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
          sensorValue={simValues[machine._id]}
          sensorThreshold={SENSOR_THRESHOLD}
          sensorLabel={SENSOR_LABEL}
        />
      ))}
    </div>
  );

  const SectionHeader = ({ label, count, dot }: { label: string; count: number; dot: string }) => (
    <div className="flex items-center gap-2 mb-3">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-zinc-400">
        {label}
      </span>
      <span className="text-xs text-gray-400 dark:text-zinc-600 ml-1">({count})</span>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 pb-10 bg-gray-50 dark:bg-zinc-950 min-h-screen p-5">
      {/* trigger button */}
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

      {offline.length > 0 && (
        <section>
          <SectionHeader label="Off / Downtime" count={offline.length} dot="bg-red-500" />
          {renderGrid(offline)}
        </section>
      )}

      {machines.length === 0 && (
        <p className="text-sm text-gray-400 dark:text-zinc-500">No machines found.</p>
      )}

      {/* Threshold breach modal queue */}
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
