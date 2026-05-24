import { useEffect, useState } from "react";
import BarConsumptionChart from "./BarConsumptionChart";
import { Sensor } from "@/lib/types/Sensor";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { fetchDailyConsumptionForSensor } from "@/lib/api/readingApi";

const PERIODS = [
  { label: "1 day",   days: 1  },
  { label: "7 days",  days: 7  },
  { label: "1 month", days: 30 },
] as const;
type Period = typeof PERIODS[number];

interface MachineMetricsProps {
  id: string;
}

export default function MachineMetrics({ id }: MachineMetricsProps) {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);
    const [dailyConsumption, setDailyConsumption] = useState<Record<string, any>>({});
    const [period, setPeriod] = useState<Period>(PERIODS[1]); // default 7 days

    useEffect(() => {
        const fetchSensors = async () => {
            if(!id) return;
            setLoading(true);
            try {
                const response = await fetchSensorsByMachine(id);
                setSensors(Array.isArray(response) ? response : []);
            } catch (error) {
                console.error("Error fetching sensors:", error);
                setSensors([]);
            } finally {
                setLoading(false);
            }
        };
        fetchSensors();
    }, [id]);

    useEffect(() => {
        if (loading || sensors.length === 0) return;
        const fetchDailyConsumption = async () => {
            setLoading(true);
            try{
                const kWSensors = sensors.filter(sensor => sensor.unit === 'kW');
                const results = await Promise.all(
                    kWSensors.map(sensor => fetchDailyConsumptionForSensor(sensor._id))
                );
                const consumptionBySensor = kWSensors.reduce((acc, sensor, index) => {
                    acc[sensor.name] = results[index];
                    return acc;
                }, {} as Record<string, typeof results[0]>);
                setDailyConsumption(consumptionBySensor);
            } catch (error) {
                console.error("Error fetching daily consumption:", error);
                setDailyConsumption({});
            } finally {
                setLoading(false);
            }
        };
        fetchDailyConsumption();
    }, [sensors]);

    if (loading) return <p>Loading metrics...</p>;
    if (Object.keys(dailyConsumption).length === 0) return <p>No kW sensors found for this machine.</p>;

    return (
        <div className="flex flex-col gap-4">
            {/* period toggle */}
            <div className="flex justify-end">
                <div className="flex rounded-md border border-gray-200 dark:border-zinc-700 overflow-hidden">
                    {PERIODS.map((p) => (
                        <button
                            key={p.label}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 text-sm transition-colors ${
                                period.label === p.label
                                    ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
                                    : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {Object.entries(dailyConsumption).map(([sensorName, data]) => {
                const sliced = Array.isArray(data) ? data.slice(-period.days) : data;
                return (
                    <BarConsumptionChart
                        key={sensorName}
                        title={`kW Consumption — ${sensorName} (last ${period.label})`}
                        data={sliced}
                    />
                );
            })}
        </div>
    );
}
