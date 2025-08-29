import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

interface BarConsumptionChartProps {
  title: string;
  data: { name: string; kw: number }[];
}

export default function BarConsumptionChart({ title, data }: BarConsumptionChartProps) {
    return (
        <div className="w-full max-w-3xl mx-auto bg-white dark:bg-zinc-900 rounded-lg shadow-md p-4">
            <h3 className="text-lg font-semibold mb-4 text-predic">{title}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="kw" fill="#8884d8" />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}