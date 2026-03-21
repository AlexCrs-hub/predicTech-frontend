
import { useEffect, useState } from "react";
import BarConsumptionChart from "./BarConsumptionChart";
import { Sensor } from "@/lib/types/Sensor";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { fetchDailyConsumptionForSensor } from "@/lib/api/readingApi";

interface MachineMetricsProps {
  id: string;
}

export default function MachineMetrics({ id }: MachineMetricsProps) {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);
    const [dailyConsumption, setDailyConsumption] = useState<Record<string, any>>({});

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

    useEffect(() => {
        if (loading || sensors.length === 0) return;
        //get daily consumption for sensors with unit kW
        const fetchDailyConsumption = async () => {
            setLoading(true);
            const kWSensors = sensors.filter(sensor => sensor.unit === 'kW');
        
            const results = await Promise.all(
                kWSensors.map(sensor => fetchDailyConsumptionForSensor(sensor._id))
            );

            // results[i] corresponds to kWSensors[i]
            const consumptionBySensor = kWSensors.reduce((acc, sensor, index) => {
                acc[sensor._id] = results[index];
                return acc;
            }, {} as Record<string, typeof results[0]>);
            
            setDailyConsumption(consumptionBySensor);
            setLoading(false);
        };

        fetchDailyConsumption();
    }, [loading, sensors]);
    
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