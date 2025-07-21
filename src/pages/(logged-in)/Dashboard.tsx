import { BarChartRatings } from "@/lib/components/dashboard/BarChartRatings";
import RuntimePieChart from "@/lib/components/dashboard/RuntimePieChart";
import StatsCard from "@/lib/components/dashboard/StatsCard";
import { LineChartEnergy } from "@/lib/components/dashboard/LineChartEnergy";
import { Button } from "@/lib/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export interface StatsCardProps {
  title: string;
  description: string;
  value: string;
}

export default function Dashboard() {
  const { getUser } = useAuth();
  const userData = getUser();
  return (
    <div className="w-full py-4 gap-8 flex flex-col">
      <div className="grid grid-cols-3 gap-8">
        <StatsCard
          title={"OEE"}
          description={"Overall Equipment Effectiveness"}
          value={"79 %"}
        />
        <RuntimePieChart />
        <div className="flex gap-2 grid-cols-[1fr,_1fr,_1fr] border p-8 rounded-xl">
          <div className="w-full">
            <Button className="w-1/3 rounded">Daily</Button>
            <Button className="w-1/3 rounded">Weekly</Button>
            <Button className="w-1/3 rounded">Monthly</Button>
            <LineChartEnergy />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-8">
        <BarChartRatings />
        <div className="border rounded-xl p-8 h-[350px]">
          <LineChartEnergy />
        </div>
      </div>
    </div>
  );
}
