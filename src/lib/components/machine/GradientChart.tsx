"use client";

import { TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/lib/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/lib/components/ui/chart";

const chartConfig = {
  value: {
    label: "Intensity",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;

export default function GradientChart({ data }: { data: number[] }) {
  const chartData = data.map((value, index) => ({ index: index + 1, value }));

  return (
    <Card className="h-[30rem]">
      <CardHeader>
        <CardTitle>Intensity Chart</CardTitle>
        <CardDescription>Recording intensity over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-72 w-full">
          <AreaChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="index"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `T${value}`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 1]}
            />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1A32F6" stopOpacity={0.9} />
                <stop offset="95%" stopColor="#1A32F6" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <Area
              dataKey="value"
              type="natural"
              fill="url(#fillValue)"
              fillOpacity={0.4}
              stroke="var(--chart-1)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className="flex w-full items-start gap-2 text-sm">
          <div className="grid gap-2">
            <div className="flex items-center gap-2 font-medium leading-none">
              Trending up by 5.2% this month <TrendingUp className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2 leading-none text-muted-foreground">
              Dynamic Data Chart
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
