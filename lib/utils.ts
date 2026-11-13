import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Inline style for a .progress-fill at `percent` (0–100): the full-width fill slides into view with transform. */
export function progressFill(percent: number): { transform: string } {
  const value = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return { transform: `translateX(${value - 100}%)` };
}
