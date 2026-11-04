"use client";
import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { useOptionalWorkspace } from "@/components/demo-provider";

const WorkspaceLink = forwardRef<
  HTMLAnchorElement,
  ComponentProps<typeof Link>
>(function WorkspaceLink({ href, ...props }, ref) {
  const workspace = useOptionalWorkspace();
  const destination =
    typeof href === "string" && workspace ? workspace.href(href) : href;
  return <Link {...props} href={destination} ref={ref} />;
});
export default WorkspaceLink;
