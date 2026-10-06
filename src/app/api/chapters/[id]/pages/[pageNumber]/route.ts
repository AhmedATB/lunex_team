import { NextRequest, NextResponse } from "next/server";
import { callBackend } from "@/lib/backend-client";
import { ACCESS_TOKEN_COOKIE } from "@/lib/session-cookies";

/** Takes one page out of a chapter (the pages after it move up). The backend checks who may. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; pageNumber: string }> }) {
  const { id, pageNumber } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }
  const result = await callBackend(`/v1/chapters/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageNumber)}`, {
    method: "DELETE",
    authToken: accessToken,
  });
  return NextResponse.json(result.body, { status: result.status });
}

/** Replaces one page of a chapter with a picture from the device (multipart, forwarded as it came). The backend checks who may. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; pageNumber: string }> }) {
  const { id, pageNumber } = await params;
  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (!accessToken) {
    return NextResponse.json({ code: "missing_token", message: "Authentication required." }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ code: "invalid_body", message: "Invalid upload." }, { status: 400 });
  }

  const result = await callBackend(`/v1/chapters/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageNumber)}`, {
    method: "PUT",
    body: formData,
    authToken: accessToken,
  });
  return NextResponse.json(result.body, { status: result.status });
}
