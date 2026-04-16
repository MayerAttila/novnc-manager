import { NextResponse } from "next/server";
import { adminFetch, readJsonSafe } from "@/lib/server/novnc-admin";
import { toConnectionProfile } from "@/lib/novnc";

type AdminDevice = {
  name: string;
  token: string;
  target: string;
  note?: string;
};

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const response = await adminFetch(`/api/devices/${encodeURIComponent(token)}`, {
    method: "DELETE",
  });

  const body = await readJsonSafe<{ error?: string; ok?: boolean }>(response);

  if (!response.ok) {
    return NextResponse.json(
      { error: body?.error || "Failed to remove device" },
      { status: response.status },
    );
  }

  return NextResponse.json({ ok: true });
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const payload = await request.json();

  const deleteResponse = await adminFetch(
    `/api/devices/${encodeURIComponent(token)}`,
    {
      method: "DELETE",
    },
  );

  const deleteBody = await readJsonSafe<{ error?: string }>(deleteResponse);
  if (!deleteResponse.ok) {
    return NextResponse.json(
      { error: deleteBody?.error || "Failed to update device" },
      { status: deleteResponse.status },
    );
  }

  const createResponse = await adminFetch("/api/devices", {
    method: "POST",
    body: JSON.stringify({ ...payload, token }),
  });
  const createBody = await readJsonSafe<AdminDevice | { error?: string }>(
    createResponse,
  );

  if (!createResponse.ok) {
    return NextResponse.json(
      { error: (createBody as { error?: string } | null)?.error || "Failed to update device" },
      { status: createResponse.status },
    );
  }

  return NextResponse.json(toConnectionProfile(createBody as AdminDevice), {
    status: createResponse.status,
  });
}
