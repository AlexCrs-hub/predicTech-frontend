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
    const { message } = useWebSocket();

    useEffect(() => {
        const fetchSensors = async () => {
            setLoading(true);
            try {
                const response = await fetchSensorsByMachine(props.machineId);
                setSensors(response || []);
            } catch (error) {
                console.error("Error fetching sensors:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSensors();
    }, [props.machineId]);

    useEffect(() => {
        // Only fetch readings if sensors are loaded and not empty
        if (sensors.length === 0) return;

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
    }, [JSON.stringify(sensors.map(s => s._id))]); // Only run when sensor IDs change

    useEffect(() => {
        // Handle incoming messages from WebSocket
       if (!message) return;

       try{
        const parsed = JSON.parse(message);
        const measuredAt = new Date(parsed.measuredAt);
        const {measuredAt: _, ...sensorData} = parsed; // Exclude measuredAt from sensor data

        setSensors(prevSensors =>
            prevSensors.map(sensor => {
                const newValue = sensorData[sensor.name];
                if (newValue === undefined) return sensor;

                const newReading = {
                    measurement: newValue,
                    measuredAt: measuredAt,
                };

                return {
                    ...sensor,
                    readings: [...sensor.readings, newReading],
                };
            })
        );
        } catch (error) {
            console.error("Error parsing WebSocket message:", error);
        }
    }, [message]);

    return (
        <div className={`flex flex-col items-center px-2 w-full h-screen`}>
            <h1 className="text-2xl font-bold mb-4">Machine sensors</h1>
            {loading ? (
                <p>Loading sensors...</p>
            ) : (
                <div className="w-full flex-1 overflow-y-auto max-h-[calc(100vh-4rem)] flex flex-col gap-8">
                    {sensors.map((sensor: Sensor) => (
                        <div key={sensor._id} className="mb-8 w-full max-w-2xl mx-auto">
                            <h2 className="text-lg font-semibold mb-2">{sensor.name}</h2>
                            {sensor.readings && sensor.readings.length > 0 ? (
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={sensor.readings.map(r => ({
                                        ...r,
                                        // Format timestamp for X axis (optional)
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
            )}
        </div>
    );
}