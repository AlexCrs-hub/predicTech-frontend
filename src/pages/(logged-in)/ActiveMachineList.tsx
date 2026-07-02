import { useState, useEffect, useRef } from "react";
import { fetchAllMachines } from "@/lib/api/machineApi";
import MachineListElement from "@/lib/components/machineList/MachineListElement";
import ThresholdBreachModal, { BreachAlert } from "@/lib/components/machine/ThresholdBreachModal";
import { Machine } from "@/lib/components/machineList/types";
import { useWebSocket } from "@/context/WebSocketContext";
import { useNotifications, Report } from "@/context/NotificationContext";
import { startWorkInterval, stopWorkInterval } from "@/lib/api/workIntervalApi";
import { fetchUnresolvedDowntime, recordDowntimeReason, DowntimeReason } from "@/lib/api/downtimeRecordsApi";
import { fetchMetricSummary } from "@/lib/api/metricsApi";

type StateOverride = { state: Machine["currentState"]; since?: number };

export default function ActiveMachineList() {
  const [machines, setMachines]               = useState<Machine[]>([]);
  const [fetchStatus, setFetchStatus]         = useState<"loading" | "ok" | "auth" | "empty" | "error">("loading");
  const [alertQueue, setAlertQueue]           = useState<BreachAlert[]>([]);
  const [activeIntervals, setActiveIntervals] = useState<Set<string>>(new Set());
  const [machineMetrics, setMachineMetrics]   = useState<Record<string, { utilization: number; cycles: number }>>({});
  const [overrides, setOverrides]             = useState<Record<string, StateOverride>>({});

  const prevWsRef      = useRef<Record<string, { state: string; health: string }>>({});
  const alertedRef     = useRef<Set<string>>(new Set());
  const prevReportsRef = useRef<Report[]>([]);

  const { machineStates, liveKw } = useWebSocket();
  const { createTicket, reports }  = useNotifications();

  // ── load machines ─────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchAllMachines()
      .then((res) => {
        if (res?.message === "You need to Login") { setFetchStatus("auth"); return; }
        const list = Array.isArray(res?.machines) ? res.machines : [];
        setMachines(list);
        setFetchStatus(list.length === 0 ? "empty" : "ok");
      })
      .catch(() => setFetchStatus("error"));
  }, []);

  // ── fetch real metrics for each machine (day period) ──────────────────────────
  useEffect(() => {
    if (machines.length === 0) return;
    Promise.allSettled(
      
      machines.map((m) =>
        fetchMetricSummary(m._id, "day").then((summary) => ({
        id: m._id,
        utilization: summary.utilizationPercentage,
        cycles: summary.cycles,
      }))
      )
    ).then((results) => {
      const map: Record<string, { utilization: number; cycles: number }> = {};
      results.forEach((r) => {
        if (r.status === "fulfilled") map[r.value.id] = { utilization: r.value.utilization, cycles: r.value.cycles };
      });
      console.log(map);
      setMachineMetrics(map);
    });
  }, [machines]);

  // ── automatic downtime detection via WebSocket state transitions ───────────────
  // DISABLED (test phase) — uncomment to re-enable downtime modals
  // useEffect(() => {
  //   if (machines.length === 0) return;
  //   machines.forEach((machine) => {
  //     const prev = prevWsRef.current[machine._id];
  //     const curr = machineStates[machine._id];
  //     if (!curr) return;
  //     if (!prev) {
  //       prevWsRef.current[machine._id] = { state: curr.state, health: curr.health };
  //       return;
  //     }
  //     const wasOn = prev.state?.toLowerCase() === "on" && prev.health?.toLowerCase() === "healthy";
  //     const isNowOn = curr.state?.toLowerCase() === "on" && curr.health?.toLowerCase() === "healthy";
  //     if (wasOn && !isNowOn && !alertedRef.current.has(machine._id)) {
  //       alertedRef.current.add(machine._id);
  //       setAlertQueue((q) => [...q, {
  //         machineId:   machine._id,
  //         machineName: machine.name,
  //         value:       liveKw[machine._id] ?? 0,
  //         threshold:   machine.downtimeThreshold ?? 0,
  //       }]);
  //     }
  //     if (!wasOn && isNowOn) alertedRef.current.delete(machine._id);
  //     prevWsRef.current[machine._id] = { state: curr.state, health: curr.health };
  //   });
  // }, [machineStates, machines, liveKw]);

  // ── ticket → maintenance state ─────────────────────────────────────────────────
  useEffect(() => {
    reports.forEach((r) => {
      const prev = prevReportsRef.current.find((p) => p.id === r.id);
      if (prev?.status !== "in_progress" && r.status === "in_progress") {
        setOverrides((o) => ({ ...o, [r.machineId]: { state: "in maintenance", since: Date.now() } }));
      }
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

  // ── work interval handlers ─────────────────────────────────────────────────────
  const handleStart = (id: string): Promise<boolean> =>
    startWorkInterval(id).then((r) => {
      if (r !== null) setActiveIntervals((prev) => new Set(prev).add(id));
      return r !== null;
    }).catch(() => false);

  const handleStop = (id: string): Promise<boolean> =>
    stopWorkInterval(id).then((r) => {
      if (r !== null) setActiveIntervals((prev) => { const s = new Set(prev); s.delete(id); return s; });
      return r !== null;
    }).catch(() => false);

  const deriveState = (machine: Machine): Machine["currentState"] => {
    if (overrides[machine._id]) return overrides[machine._id].state;
    const ws = machineStates[machine._id];
    if (
      ws?.state?.toLowerCase() === "on" &&
      ws?.health?.toLowerCase() === "healthy"
    ) {
      return "on";
    }
    return "idle";
  };

  // ── alert handling ─────────────────────────────────────────────────────────────
  const dismissCurrent = () => {
    const alert = alertQueue[0];
    if (alert) alertedRef.current.delete(alert.machineId);
    setAlertQueue((prev) => prev.slice(1));
  };

  const handleLogReason = (machineId: string, reason: DowntimeReason) => {
    dismissCurrent();
    fetchUnresolvedDowntime(machineId)
      .then((records) => {
        const latest = records.find((r) => !r.reasonRecorded);
        if (latest) recordDowntimeReason(latest._id, reason, "unplanned").catch(() => {});
      })
      .catch(() => {});
  };

  const handleCreateTicket = (machineId: string, comment: string) => {
    const machine = machines.find((m) => m._id === machineId);
    if (!machine) return;
    createTicket({
      machineId,
      machineName: machine.name,
      sensorName:  "Power",
      value:       liveKw[machineId] ?? 0,
      threshold:   machine.downtimeThreshold ?? 0,
      comment,
    });
    dismissCurrent();
  };

  // ── grouping ───────────────────────────────────────────────────────────────────
  type EnrichedMachine = Machine & { currentState: Machine["currentState"]; hasTickets: boolean };

  const enriched: EnrichedMachine[] = machines.map((machine) => ({
    ...machine,
    currentState: deriveState(machine),
    hasTickets: reports.some((r: Report) => r.machineId === machine._id && r.status !== "fixed"),
  }));

  const withTickets   = enriched.filter((m) => m.hasTickets);
  const active        = enriched.filter((m) => !m.hasTickets && (m.currentState === "on" || m.currentState === "idle"));
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
          liveKw={liveKw[machine._id] || 0}
          maxPowerConsumption={machine.maxPowerConsumption}
          onStart={() => handleStart(machine._id)}
          onStop={() => handleStop(machine._id)}
          intervalActive={activeIntervals.has(machine._id)}
          utilizationPct={machineMetrics[machine._id]?.utilization}
          realCycles={machineMetrics[machine._id]?.cycles}
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

      {withTickets.length > 0 && (
        <section>
          <SectionHeader label="Open tickets" count={withTickets.length} dot="bg-amber-400" />
          {renderGrid(withTickets)}
        </section>
      )}
      {active.length > 0 && (
        <section>
          <SectionHeader label="Active" count={active.length} dot="bg-green-500" />
          {renderGrid(active)}
        </section>
      )}
      {inMaintenance.length > 0 && (
        <section>
          <SectionHeader label="In Maintenance" count={inMaintenance.length} dot="bg-blue-500" />
          {renderGrid(inMaintenance)}
        </section>
      )}

      {fetchStatus === "loading" && (
        <p className="text-sm text-gray-400 dark:text-zinc-500 animate-pulse">Loading machines…</p>
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
      {fetchStatus === "empty" && (
        <p className="text-sm text-gray-400 dark:text-zinc-500">No machines found for this account.</p>
      )}

      {alertQueue[0] && (
        <ThresholdBreachModal
          alert={alertQueue[0]}
          queueLength={alertQueue.length - 1}
          onLogReason={handleLogReason}
          onCreateTicket={handleCreateTicket}
          onTimeout={dismissCurrent}
        />
      )}
    </div>
  );
}
