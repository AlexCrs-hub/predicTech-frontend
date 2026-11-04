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
  /** Set by the reportable/timeline endpoints: open records end at the machine's last-seen time */
  effectiveEnd?: string;
  durationMs?: number;
};

export type ReportableSummary = {
  counts: Record<string, number>;
  windowHours: number;
  minDurationMs: number;
};

export type DowntimeBreakdown = {
  period: ApiPeriod;
  machineId: string | null;
  from: string;
  to: string;
  totalMs: number;
  reasons: { reason: DowntimeReason; ms: number; count: number }[];
  unreported: { ms: number; count: number };
  typeMs: { planned: number; unplanned: number };
  minDurationMs: number;
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

/** Unreported downtime (≥ min duration) from the last `hours`, oldest first */
export async function fetchReportableDowntime(machineId: string, hours?: number): Promise<DowntimeRecord[]> {
  const q = hours ? `?hours=${hours}` : "";
  return apiFetch(`${BASE}/reportable/${machineId}${q}`);
}

export async function fetchReportableSummary(): Promise<ReportableSummary> {
  return apiFetch(`${BASE}/reportable-summary`);
}

/** Downtime (reported or not) overlapping the last `hours`, oldest first */
export async function fetchDowntimeTimeline(machineId: string, hours: number): Promise<DowntimeRecord[]> {
  return apiFetch(`${BASE}/timeline/${machineId}?hours=${hours}`);
}

export async function fetchDowntimeBreakdown(period: ApiPeriod, machineId?: string): Promise<DowntimeBreakdown> {
  const q = machineId ? `?machineId=${machineId}` : "";
  return apiFetch(`${BASE}/breakdown/${period}${q}`);
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

/** Downtime that still needs a reason */
export const UNREPORTED_COLOR = "#ef4444";

export function downtimeColor(r: DowntimeRecord): string {
  return r.reasonRecorded && r.reason ? REASON_COLOR[r.reason] : UNREPORTED_COLOR;
}

/** End of a downtime record for display: resolved time, else last-seen, else now */
export function downtimeEnd(r: DowntimeRecord): Date {
  return new Date(r.resolvedAt ?? r.effectiveEnd ?? Date.now());
}

export function formatDuration(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
