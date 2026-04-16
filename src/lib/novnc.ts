export type ConnectionProfile = {
  id: string;
  token: string;
  name: string;
  host: string;
  port: string;
  notes: string;
  lastOpenedAt?: string;
};

export type DevicePayload = {
  name: string;
  host: string;
  port: string;
  note: string;
  token?: string;
};

export const LAST_OPENED_STORAGE_KEY = "novnc-manager.last-opened.v1";

export const DEFAULT_GATEWAY_ORIGIN =
  process.env.NEXT_PUBLIC_NOVNC_GATEWAY_ORIGIN || "http://192.168.0.104:6901";

export function toConnectionProfile(input: {
  name: string;
  token: string;
  target: string;
  note?: string;
}): ConnectionProfile {
  const [host = "", port = "5900"] = String(input.target || "").split(":");

  return {
    id: input.token,
    token: input.token,
    name: input.name,
    host,
    port,
    notes: input.note || "",
  };
}

export function createDevicePayload(input: {
  name: string;
  host: string;
  port: string;
  notes: string;
  token?: string;
}): DevicePayload {
  return {
    name: input.name.trim(),
    host: input.host.trim(),
    port: input.port.trim(),
    note: input.notes.trim(),
    ...(input.token ? { token: input.token.trim() } : {}),
  };
}

function withProtocol(url: string) {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export function getGatewayOrigin() {
  return withProtocol(DEFAULT_GATEWAY_ORIGIN);
}

export function buildLaunchUrl(profile: ConnectionProfile) {
  const gateway = new URL(getGatewayOrigin());
  const url = new URL("/vnc.html", gateway);

  const params = new URLSearchParams({
    host: gateway.hostname,
    port:
      gateway.port || (gateway.protocol === "https:" ? "443" : "80"),
    autoconnect: "1",
    resize: "remote",
    path: `?token=${profile.token}`,
  });

  url.search = params.toString();
  return url.toString();
}

export function getConnectionSubtitle(profile: ConnectionProfile) {
  return `${profile.host}:${profile.port || "5900"}`;
}
