
import BarConsumptionChart from "./BarConsumptionChart";

export default function MachineMetrics() {

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
            <BarConsumptionChart title="kW Consumption per day" data={kwData} />
        </div>
    );
}