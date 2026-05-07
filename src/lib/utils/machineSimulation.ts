// Deterministic per-machineId fake utilization data — same values every render

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function pick(seed: number, index: number, min: number, max: number): number {
  const h = fnv1a(`${seed}-${index}`);
  return min + (h % (max - min + 1));
}

export type CycleStage = "loading" | "cutting" | "offloading" | "waiting";

export type MachineUtilization = {
  runtimePct: number;
  cuttingPct: number;
  idlePct: number;
  cycles: number;
  cycleStages: { stage: CycleStage; durationMin: number }[];
};

export function getMachineUtilization(machineId: string): MachineUtilization {
  const seed = fnv1a(machineId);
  const runtimePct = pick(seed, 1, 48, 92);
  const cuttingPct = pick(seed, 2, 28, 68);
  const idlePct = 100 - runtimePct;
  const cycles = pick(seed, 3, 4, 22);

  const cycleStages: { stage: CycleStage; durationMin: number }[] = [
    { stage: "loading",    durationMin: pick(seed, 4, 2, 7)  },
    { stage: "cutting",    durationMin: pick(seed, 5, 8, 28) },
    { stage: "offloading", durationMin: pick(seed, 6, 2, 6)  },
    { stage: "waiting",    durationMin: pick(seed, 7, 1, 10) },
  ];

  return { runtimePct, cuttingPct, idlePct, cycles, cycleStages };
}

const DOWNTIME_STORAGE_KEY = "predictech_downtime";

export function logDowntimeEntry(machineId: string, reason: string) {
  try {
    const all = JSON.parse(localStorage.getItem(DOWNTIME_STORAGE_KEY) || "{}");
    const existing: { reason: string; loggedAt: string }[] = Array.isArray(all[machineId]) ? all[machineId] : [];
    all[machineId] = [{ reason, loggedAt: new Date().toISOString() }, ...existing].slice(0, 20);
    localStorage.setItem(DOWNTIME_STORAGE_KEY, JSON.stringify(all));
  } catch {}
}

// Threshold sensor simulation (oscillates 10–90, threshold at 25)
export const SENSOR_THRESHOLD = 25;
export const SENSOR_LABEL = "Vibration";

export function getSimulatedSensorValue(machineId: string, nowMs: number): number {
  const seed = fnv1a(machineId);
  const periodMs = (80 + (seed % 60)) * 1000; // 80–140 s period
  const phase = ((seed % 1000) / 1000) * Math.PI * 2;
  const t = (nowMs / periodMs) * Math.PI * 2 + phase;
  return Math.max(0, Math.min(100, 50 + 42 * Math.sin(t)));
}

export const DOWNTIME_REASONS = [
  "Waiting for foam blocks",
  "Loading delay",
  "Offloading delay",
  "Blade change",
  "Operator break",
  "Material shortage",
  "Quality check",
  "Equipment fault",
];
