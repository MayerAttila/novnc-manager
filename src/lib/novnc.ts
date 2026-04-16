export type ConnectionProfile = {
  id: string;
  name: string;
  host: string;
  port: string;
  password: string;
  notes: string;
  updatedAt: string;
  lastOpenedAt?: string;
};

export const STORAGE_KEY = "novnc-manager.connections.v3";

export const DEFAULT_PROFILES: ConnectionProfile[] = [
  {
    id: "machine-62",
    name: "Machine 62",
    host: "192.168.0.104:6901",
    port: "6901",
    password: "",
    notes: "Current noVNC gateway.",
    updatedAt: "2026-04-15T00:00:00.000Z",
  },
];

export function createProfileId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `profile-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function withProtocol(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

function sanitizeGatewayHost(input: string) {
  const value = input.trim();
  if (!value) {
    return value;
  }

  return value.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

export function buildLaunchUrl(profile: ConnectionProfile) {
  const base = withProtocol(sanitizeGatewayHost(profile.host));
  const url = new URL(base);
  url.pathname = "/vnc.html";

  const params = new URLSearchParams({
    host: url.hostname,
    port: profile.port.trim() || url.port || "6901",
    autoconnect: "1",
    resize: "remote",
    path: "websockify",
  });

  if (profile.password.trim()) {
    params.set("password", profile.password.trim());
  }

  url.search = params.toString();
  return url.toString();
}

export function getConnectionSubtitle(profile: ConnectionProfile) {
  return `${sanitizeGatewayHost(profile.host)}:${profile.port || "6901"}`;
}
