import { NextResponse } from "next/server";
import { adminFetch, readJsonSafe } from "@/lib/server/novnc-admin";
import { toConnectionProfile } from "@/lib/novnc";

type AdminDevice = {
  name: string;
  token: string;
  target: string;
  note?: string;
};

export async function GET() {
  const response = await adminFetch("/api/devices");
  const body = await readJsonSafe<AdminDevice[] | { error?: string }>(response);

  if (!response.ok) {
    return NextResponse.json(
      { error: (body as { error?: string } | null)?.error || "Failed to load devices" },
      { status: response.status },
    );
  }

  const devices = Array.isArray(body) ? body : [];
  return NextResponse.json(devices.map(toConnectionProfile));
}

export async function POST(request: Request) {
  const payload = await request.json();

  const response = await adminFetch("/api/devices", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  const body = await readJsonSafe<AdminDevice | { error?: string }>(response);

  if (!response.ok) {
    return NextResponse.json(
      { error: (body as { error?: string } | null)?.error || "Failed to create device" },
      { status: response.status },
    );
  }

  return NextResponse.json(toConnectionProfile(body as AdminDevice), {
    status: response.status,
  });
}
