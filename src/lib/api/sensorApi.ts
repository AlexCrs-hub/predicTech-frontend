import { API_URLS } from "../constants/ApiUrls";

export async function addSensor(machineId: string, sensorName: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/sensors`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: sensorName, machine: machineId }),
  });
  return response;
}

export async function fetchSensorsByMachine(machineId: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/sensors/machine/${machineId}`, {
    credentials: "include",
  });
  return response.json();
}