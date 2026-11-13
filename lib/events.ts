import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dailyEvents, eventProps, onceEvents, utcDayStart, type EventProps, type ProductEvent } from "@/lib/events-core";

/**
 * Records a product event. Never throws and never rejects: analytics must not break the action it describes.
 * In a request, schedule it with `after(() => track(...))` so the response does not wait; in a workflow step, await
 * it (it resolves quickly and swallows its own failures). Events that fail validation are dropped and logged.
 */
export async function track<E extends ProductEvent>(event: E, options: { userId?: string | null; props: EventProps<E> }): Promise<void> {
  try {
    const props = eventProps(event, options.props);
    if (!props) {
      console.warn("[events] dropped an event that failed validation", { event });
      return;
    }
    const { error } = await createAdminClient().from("product_events").insert({ event, user_id: options.userId ?? null, props });
    if (error) console.warn("[events] could not record an event", { event, message: error.message });
  } catch (error) {
    console.warn("[events] could not record an event", { event, message: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Records a daily event (`dailyEvents`) unless this founder already has one today (UTC). Like track(), it never throws.
 * Two requests at the same moment can both record one; the funnel counts founders, not events, so that is harmless.
 */
export async function trackDaily<E extends (typeof dailyEvents)[number]>(event: E, options: { userId: string; props: EventProps<E>; now?: Date }): Promise<void> {
  try {
    const { data, error } = await createAdminClient().from("product_events").select("id")
      .eq("event", event).eq("user_id", options.userId).gte("created_at", utcDayStart(options.now ?? new Date())).limit(1);
    if (error) {
      console.warn("[events] could not check for an earlier event", { event, message: error.message });
      return;
    }
    if (data?.length) return;
    await track(event, { userId: options.userId, props: options.props });
  } catch (error) {
    console.warn("[events] could not record an event", { event, message: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * Records an event (`onceEvents`) unless this founder already has one. Like track(), it never throws. Two sign-ins at the
 * same moment could both record one; sign-up counts are read per founder, so a duplicate does not change them.
 */
export async function trackOnce<E extends (typeof onceEvents)[number]>(event: E, options: { userId: string; props: EventProps<E> }): Promise<void> {
  try {
    const { data, error } = await createAdminClient().from("product_events").select("id")
      .eq("event", event).eq("user_id", options.userId).limit(1);
    if (error) {
      console.warn("[events] could not check for an earlier event", { event, message: error.message });
      return;
    }
    if (data?.length) return;
    await track(event, { userId: options.userId, props: options.props });
  } catch (error) {
    console.warn("[events] could not record an event", { event, message: error instanceof Error ? error.message : String(error) });
  }
}
