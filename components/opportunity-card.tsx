"use client";
import Link from "next/link";
import { Bookmark, ArrowUpRight, Users } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Confidence, opportunityIcons } from "@/components/shared";
import { type Opportunity } from "@/lib/demo-data";
import { useDemo } from "@/components/demo-provider";
import { cn } from "@/lib/utils";
export function OpportunityCard({
  opportunity: o,
}: {
  opportunity: Opportunity;
}) {
  const { saved, toggleSave } = useDemo();
  const Icon = opportunityIcons[o.icon];
  return (
    <Card className="flex h-full flex-col transition-colors hover:border-primary/40">
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="size-5" />
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${saved.includes(o.id) ? "Unsave" : "Save"} ${o.title}`}
            aria-pressed={saved.includes(o.id)}
            onClick={() => toggleSave(o.id)}
          >
            <Bookmark
              className={cn(
                "text-muted-foreground",
                saved.includes(o.id) && "fill-primary/15 text-primary",
              )}
            />
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{o.category}</p>
          <CardTitle>
            <Link
              href={`/opportunities/${o.id}`}
              className="text-lg font-semibold leading-snug hover:text-primary"
            >
              {o.title}
            </Link>
          </CardTitle>
          <CardDescription className="leading-relaxed">
            {o.description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="size-4 shrink-0" />
          {o.buyer}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Confidence level={o.confidence} />
          <span className="text-sm text-muted-foreground">
            Synthetic evidence
          </span>
        </div>
      </CardContent>
      <CardFooter className="justify-between border-t px-6 py-4">
        <div className="flex items-baseline gap-1">
          <span className="text-xl font-semibold text-primary">{o.score}</span>
          <span className="text-sm text-muted-foreground">
            /100 opportunity score
          </span>
        </div>
        <Link
          href={`/opportunities/${o.id}`}
          aria-label={`View ${o.title}`}
          className="text-muted-foreground hover:text-primary"
        >
          <ArrowUpRight className="size-5" />
        </Link>
      </CardFooter>
    </Card>
  );
}
