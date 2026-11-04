"use client";
import { useLocale } from "next-intl";
import { useCopy } from "./use-copy";
import {
  opportunities,
  researchReports,
  type Opportunity,
  type DemoReport,
} from "@/lib/demo-data";

export function useDemoContent() {
  const copy = useCopy();
  const locale = useLocale();
  const amount = (value: string) => {
    const match = /^\$(\d+)–(\d+)$/.exec(value);
    if (!match) return value;
    const number = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    });
    return `${number.format(Number(match[1]))}–${number.format(Number(match[2]))}`;
  };
  const opportunity = (item: Opportunity): Opportunity => ({
    ...item,
    title: copy(item.title),
    category: copy(item.category),
    description: copy(item.description),
    buyer: copy(item.buyer),
    pain: copy(item.pain),
    risk: copy(item.risk),
    revenue: amount(item.revenue),
    cost: amount(item.cost),
  });
  const report = (id: string): DemoReport => {
    const original = researchReports[id];
    return {
      approach: copy(original.approach),
      buyerJob: copy(original.buyerJob),
      alternative: copy(original.alternative),
      trigger: copy(original.trigger),
      firstTest: copy(original.firstTest),
      sources: original.sources.map((source) => ({
        title: copy(source.title),
        type: copy(source.type),
        detail: copy(source.detail),
        observation: copy(source.observation),
        implication: copy(source.implication),
        limitation: copy(source.limitation),
      })),
    };
  };
  return { opportunities: opportunities.map(opportunity), opportunity, report };
}
