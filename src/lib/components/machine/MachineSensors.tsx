import { useWebSocket } from "@/context/WebSocketContext";
import { fetchReadingsForSensor } from "@/lib/api/readingApi";
import { fetchSensorsByMachine } from "@/lib/api/sensorApi";
import { Sensor } from "@/lib/types/Sensor";
import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
  LineChart,
} from "recharts";

const GRAPH_UPDATE_INTERVAL_MS = 5000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DISPLAY_POINTS = 200;

type PendingReading = { sensorName: string; value: number; measuredAt: Date };
type ChartPoint = { measuredAt: string; measurement: number };

function downsample(readings: Sensor["readings"], max: number): ChartPoint[] {
  if (!readings || readings.length === 0) return [];
  if (readings.length <= max) {
    return readings.map((r) => ({
      measurement: r.measurement,
      measuredAt: new Date(r.measuredAt).toLocaleTimeString(),
    }));
  }
  const step = readings.length / max;
  return Array.from({ length: max }, (_, i) => {
    const r = readings[Math.floor(i * step)];
    return {
      measurement: r.measurement,
      measuredAt: new Date(r.measuredAt).toLocaleTimeString(),
    };
  });
}

const SensorChart = memo(function SensorChart({ sensor }: { sensor: Sensor }) {
  const data = useMemo(
    () => downsample(sensor.readings, MAX_DISPLAY_POINTS),
    [sensor.readings],
  );

  if (!data.length)
    return <p className="text-xs text-gray-400 dark:text-zinc-500">No readings available.</p>;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="measuredAt"
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={35}
        />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Line
          type="monotone"
          dataKey="measurement"
          stroke="#6366f1"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

export default function MachineSensors(props: {
  machineId: string;
  machineName?: string;
  halfHeight?: boolean;
}) {
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [loading, setLoading] = useState(true);
  const { readings } = useWebSocket();
  const pendingRef = useRef<PendingReading[]>([]);

  useEffect(() => {
    if (props.machineId.startsWith("demo-")) { setLoading(false); return; }
    const fetchSensors = async () => {
      setLoading(true);
      try {
        const response = await fetchSensorsByMachine(props.machineId);
        setSensors(Array.isArray(response) ? response : []);
      } catch {
        setSensors([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSensors();
  }, [props.machineId]);

  useEffect(() => {
    if (!Array.isArray(sensors) || sensors.length === 0) return;

    const fetchAllReadings = async () => {
      setLoading(true);
      try {
        const sensorsWithReadings = await Promise.all(
          sensors.map(async (sensor) => {
            const readings = await fetchReadingsForSensor(sensor._id);
            return { ...sensor, readings };
          }),
        );
        setSensors(sensorsWithReadings);
      } catch {
        // keep existing data
      } finally {
        setLoading(false);
      }
    };

    fetchAllReadings();
  }, [sensors.length]);

  useEffect(() => {
    if (!readings) return;
    try {
      const parsed = JSON.parse(readings);
      const measuredAt = new Date(parsed.measuredAt);
      const incomingReadings = parsed.readings;
      if (!Array.isArray(incomingReadings)) return;
      for (const r of incomingReadings) {
        if (r.machineId === props.machineId) {
          pendingRef.current.push({
            sensorName: r.sensorName,
            value: r.value,
            measuredAt,
          });
        }
      }
    } catch {
      // ignore malformed messages
    }
  }, [readings, props.machineId]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (pendingRef.current.length === 0) return;
      const pending = pendingRef.current;
      pendingRef.current = [];
      const cutoff = new Date(Date.now() - ONE_DAY_MS);
      setSensors((prevSensors) =>
        prevSensors.map((sensor) => {
          const newReadings = pending
            .filter((r) => r.sensorName === sensor.name)
            .map((r) => ({ measurement: r.value, measuredAt: r.measuredAt }));
          if (newReadings.length === 0) return sensor;
          const merged = [...(sensor.readings || []), ...newReadings].filter(
            (r) => new Date(r.measuredAt) >= cutoff,
          );
          return { ...sensor, readings: merged };
        }),
      );
    }, GRAPH_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const sensorsWithData = sensors.filter((s) => s.readings && s.readings.length > 0);

  if (!loading && sensorsWithData.length === 0) return null;

  return (
    <>
      {sensorsWithData.map((sensor: Sensor) => (
        <div
          key={sensor._id}
          className="rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm p-5"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-3">
            {sensor.name}{" "}
            <span className="normal-case font-normal tracking-normal">
              ({sensor.unit})
            </span>
          </p>
          <SensorChart sensor={sensor} />
        </div>
      ))}
    </>
  );
}
