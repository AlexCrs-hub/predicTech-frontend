import { API_URLS } from "../constants/ApiUrls";

export type WindowPoint = { t: number; v: number };

export type WindowResponse = {
  sensorId: string;
  machineId: string;
  unit: string;
  count: number;
  truncated: boolean;
  points: WindowPoint[];
};

export type TimeseriesPoint = {
  t: number;
  avgPowerKw: number;
  minPowerKw: number;
  maxPowerKw: number;
  utilizationPct: number;
};

export type TimeseriesResponse = {
  machineId: string;
  granularity: string;
  count: number;
  points: TimeseriesPoint[];
};

export async function fetchReadingWindow(params: {
  sensorId: string;
  from?: string;
  to?: string;
  limit?: number;
  order?: "asc" | "desc";
}): Promise<WindowResponse> {
  const url = new URL(`${API_URLS.BACKEND_URL}/readings/window`);
  url.searchParams.set("sensorId", params.sensorId);
  if (params.from) url.searchParams.set("from", params.from);
  if (params.to) url.searchParams.set("to", params.to);
  if (params.limit != null) url.searchParams.set("limit", String(params.limit));
  if (params.order) url.searchParams.set("order", params.order);

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`readings/window ${res.status}`);
  return res.json();
}

export async function fetchPowerTimeseries(params: {
  machineId: string;
  from?: string;
  to?: string;
  granularity?: "minute" | "hour" | "day";
}): Promise<TimeseriesResponse> {
  const url = new URL(`${API_URLS.BACKEND_URL}/metrics/timeseries/${params.machineId}`);
  if (params.from) url.searchParams.set("from", params.from);
  if (params.to) url.searchParams.set("to", params.to);
  if (params.granularity) url.searchParams.set("granularity", params.granularity);

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(`metrics/timeseries ${res.status}`);
  return res.json();
}
