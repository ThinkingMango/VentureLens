"use server";
import { cookies } from "next/headers";
import { isLocale, localeCookie } from "./config";

export async function saveLocale(value: string): Promise<{ ok: boolean }> {
  if (!isLocale(value)) return { ok: false };
  const store = await cookies();
  store.set(localeCookie, value, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return { ok: true };
}
