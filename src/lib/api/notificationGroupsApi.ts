import { API_URLS } from "../constants/ApiUrls";

const BASE = `${API_URLS.BACKEND_URL}/notification-groups`;

async function apiFetch(url: string, method = "GET", body?: object) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`notification-groups ${method} failed: ${res.status}`);
  return res.json();
}

export type GroupName = "operator" | "maintenance" | "admin";

export async function fetchNotificationGroups(): Promise<GroupName[]> {
  return apiFetch(BASE);
}

export async function addPhoneToGroup(groupName: GroupName, phoneNumber: string): Promise<unknown> {
  return apiFetch(`${BASE}/${groupName}/add`, "PATCH", { phoneNumber });
}

export async function removePhoneFromGroup(groupName: GroupName, phoneNumber: string): Promise<unknown> {
  return apiFetch(`${BASE}/${groupName}/remove`, "PATCH", { phoneNumber });
}
