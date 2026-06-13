import { API_URLS } from "../constants/ApiUrls";

const BASE = `${API_URLS.BACKEND_URL}/work-intervals`;

export type WorkInterval = {
  _id: string;
  machine: string;
  startedAt: string;
  stoppedAt: string | null;
};

async function doStop(machineId: string): Promise<WorkInterval | null> {
  const res = await fetch(`${BASE}/stop/${machineId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (res.status === 404) return null; // no active interval — that's fine
  if (!res.ok) return null;            // 500 / other — swallow silently
  return res.json();
}

export async function startWorkInterval(machineId: string): Promise<WorkInterval | null> {
  const res = await fetch(`${BASE}/start/${machineId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  if (res.ok) return res.json();

  if (res.status === 400) {
    // Stale open interval from a previous session — close it first, then retry
    await doStop(machineId);
    const retry = await fetch(`${BASE}/start/${machineId}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (retry.ok) return retry.json();
    return null;
  }

  return null; // any other error — swallow
}

export async function stopWorkInterval(machineId: string): Promise<WorkInterval | null> {
  return doStop(machineId);
}
