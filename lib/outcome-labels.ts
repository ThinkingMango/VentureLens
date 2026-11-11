import type { Copy } from "../i18n/use-copy";
import type { GateReason } from "./research-core";

// Why a candidate did or did not become an opportunity, in the reader's language. Shared by the run page's outcome
// list (components/research-outcome.tsx) and report exports (lib/report-export.ts), which also render on the server.

export function reasonText(copy: Copy, reason: GateReason) {
  switch (reason) {
    case "SEARCH_FAILED": return copy("The web search for this idea returned no page we could read.");
    case "NO_SOURCES": return copy("No source we could read supported this idea.");
    case "CONTRADICTED": return copy("The relevant sources we found argue against this idea.");
    case "SINGLE_DOMAIN": return copy("Support came from only one publisher. The evidence rules need at least two independent ones.");
    case "VENDOR_ONLY": return copy("Support came only from companies selling a solution, or did not show buyer pain or demand. The evidence rules need at least one independent source that does.");
    case "REVIEW_REJECTED": return copy("It passed the evidence rules, but the adversarial review found the conclusion unsupported.");
    case "NOT_EVALUATED": return copy("It passed the evidence rules but was not evaluated in this run.");
    case "ALL_DUPLICATES": return copy("You have already seen this idea in an earlier run, so it was not researched again.");
    case "PASSED": return copy("Passed the evidence rules and the review.");
  }
}
