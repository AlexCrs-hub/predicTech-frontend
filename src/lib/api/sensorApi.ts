export async function addSensor(machineId: string, sensorName: string) {
  const response = await fetch(`https://localhost:8081/api/sensors`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: sensorName, machine: machineId }),
  });
  return response;
}

export async function fetchSensorsByMachine(machineId: string) {
  const response = await fetch(`https://localhost:8081/api/sensors/machine/${machineId}`, {
    credentials: "include",
  });
  console.log(response);
  return response.json();
}