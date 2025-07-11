import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export default function SensorGraphsPage() {
    const [sensors, setSensors] = useState([]);
    const [loading, setLoading] = useState(true);
    const { search } = useLocation();
    const queryParams = new URLSearchParams(search);
    const machineId = queryParams.get("machineId") || "";

    useEffect(() => {
        const fetchSensors = async () => {
            setLoading(true);
            try {
                console.log("Fetching sensors for machine ID:", machineId);
                const response = await fetchSensorsByMachine(machineId);
                console.log("Fetched sensors:", response);
                // setSensors(data.sensors || []);
            } catch (error) {
                console.error("Error fetching sensors:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSensors();
    }, [machineId]);

    return (
        <div className="flex flex-col items-center justify-center h-screen">
            <h1 className="text-2xl font-bold mb-4">Sensor Graphs Page</h1>
            <p>Machine ID: {machineId}</p>
        </div>
    );
}