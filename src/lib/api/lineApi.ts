export async function fetchUserLines() {
  const response = await fetch("https://localhost:8081/api/lines", {
    credentials: "include",
  });
  return response.json();
}

export async function addLine(requestBody: { name: string; userId: string }) {
  const response = await fetch("https://localhost:8081/api/lines", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });
  return response.json();
}
