import { DEMO_MACHINES, DEMO_MACHINE_MAP, DEMO_METRICS } from "./machines";
import type { ApiPeriod } from "@/lib/api/metricsApi";

// ── helpers ────────────────────────────────────────────────────────────────────

function periodMultiplier(period: ApiPeriod): number {
  return period === "month" ? 30 : period === "week" ? 7 : 1;
}

// Deterministic noise: same seed → same small offset every time
function deterministicNoise(seed: string, amplitude: number): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * 2 * amplitude;
}

// ── metric responses ───────────────────────────────────────────────────────────

export function demoCycles(machineId: string, period: ApiPeriod) {
  const m = DEMO_METRICS[machineId];
  if (!m) return { cycles: 0, period, machineId };
  const base = period === "month" ? m.cyclesMonth : period === "week" ? m.cyclesWeek : m.cyclesDay;
  return { cycles: Math.round(base + deterministicNoise(machineId + period, base * 0.05)), period, machineId };
}

export function demoDowntime(machineId: string, period: ApiPeriod) {
  const m = DEMO_METRICS[machineId];
  if (!m) return { downtimeHours: 0, period, machineId };
  const base = period === "month" ? m.downtimeHoursMonth : period === "week" ? m.downtimeHoursWeek : m.downtimeHoursDay;
  const val = +(base + deterministicNoise(machineId + period + "dt", base * 0.08)).toFixed(2);
  return { downtimeHours: Math.max(0, val), period, machineId };
}

export function demoUtilization(machineId: string, period: ApiPeriod) {
  const m = DEMO_METRICS[machineId];
  if (!m) return { utilizationPercentage: 0, period, machineId };
  const val = +(m.utilizationPct + deterministicNoise(machineId + period + "u", 1.5)).toFixed(2);
  return { utilizationPercentage: Math.max(0, Math.min(100, val)), period, machineId };
}

export function demoCutting(machineId: string, period: ApiPeriod) {
  const m = DEMO_METRICS[machineId];
  const machine = DEMO_MACHINE_MAP[machineId];
  if (!m || !machine) return { cuttingHours: 0, cuttingPercentage: 0, cuttingThreshold: 0, period, machineId };
  const hours = period === "month" ? 30 * 24 : period === "week" ? 7 * 24 : 24;
  const pct = +(m.cuttingPct + deterministicNoise(machineId + period + "c", 1.2)).toFixed(2);
  const cuttingHours = +((pct / 100) * hours).toFixed(2);
  return {
    cuttingHours,
    cuttingPercentage: Math.max(0, Math.min(100, pct)),
    cuttingThreshold: machine.cuttingThreshold,
    period,
    machineId,
  };
}

export function demoPlannedUnplanned(machineId: string, period: ApiPeriod) {
  const m = DEMO_METRICS[machineId];
  if (!m) return { plannedHours: 0, unplannedHours: 0, plannedPercentage: 0, unplannedPercentage: 0, period, machineId };
  const dt = demoDowntime(machineId, period).downtimeHours;
  const plannedHours = +((dt * m.plannedPct) / 100).toFixed(2);
  const unplannedHours = +(dt - plannedHours).toFixed(2);
  const totalPeriodHours = period === "month" ? 720 : period === "week" ? 168 : 24;
  return {
    plannedHours,
    unplannedHours,
    plannedPercentage: +((plannedHours / totalPeriodHours) * 100).toFixed(2),
    unplannedPercentage: +((unplannedHours / totalPeriodHours) * 100).toFixed(2),
    period,
    machineId,
  };
}

export function demoDowntimeStats(machineId: string, period: ApiPeriod) {
  const dt = demoDowntime(machineId, period);
  const mult = periodMultiplier(period);
  return {
    reasonCounts: {
      tool_change:   Math.round(2 * mult),
      maintenance:   Math.round(1 * mult),
      breakdown:     Math.round(1 * mult),
      micro_stop:    Math.round(3 * mult),
      setup:         Math.round(1 * mult),
    },
    typeCounts: {
      planned:   Math.round(3 * mult),
      unplanned: Math.round(5 * mult),
    },
    total: Math.round(8 * mult),
    period,
    machineId,
    downtimeHours: dt.downtimeHours,
  };
}

// ── sensor readings: realistic 24 h power profile ─────────────────────────────

export function demoSensorsForMachine(machineId: string) {
  const machine = DEMO_MACHINE_MAP[machineId];
  if (!machine) return [];
  return [
    {
      _id: `sensor-${machineId}`,
      name: "Power Sensor",
      unit: "kW",
      machine: machineId,
      readings: generate24hReadings(machineId, machine.maxPowerConsumption, machine.downtimeThreshold),
    },
  ];
}

export function demoReadingsForSensor(sensorId: string) {
  // sensorId is "sensor-{machineId}"
  const machineId = sensorId.replace("sensor-", "");
  const machine = DEMO_MACHINE_MAP[machineId];
  if (!machine) return [];
  return generate24hReadings(machineId, machine.maxPowerConsumption, machine.downtimeThreshold);
}

function generate24hReadings(machineId: string, maxPower: number, idleThreshold: number) {
  const points: { measurement: number; measuredAt: string }[] = [];
  const INTERVAL_MIN = 5;
  const POINTS = (24 * 60) / INTERVAL_MIN; // 288 points
  const now = Date.now();
  const workingPower = maxPower * 0.78;
  const idlePower = idleThreshold * 1.15;

  for (let i = 0; i < POINTS; i++) {
    const t = new Date(now - (POINTS - i) * INTERVAL_MIN * 60_000);
    const hour = t.getHours() + t.getMinutes() / 60;
    const isShift1 = hour >= 6 && hour < 14;
    const isShift2 = hour >= 14 && hour < 22;
    const isBreak1 = hour >= 9.5 && hour < 10;   // 30 min break
    const isBreak2 = hour >= 17.5 && hour < 18;  // 30 min break

    const inCutting = (isShift1 || isShift2) && !isBreak1 && !isBreak2;

    // Occasional short stops (1 per shift roughly)
    const stopSeed = Math.floor(i / 20) + machineId.charCodeAt(3);
    const isStop = (stopSeed % 18 === 0) && (isShift1 || isShift2);

    let base: number;
    if (isStop) {
      base = idlePower;
    } else if (inCutting) {
      // Cycles: power ramps during cutting bursts
      const cyclePhase = (i % 8) / 8; // 0→1 over 40 min cycle
      base = workingPower + (maxPower - workingPower) * Math.sin(cyclePhase * Math.PI) * 0.4;
    } else {
      base = idlePower;
    }

    // Deterministic noise
    const noise = deterministicNoise(machineId + i, base * 0.04);
    points.push({
      measurement: +Math.max(0, base + noise).toFixed(2),
      measuredAt: t.toISOString(),
    });
  }
  return points;
}

// ── work interval ──────────────────────────────────────────────────────────────

export function demoStartInterval(machineId: string) {
  return {
    _id: `wi-${machineId}-${Date.now()}`,
    machine: machineId,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
  };
}

export function demoStopInterval(machineId: string) {
  const startedAt = new Date(Date.now() - 3_600_000).toISOString();
  return {
    _id: `wi-${machineId}-stopped`,
    machine: machineId,
    startedAt,
    stoppedAt: new Date().toISOString(),
  };
}

// ── machines ───────────────────────────────────────────────────────────────────

export function demoMachineList() {
  return {
    message: `Found ${DEMO_MACHINES.length} machine(s).`,
    machines: DEMO_MACHINES,
  };
}

export function demoMachineById(id: string) {
  const machine = DEMO_MACHINE_MAP[id];
  if (!machine) return null;
  return { message: "Machine found.", machine };
}
