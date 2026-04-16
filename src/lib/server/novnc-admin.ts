const adminOrigin =
  process.env.NOVNC_ADMIN_ORIGIN || "http://192.168.0.104:6902";
const adminUser = process.env.NOVNC_ADMIN_USER || "admin";
const adminPass = process.env.NOVNC_ADMIN_PASS || "admin";

function getAuthHeader() {
  const token = Buffer.from(`${adminUser}:${adminPass}`).toString("base64");
  return `Basic ${token}`;
}

export async function adminFetch(path: string, init?: RequestInit) {
  const url = new URL(path, adminOrigin);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", getAuthHeader());

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });

  return response;
}

export async function readJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
