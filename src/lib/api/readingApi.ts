export async function fetchReadingsForSensor(sensorId: string) {
    const response = await fetch(`https://localhost:8081/api/readings/${sensorId}`, {
        credentials: "include",
    });
    return response.json();
}