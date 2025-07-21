import { API_URLS } from "../constants/ApiUrls";

export async function registerUser(email: string, name: string, password: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/auth/signup`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  return response.json();
}

export async function loginUser(email: string, password: string) {
  const response = await fetch(`${API_URLS.BACKEND_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function logoutUser() {
  const response = await fetch(`${API_URLS.BACKEND_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  return response.json();
}