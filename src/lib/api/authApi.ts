export async function registerUser(email: string, name: string, password: string) {
  const response = await fetch("https://localhost:8081/api/auth/signup", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, name, password }),
  });
  return response.json();
}

export async function loginUser(email: string, password: string) {
  const response = await fetch("https://localhost:8081/api/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

export async function logoutUser() {
  const response = await fetch("https://localhost:8081/api/logout", {
    method: "POST",
    credentials: "include",
  });
  return response.json();
}