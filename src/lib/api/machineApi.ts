import { API_URLS } from "../constants/ApiUrls";

export async function fetchAllMachines() {
  const response = await fetch(`${API_URLS.BACKEND_URL}/machines`, {
    credentials: "include",
  });
  return response.json();
}

export async function fetchMachinesByLine(lineId: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/machines/line/${lineId}`, {
    credentials: "include",
  });
  return response.json();
}

export async function addMachine(lineId: string, machineName: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/machines/line/${lineId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: machineName }),
  });
  return response.json();
}

export async function deleteMachine(machineId: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/machines/${machineId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}

export async function fetchMachineById(machineId: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/machines/${machineId}`, {
    credentials: "include",
  });
  return response.json();
}