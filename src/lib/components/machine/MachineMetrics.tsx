
import { useEffect, useState } from "react";
import BarConsumptionChart from "./BarConsumptionChart";
import { Sensor } from "@/lib/types/Sensor";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";

interface MachineMetricsProps {
  id: string;
}

export default function MachineMetrics({ id }: MachineMetricsProps) {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
            const fetchSensors = async () => {
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