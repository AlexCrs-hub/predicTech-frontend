import { API_URLS } from "../constants/ApiUrls";

const BASE = `${API_URLS.BACKEND_URL}/work-intervals`;

export type WorkInterval = {
  _id: string;
  machine: string;
  startedAt: string;
  stoppedAt: string | null;
};

async function apiFetch(url: string, method: string): Promise<WorkInterval> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`work-intervals ${method} failed: ${res.status}`);
  return res.json();
}

export async function startWorkInterval(machineId: string): Promise<WorkInterval> {
  return apiFetch(`${BASE}/start/${machineId}`, "POST");
}

export async function stopWorkInterval(machineId: string): Promise<WorkInterval> {
  return apiFetch(`${BASE}/stop/${machineId}`, "PATCH");
}
