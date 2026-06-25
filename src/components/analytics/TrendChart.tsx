"use client";

import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type LineSpec = {
  dataKey: string;
  name: string;
};

type TrendChartProps = {
  data: Array<Record<string, unknown>>;
  lines: LineSpec[];
  yDomain?: [number, number];
  emptyMessage?: string;
};

export function TrendChart({
  data,
  lines,
  yDomain,
  emptyMessage = "No data yet.",
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 24 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="dayLabel" tick={{ fontSize: 12 }} interval={4} tickMargin={8} />
        <YAxis tick={{ fontSize: 12 }} allowDecimals={!yDomain} domain={yDomain} />
        <Tooltip />
        {lines.map((line) => (
          <Line
            key={line.dataKey}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            dot={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
