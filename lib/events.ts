import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventProps, type EventProps, type ProductEvent } from "@/lib/events-core";

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
