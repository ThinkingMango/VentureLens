import { researchErrors } from "../lib/research-core";
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
  STATUS_UNAVAILABLE:
    "Research status could not refresh. Showing the last server record.",
};
export function feedbackSource(code: unknown, fallback = "SAVE_FAILED") {
  return typeof code === "string" && Object.hasOwn(feedback, code)
    ? feedback[code]
    : feedback[fallback];
}
