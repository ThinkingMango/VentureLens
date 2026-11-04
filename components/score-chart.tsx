"use client";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
export function ScoreChart() {
  const data = [
    { name: "Proposal", score: 87 },
    { name: "Feedback", score: 83 },
    { name: "Finance", score: 79 },
    { name: "Workflow", score: 76 },
  ];
  return (
    <figure aria-label="Synthetic opportunity scores: proposal 87, feedback 83, finance 79, workflow 76 out of 100">
      <ChartContainer
        config={{ score: { label: "Demo score", color: "var(--chart-1)" } }}
        className="h-48 min-h-48 w-full aspect-auto"
      >
        <BarChart
          accessibilityLayer
          data={data}
          margin={{ top: 5, right: 0, left: -25, bottom: 0 }}
        >
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="3 4"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tickMargin={12}
            tick={{ fontSize: 14 }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 14 }}
          />
          <ChartTooltip
            cursor={{ fill: "var(--secondary)" }}
            content={<ChartTooltipContent />}
          />
          <Bar
            dataKey="score"
            fill="var(--color-score)"
            radius={[4, 4, 0, 0]}
            barSize={28}
            isAnimationActive={false}
          />
        </BarChart>
      </ChartContainer>
      <figcaption className="mt-4 text-sm text-muted-foreground">
        Illustrative composite scores, not validated rankings.
      </figcaption>
    </figure>
  );
}
