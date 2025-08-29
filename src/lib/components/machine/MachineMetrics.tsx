
import BarConsumptionChart from "./BarConsumptionChart";
import PieChartMetric from "./PieChartMetric";

export default function MachineMetrics() {

    const performanceData = [
        { name: "Good", value: 80 },
        { name: "Bad", value: 20 },
    ];
    const availabilityData = [
        { name: "Uptime", value: 90 },
        { name: "Downtime", value: 10 },
    ];
    const oeeData = [
        { name: "OEE", value: 75 },
        { name: "Loss", value: 25 },
    ];

    const kwData = [
        { name: "Mon", kw: 120 },
        { name: "Tue", kw: 150 },
        { name: "Wed", kw: 100 },
        { name: "Thu", kw: 170 },
        { name: "Fri", kw: 130 },
        { name: "Sat", kw: 90 },
        { name: "Sun", kw: 80 },
    ];

    return (
        <div>
            <div className="w-full grid grid-cols-3 gap-2">
                <PieChartMetric title="Performance" data={performanceData} />
                <PieChartMetric title="Availability" data={availabilityData} />
                <PieChartMetric title="OEE" data={oeeData} />
            </div>
            <BarConsumptionChart title="kW Consumption per day" data={kwData} />
        </div>
    );
}