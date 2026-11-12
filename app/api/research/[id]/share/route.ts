import type { NextRequest } from "next/server";
import { deleteShare, getShare, postShare } from "@/lib/share-route";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** A report's read-only link (WP-26): read it, make it, turn it off. The rules live in lib/share-route.ts. */
export async function GET(request: NextRequest, context: Params) {
  return getShare("report", request, context);
}
export async function POST(request: NextRequest, context: Params) {
  return postShare("report", request, context);
}
export async function DELETE(request: NextRequest, context: Params) {
  return deleteShare("report", request, context);
}
