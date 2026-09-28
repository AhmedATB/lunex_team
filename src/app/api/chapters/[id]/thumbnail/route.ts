import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

type Context = { params: Promise<{ id: string }> };

const unauthenticated = () => NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });

/** A chapter's featured picture from the device (multipart, forwarded as it came). The backend checks who may. */
export async function PUT(req: NextRequest, { params }: Context) {
  const { id } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  const formData = await req.formData().catch(() => null);
  if (!formData) return NextResponse.json({ code: "invalid_body", message: "Invalid upload." }, { status: 400 });

  const result = await callBackend(`/v1/chapters/${encodeURIComponent(id)}/thumbnail`, { method: "PUT", body: formData, authToken: accessToken });
  return NextResponse.json(result.body, { status: result.status });
}

/** Takes the featured picture off. */
export async function DELETE(req: NextRequest, { params }: Context) {
  const { id } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) return unauthenticated();

  const result = await callBackend(`/v1/chapters/${encodeURIComponent(id)}/thumbnail`, { method: "DELETE", authToken: accessToken });
  if (result.status === 204) return new NextResponse(null, { status: 204 });
  return NextResponse.json(result.body, { status: result.status });
}
