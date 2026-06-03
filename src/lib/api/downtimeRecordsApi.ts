import { API_URLS } from "../constants/ApiUrls";
import type { ApiPeriod } from "./metricsApi";

export type DowntimeReason =
  | "maintenance" | "tool_change" | "setup" | "material_wait"
  | "breakdown" | "fault" | "micro_stop" | "other";

export type DowntimeType = "planned" | "unplanned";

export type DowntimeRecord = {
  _id: string;
  machine: string;
  startedAt: string;
  resolvedAt: string | null;
  downtimeType: DowntimeType | null;
  reason: DowntimeReason | null;
  reasonRecorded: boolean;
};

export type DowntimeStats = {
  reasonCounts: Partial<Record<DowntimeReason, number>>;
  typeCounts: { planned: number; unplanned: number };
  total: number;
  period: string;
  machineId: string;
};

const BASE = `${API_URLS.BACKEND_URL}/downtime-records`;

async function apiFetch(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input as string, { credentials: "include", ...init });
  if (!res.ok) throw new Error(`downtime-records request failed: ${res.status}`);
  return res.json();
}

export async function fetchUnresolvedDowntime(machineId: string): Promise<DowntimeRecord[]> {
  return apiFetch(`${BASE}/unresolved/${machineId}`);
}

export async function recordDowntimeReason(
  id: string,
  reason: DowntimeReason,
  downtimeType: DowntimeType,
): Promise<DowntimeRecord> {
  return apiFetch(`${BASE}/${id}/reason`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, downtimeType }),
  });
}

export async function fetchDowntimeStats(machineId: string, period: ApiPeriod): Promise<DowntimeStats> {
  return apiFetch(`${BASE}/stats/${machineId}/${period}`);
}

// Human-readable labels for API enum values
export const REASON_LABEL: Record<DowntimeReason, string> = {
  maintenance:   "Maintenance",
  tool_change:   "Tool Change",
  setup:         "Setup",
  material_wait: "Material Wait",
  breakdown:     "Breakdown",
  fault:         "Fault",
  micro_stop:    "Micro Stop",
  other:         "Other",
};

export const REASON_COLOR: Record<DowntimeReason, string> = {
  maintenance:   "#6366f1",
  tool_change:   "#ef4444",
  setup:         "#60a5fa",
  material_wait: "#f97316",
  breakdown:     "#dc2626",
  fault:         "#f43f5e",
  micro_stop:    "#eab308",
  other:         "#6b7280",
};

export const ALL_REASONS: DowntimeReason[] = [
  "maintenance", "tool_change", "setup", "material_wait",
  "breakdown", "fault", "micro_stop", "other",
];
