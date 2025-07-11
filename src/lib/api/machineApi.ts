export async function fetchAllMachines() {
  const response = await fetch("https://localhost:8081/api/machines", {
    credentials: "include",
  });
  return response.json();
}

export async function fetchMachinesByLine(lineId: string) {
  const response = await fetch(`https://localhost:8081/api/machines/line/${lineId}`, {
    credentials: "include",
  });
  return response.json();
}

export async function addMachine(lineId: string, machineName: string) {
  const response = await fetch(`https://localhost:8081/api/machines/line/${lineId}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: machineName }),
  });
  return response.json();
}

export async function deleteMachine(machineId: string) {
  const response = await fetch(`https://localhost:8081/api/machines/${machineId}`, {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });
  return response.json();
}