
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
        //get daily consumption for sensors with unit kW
        const fetchDailyConsumption = async () => {
            setLoading(true);
            try{
                const kWSensors = sensors.filter(sensor => sensor.unit === 'kW');
            
                const results = await Promise.all(
                    kWSensors.map(sensor => fetchDailyConsumptionForSensor(sensor._id))
                );
                console.log("Daily consumption results:", results);
                // results[i] corresponds to kWSensors[i]
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

    return (
        <div>
            {
                loading ? (
                    <p>Loading metrics...</p>
                ) : (
                    Object.keys(dailyConsumption).length > 0 ? (
                        Object.entries(dailyConsumption).map(([sensorName, data]) => (
                            <BarConsumptionChart title= {`kW Consumption of ${sensorName} for the last 7 days`} data={data} />
                        ))
                    ) : (
                        <p> No kW sensors found for this machine.</p>
                    )
                )
            }
        </div>
    );
}