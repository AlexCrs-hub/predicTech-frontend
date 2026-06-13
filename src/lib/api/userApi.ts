import { API_URLS } from "../constants/ApiUrls";

export async function updatePhoneNumber(phoneNumber: string): Promise<{ message: string; phoneNumber: string }> {
  const res = await fetch(`${API_URLS.BACKEND_URL}/users/add-number`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber }),
  });
  if (!res.ok) throw new Error(`Failed to update phone number: ${res.status}`);
  return res.json();
}
