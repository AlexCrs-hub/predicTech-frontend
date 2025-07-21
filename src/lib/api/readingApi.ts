import { API_URLS } from "../constants/ApiUrls";

export async function fetchReadingsForSensor(sensorId: string) {
    const response = await fetch(`${API_URLS.BACKEND_URL}/readings/${sensorId}`, {
        credentials: "include",
    });
    return response.json();
}