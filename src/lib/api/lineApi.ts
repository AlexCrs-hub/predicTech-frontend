import { API_URLS } from "../constants/ApiUrls";

export async function fetchUserLines() {
  const response = await fetch(`${API_URLS.BACKEND_URL}/lines`, {
    credentials: "include",
  });
  return response.json();
}

export async function addLine(requestBody: { name: string; userId: string }) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/lines`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  return response.json();
}
