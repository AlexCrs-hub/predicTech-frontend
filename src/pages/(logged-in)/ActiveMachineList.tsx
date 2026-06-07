import { useState, useEffect, useRef } from "react";
import { fetchAllMachines } from "@/lib/api/machineApi";
import MachineListElement from "@/lib/components/machineList/MachineListElement";
import ThresholdBreachModal, { BreachAlert } from "@/lib/components/machine/ThresholdBreachModal";
import { Machine } from "@/lib/components/machineList/types";
import { useWebSocket } from "@/context/WebSocketContext";
import { useNotifications, Report } from "@/context/NotificationContext";
import { getSimulatedSensorValue, SENSOR_THRESHOLD } from "@/lib/utils/machineSimulation";
import { startWorkInterval, stopWorkInterval } from "@/lib/api/workIntervalApi";
import { fetchUnresolvedDowntime, recordDowntimeReason, DowntimeReason, DowntimeRecord } from "@/lib/api/downtimeRecordsApi";

// ── Demo machine (always visible for demo purposes) ───────────────────────────
const DEMO_MACHINE: Machine = {
  _id: "demo-cnc-001",
  name: "CNC Fibre Laser #1",
  liveKw: 18.5,
  maxPowerConsumption: 25,
  currentState: "on",
  status: "on",
};

type StateOverride = { state: Machine["currentState"]; since?: number };

export default function ActiveMachineList() {
  const [machines, setMachines]       = useState<Machine[]>([]);
  const [fetchStatus, setFetchStatus] = useState<"loading" | "ok" | "auth" | "empty" | "error">("loading");
  const [simValues, setSimValues]     = useState<Record<string, number>>({});
  const [alertQueue, setAlertQueue]   = useState<BreachAlert[]>([]);
  const [overrides, setOverrides]     = useState<Record<string, StateOverride>>({
    "demo-cnc-001": { state: "on" },
  });
  const triggerIndexRef  = useRef(0);
  const prevReportsRef   = useRef<Report[]>([]);

  const { machineStates, liveKw } = useWebSocket();
  const { createTicket, reports }  = useNotifications();

  // ── fetch real machines (demo always prepended) ───────────────────────────
  useEffect(() => {
    fetchAllMachines()
      .then((res) => {
        if (res?.message === "You need to Login") { setFetchStatus("auth"); return; }
        const list = Array.isArray(res?.machines) ? res.machines : [];
        setMachines(list);
        setFetchStatus(list.length > 0 ? "ok" : "empty");
      })
      .catch(() => setFetchStatus("error"));
  }, []);

  // ── sensor sim ────────────────────────────────────────────────────────────
  useEffect(() => {
    const allMachines = [DEMO_MACHINE, ...machines];
    if (allMachines.length === 0) return;
    const tick = () => {
      const now = Date.now();
      const newVals: Record<string, number> = {};
      allMachines.forEach((m) => { newVals[m._id] = getSimulatedSensorValue(m._id, now); });
      setSimValues(newVals);
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => clearInterval(id);
  }, [machines]);

  // ── auto-maintenance when ticket goes in_progress ─────────────────────────
  useEffect(() => {
    reports.forEach((r) => {
      const prev = prevReportsRef.current.find((p) => p.id === r.id);

      // ticket accepted → in maintenance
      if (prev?.status !== "in_progress" && r.status === "in_progress") {
        setOverrides((o) => ({
          ...o,
          [r.machineId]: { state: "in maintenance", since: Date.now() },
        }));
      }

      // ticket fixed → clear maintenance
      if (prev?.status !== "fixed" && r.status === "fixed") {
        setOverrides((o) => {
          if (o[r.machineId]?.state !== "in maintenance") return o;
          const next = { ...o };
          delete next[r.machineId];
          return next;
        });
      }
    });
    prevReportsRef.current = reports;
  }, [reports]);

  // ── state helpers ─────────────────────────────────────────────────────────
  const setMachineState = (id: string, state: Machine["currentState"]) => {
    setOverrides((prev) => ({
      ...prev,
      [id]: { state, since: state === "in maintenance" ? Date.now() : undefined },
    }));
  };

  const handleStart = (id: string) => {
    setMachineState(id, "on");
    startWorkInterval(id).catch(() => {});
  };

  const handleStop = (id: string) => {
    setMachineState(id, "idle");
    stopWorkInterval(id).catch(() => {});
  };

  const handleDone = (id: string) => {
    setMachineState(id, "idle");
    // maintenance ends → no work interval to stop
  };

  const deriveState = (machine: Machine): Machine["currentState"] => {
    if (overrides[machine._id]) return overrides[machine._id].state;
    const ws = machineStates[machine._id];
    if (ws?.state === "ON" && ws?.health === "HEALTHY") return "on";
    return "idle";
  };

  // ── threshold breach ──────────────────────────────────────────────────────
  const triggerAlert = () => {
    const onlineMachines = enriched.filter((m) => m.currentState === "on");
    if (onlineMachines.length === 0) return;
    const queued = new Set(alertQueue.map((a) => a.machineId));
    for (let i = 0; i < onlineMachines.length; i++) {
      const idx = (triggerIndexRef.current + i) % onlineMachines.length;
      const m = onlineMachines[idx];
      if (!queued.has(m._id)) {
        triggerIndexRef.current = (idx + 1) % onlineMachines.length;
        const value = +(Math.random() * (SENSOR_THRESHOLD - 1)).toFixed(1);
        setAlertQueue((prev) => [...prev, { machineId: m._id, machineName: m.name, value, threshold: SENSOR_THRESHOLD }]);
        setSimValues((prev) => ({ ...prev, [m._id]: value }));
        return;
      }
    }
  };

  const currentAlert = alertQueue[0];
  const dismissCurrent = () => setAlertQueue((prev) => prev.slice(1));

  const DEMO_DT_KEY = (id: string) => `predictech_demo_downtime_${id}`;

  const handleLogReason = (machineId: string, reason: DowntimeReason) => {
    dismissCurrent();

    if (machineId.startsWith("demo-")) {
      const record: DowntimeRecord = {
        _id: `demo-${Date.now()}`,
        machine: machineId,
        startedAt: new Date(Date.now() - (Math.floor(Math.random() * 30) + 5) * 60000).toISOString(),
        resolvedAt: new Date().toISOString(),
        downtimeType: "unplanned",
        reason,
        reasonRecorded: true,
      };
      const existing: DowntimeRecord[] = JSON.parse(localStorage.getItem(DEMO_DT_KEY(machineId)) || "[]");
      localStorage.setItem(DEMO_DT_KEY(machineId), JSON.stringify([record, ...existing].slice(0, 50)));
      return;
    }

    fetchUnresolvedDowntime(machineId)
      .then((records) => {
        const latest = records.find((r) => !r.reasonRecorded);
        if (latest) recordDowntimeReason(latest._id, reason, "unplanned").catch(() => {});
      })
      .catch(() => {});
  };

  const handleCreateTicket = (machineId: string, comment: string) => {
    const allMachines = [DEMO_MACHINE, ...machines];
    const machine = allMachines.find((m) => m._id === machineId);
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

  // ── grouping ──────────────────────────────────────────────────────────────
  type EnrichedMachine = Machine & { currentState: Machine["currentState"]; hasTickets: boolean };

  const allMachines = [DEMO_MACHINE, ...machines];

  const enriched: EnrichedMachine[] = allMachines.map((machine) => ({
    ...machine,
    currentState: deriveState(machine),
    hasTickets: reports.some((r: Report) => r.machineId === machine._id && r.status !== "fixed"),
  }));

  const withTickets   = enriched.filter((m) => m.hasTickets);
  const running       = enriched.filter((m) => !m.hasTickets && m.currentState === "on");
  const idling        = enriched.filter((m) => !m.hasTickets && m.currentState === "idle");
  const inMaintenance = enriched.filter((m) => !m.hasTickets && m.currentState === "in maintenance");

  const renderGrid = (list: EnrichedMachine[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {list.map((machine) => (
        <MachineListElement
          key={machine._id}
          name={machine.name}
          _id={machine._id}
          status={machine.status}
          currentState={machine.currentState}
          liveKw={machine._id === "demo-cnc-001" ? DEMO_MACHINE.liveKw : (liveKw[machine._id] || 0)}
          maxPowerConsumption={machine.maxPowerConsumption}
          onStart={()        => handleStart(machine._id)}
          onStop={()         => handleStop(machine._id)}
          onMaintenance={()  => setMachineState(machine._id, "in maintenance")}
          onDone={()         => handleDone(machine._id)}
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

      {fetchStatus === "auth" && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-5 py-4 text-sm text-amber-700 dark:text-amber-400">
          Session expired — please <a href="/login" className="underline font-semibold">log in again</a>.
        </div>
      )}
      {fetchStatus === "error" && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-5 py-4 text-sm text-red-700 dark:text-red-400">
          Could not reach the server. Make sure the backend is running on port 8081.
        </div>
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
