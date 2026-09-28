export interface DemoMachine {
  _id: string;
  name: string;
  maxPowerConsumption: number;
  downtimeThreshold: number;
  cuttingThreshold: number;
  status: "on" | "idle";
  liveKw: number;
  currentState: "on" | "idle";
}

export const DEMO_MACHINES: DemoMachine[] = [
  {
    _id: "dm-laser-001",
    name: "Machine 1",
    maxPowerConsumption: 25,
    downtimeThreshold: 4,
    cuttingThreshold: 14,
    status: "on",
    liveKw: 19.5,
    currentState: "on",
  },
  {
    _id: "dm-cnc-002",
    name: "Machine 2",
    maxPowerConsumption: 18,
    downtimeThreshold: 3,
    cuttingThreshold: 10,
    status: "on",
    liveKw: 14.2,
    currentState: "on",
  },
  {
    _id: "dm-press-003",
    name: "Machine 3",
    maxPowerConsumption: 45,
    downtimeThreshold: 8,
    cuttingThreshold: 28,
    status: "on",
    liveKw: 34.8,
    currentState: "on",
  },
  {
    _id: "dm-weld-004",
    name: "Machine 4",
    maxPowerConsumption: 12,
    downtimeThreshold: 2,
    cuttingThreshold: 7,
    status: "idle",
    liveKw: 2.4,
    currentState: "idle",
  },
  {
    _id: "dm-mill-005",
    name: "Machine 5",
    maxPowerConsumption: 22,
    downtimeThreshold: 4,
    cuttingThreshold: 13,
    status: "on",
    liveKw: 17.1,
    currentState: "on",
  },
];

export const DEMO_MACHINE_MAP = Object.fromEntries(
  DEMO_MACHINES.map((m) => [m._id, m])
);

// Per-machine metric seeds — deterministic, plausible values
export const DEMO_METRICS: Record<
  string,
  {
    cuttingPct: number;
    utilizationPct: number;
    cyclesDay: number;
    cyclesWeek: number;
    cyclesMonth: number;
    downtimeHoursDay: number;
    downtimeHoursWeek: number;
    downtimeHoursMonth: number;
    plannedPct: number; // % of downtime that is planned
  }
> = {
  "dm-laser-001": {
    cuttingPct: 68.4, utilizationPct: 79.2,
    cyclesDay: 22, cyclesWeek: 148, cyclesMonth: 591,
    downtimeHoursDay: 1.2, downtimeHoursWeek: 8.4, downtimeHoursMonth: 33.6,
    plannedPct: 45,
  },
  "dm-cnc-002": {
    cuttingPct: 74.1, utilizationPct: 84.5,
    cyclesDay: 35, cyclesWeek: 231, cyclesMonth: 924,
    downtimeHoursDay: 0.8, downtimeHoursWeek: 5.6, downtimeHoursMonth: 22.4,
    plannedPct: 55,
  },
  "dm-press-003": {
    cuttingPct: 61.3, utilizationPct: 72.8,
    cyclesDay: 48, cyclesWeek: 312, cyclesMonth: 1248,
    downtimeHoursDay: 1.5, downtimeHoursWeek: 10.5, downtimeHoursMonth: 42.0,
    plannedPct: 38,
  },
  "dm-weld-004": {
    cuttingPct: 77.6, utilizationPct: 86.3,
    cyclesDay: 18, cyclesWeek: 122, cyclesMonth: 488,
    downtimeHoursDay: 0.5, downtimeHoursWeek: 3.5, downtimeHoursMonth: 14.0,
    plannedPct: 70,
  },
  "dm-mill-005": {
    cuttingPct: 71.2, utilizationPct: 81.6,
    cyclesDay: 27, cyclesWeek: 179, cyclesMonth: 716,
    downtimeHoursDay: 1.0, downtimeHoursWeek: 7.0, downtimeHoursMonth: 28.0,
    plannedPct: 50,
  },
};
