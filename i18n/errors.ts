import { researchErrors } from "../lib/research-core.ts";
export const feedback: Record<string, string> = {
  ...researchErrors,
  AUTH_REQUIRED: "Your session has expired. Please log in again.",
  EMAIL_UNVERIFIED:
    "Please confirm your email before logging in. Check your inbox and spam folder.",
  PROFILE_REQUIRED: "Complete your founder profile before starting research.",
  NOT_FOUND: "This record is unavailable. Return to your research history.",
  INVALID_INPUT: "Check the form fields and try again.",
  INVALID_ORIGIN:
    "This request could not be verified. Refresh the page and try again.",
  JSON_REQUIRED: "Refresh the page and try again.",
  REQUEST_TOO_LARGE:
    "This request is too large. Shorten your input and try again.",
  RETRY_UNAVAILABLE:
    "This task cannot be retried. Check its latest status in research history.",
  WORKSPACE_UNAVAILABLE:
    "Your workspace could not be loaded. Please try again.",
  SAVE_FAILED: "Your change could not be saved. Please try again.",
  ALREADY_FLAGGED: "You already flagged this.",
  SPRINT_CLOSED: "This sprint has ended.",
  SPRINT_ACTIVE: "This opportunity already has an active sprint.",
  TOO_MANY_TASKS: "A sprint can hold 50 tasks.",
  RUN_ACTIVE: "This research is still running. You can delete it once it has finished.",
  STATUS_UNAVAILABLE:
    "Research status could not refresh. Showing the last server record.",
  NETWORK_ERROR:
    "The connection dropped before the server replied. Your research may already have started: check My research before trying again.",
  START_FAILED: "Research could not start right now. Please try again.",
};
export function feedbackSource(code: unknown, fallback = "SAVE_FAILED") {
  return typeof code === "string" && Object.hasOwn(feedback, code)
    ? feedback[code]
    : feedback[fallback];
}
