"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Secondary content is on demand on phones and visible on wider screens. */
export function MobileDisclosure({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className={className}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between text-left md:hidden"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {title}
        <ChevronDown
          className={cn("transition-transform duration-200 ease-[var(--ease-out)]", open && "rotate-180")}
        />
      </Button>
      <div id={id} data-open={open} className={cn("reveal mt-3 md:mt-0", !open && "hidden md:block")}>
        {children}
      </div>
    </div>
  );
}
