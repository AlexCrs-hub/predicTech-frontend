import { API_URLS } from "../constants/ApiUrls";

export type ApiPeriod = "day" | "week" | "month";

/** Convert frontend hours value to API period string */
export function toPeriod(hours: number): ApiPeriod {
  if (hours >= 720) return "month";
  if (hours >= 168) return "week";
  return "day";
}

async function get(path: string) {
  const res = await fetch(`${API_URLS.BACKEND_URL}${path}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error(`metrics ${path} failed: ${res.status}`);
  return res.json();
}

export async function fetchCycles(machineId: string, period: ApiPeriod) {
  return get(`/metrics/cycles/${machineId}/${period}`) as Promise<{
    cycles: number;
    period: string;
    machineId: string;
  }>;
}

export async function fetchDowntimeHours(machineId: string, period: ApiPeriod) {
  return get(`/metrics/downtime/${machineId}/${period}`) as Promise<{
    downtimeHours: number;
    period: string;
    machineId: string;
  }>;
}

export async function fetchUtilization(machineId: string, period: ApiPeriod) {
  return get(`/metrics/utilization/${machineId}/${period}`) as Promise<{
    utilizationPercentage: number;
    period: string;
    machineId: string;
  }>;
}

export async function fetchCutting(machineId: string, period: ApiPeriod) {
  return get(`/metrics/cutting/${machineId}/${period}`) as Promise<{
    cuttingHours: number;
    cuttingPercentage: number;
    cuttingThreshold: number;
    period: string;
    machineId: string;
  }>;
}

export async function fetchPlannedUnplanned(
  machineId: string,
  period: ApiPeriod,
) {
  return get(`/metrics/planned-unplanned/${machineId}/${period}`) as Promise<{
    plannedHours: number;
    unplannedHours: number;
    plannedPercentage: number;
    unplannedPercentage: number;
    period: string;
    machineId: string;
  }>;
}
// new V2 metrics summary endpoint call
export async function fetchMetricSummary(machineId: string, period: ApiPeriod) {
  return get(`/metrics/summary/${machineId}/${period}`) as Promise<{
    machineId: string;
    period: string;
    avgPowerKw: number;
    energyKwh: number;
    utilizationPercentage: number;
    downtimeHours: number;
    idleHours: number;
    cycles: number;
  }>;
}