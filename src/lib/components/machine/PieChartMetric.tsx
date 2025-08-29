import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

interface PieChartMetricProps {
  title: string;
  data: { name: string; value: number }[];
  colors?: string[];
}

export default function PieChartMetric({title, data, colors}: PieChartMetricProps) {
    const defaultColors = ["#8884d8", "#82ca9d", "#ffc658", "#ff8042"];
    return (
    <div className="w-full h-64 flex flex-col items-center justify-center">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={70}
          >
            {(colors || defaultColors).map((color, idx) => (
              <Cell key={`cell-${idx}`} fill={color} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}