import { PageSkeleton } from "@/components/skeletons";

// Shown inside the workspace shell while a page's data loads, so navigation answers at once.
export default function Loading() {
  return <PageSkeleton />;
}
