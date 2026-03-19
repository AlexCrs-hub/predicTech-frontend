import { useWebSocket } from "@/context/WebSocketContext";
import { fetchReadingsForSensor } from "@/lib/api/readingApi";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { useState, useEffect } from "react";
import { ResponsiveContainer, CartesianGrid, XAxis, YAxis, Tooltip, Line, LineChart } from "recharts";

interface Reading {
    measurement: number;
    measuredAt: Date;
}

interface Sensor {
    _id: string;
    name: string;
    readings: Reading[];
}

export default function MachineSensors(props: { machineId: string, halfHeight?: boolean }) {
    const [sensors, setSensors] = useState<Sensor[]>([]);
    const [loading, setLoading] = useState(true);
    const { readings } = useWebSocket();

    useEffect(() => {
        const fetchSensors = async () => {
            setLoading(true);
            try {
                console.log(props.machineId);
                const response = await fetchSensorsByMachine(props.machineId);
                console.log(response);
                setSensors(Array.isArray(response) ? response : []);
            } catch (error) {
                console.error("Error fetching sensors:", error);
                setSensors([]);
            } finally {
                setLoading(false);
            }
        };
        fetchSensors();
    }, [props.machineId]);

    useEffect(() => {
        // Only fetch readings if sensors are loaded and not empty
        if (!Array.isArray(sensors) || sensors.length === 0) return;

        const fetchAllReadings = async () => {
            setLoading(true);
            try {
                const sensorsWithReadings = await Promise.all(
                    sensors.map(async (sensor) => {
                        const readings = await fetchReadingsForSensor(sensor._id);
                        return { ...sensor, readings };
                    })
                );
                setSensors(sensorsWithReadings);
            } catch (error) {
                console.error("Error fetching readings:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAllReadings();
    }, [sensors.length]); // Only run when number of sensors changes

    useEffect(() => {
  if (!readings) return;

  try {
    const parsed = JSON.parse(readings);
    const measuredAt = new Date(parsed.measuredAt);
    const incomingReadings = parsed.readings;

    if (!Array.isArray(incomingReadings)) return;

    setSensors(prevSensors =>
      prevSensors.map(sensor => {
        // find matching reading for this sensor
        const match = incomingReadings.find(
          (r: any) =>
            r.machineId === props.machineId &&
            r.sensorName === sensor.name
        );

        if (!match) return sensor;

        return {
          ...sensor,
          readings: [
            ...(sensor.readings || []),
            {
              measurement: match.value,
              measuredAt,
            },
          ],
        };
      })
    );
  } catch (error) {
    console.error("Error parsing WebSocket message:", error);
  }
}, [readings, props.machineId]);

    return (
        <div className={`flex flex-col items-center px-2 w-full h-screen`}>
            <h1 className="text-2xl font-bold mb-4">Machine sensors</h1>
            {loading ? (
                <p>Loading sensors...</p>
            ) : Array.isArray(sensors) && sensors.length > 0 ? (
                <div className="w-full flex-1 overflow-y-auto max-h-[calc(100vh-4rem)] flex flex-col gap-8">
                    {sensors.map((sensor: Sensor) => (
                        <div key={sensor._id} className="mb-8 w-full max-w-2xl mx-auto">
                            <h2 className="text-lg font-semibold mb-2">{sensor.name}</h2>
                            {sensor.readings && sensor.readings.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={sensor.readings.map(r => ({
                                        ...r,
                                        measuredAt: new Date(r.measuredAt).toLocaleString(),
                                    }))}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="measuredAt" tick={{ fontSize: 12 }} />
                                        <YAxis />
                                        <Tooltip />
                                        <Line type="monotone" dataKey="measurement" stroke="#8884d8" dot={false} />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-gray-500">No readings available.</p>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p>No sensors found for this machine.</p>
            )}
        </div>
    );
}