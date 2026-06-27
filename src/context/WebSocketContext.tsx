import React, { createContext, useState, useRef, useEffect, useContext } from "react";
import { API_URLS } from "@/lib/constants/ApiUrls";

interface MachineStatePayload {
  machineId: string;
  state: "on" | "idle" | "off";
  health: "healthy" | "stale" | "disconnected";
  lastPowerKw?: number;
  lastSeenAt?: string;
  stateChangedAt?: string;
}

interface LiveReading {
  machineId: string;
  sensorName: string;
  normalizedName?: string;
  value: number;
  unit?: string;
  role?: string;
}

interface WebSocketContextType {
  readings: string;
  machineStates: Record<string, MachineStatePayload>;
  liveKw: Record<string, number>;
  // latestReadings: Record<string, Record<string, LiveReading>>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [readings, setReadings] = useState<string>("");
    const [machineStates, setMachineStates] = useState<Record<string, MachineStatePayload>>({});
    const [liveKw, setLiveKw] = useState<Record<string, number>>({}); 

    useEffect(() => {
  const source = new EventSource(
    `${API_URLS.BACKEND_URL}/realtime/events`,
    { withCredentials: true }
  );

  source.addEventListener("telemetry", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);

      setReadings(JSON.stringify({
        measuredAt: payload.measuredAt,
        readings: payload.readings || []
      }));

      const incomingReadings = payload.readings || [];

      setLiveKw((prev) => {
        const next = { ...prev };

        for (const r of incomingReadings) {
          const sensorName = String(r.normalizedName || r.sensorName || "").toLowerCase();
          const value = Number(r.value);

          if (!r.machineId || Number.isNaN(value)) continue;

          if (
            sensorName === "power" ||
            sensorName === "kw" ||
            sensorName.includes("power")
          ) {
            next[r.machineId] = value;
          }
        }

        return next;
      });

      if (payload.state) {
        setMachineStates((prev) => ({
          ...prev,
          [payload.state.machineId]: payload.state
        }));
      }

    } catch (err) {
      console.error("Invalid telemetry event:", err);
    }
  });

  source.addEventListener("machine-state", (event) => {
    try {
      const payload = JSON.parse((event as MessageEvent).data);

      setMachineStates((prev) => ({
        ...prev,
        [payload.machineId]: payload
      }));
    } catch {
      // ignore malformed event
    }
  });

  source.onerror = () => {
    console.error("Realtime connection lost. Browser will retry automatically.");
  };

  return () => source.close();
    }, []);
  
    return (
        <WebSocketContext.Provider value={{ readings, machineStates, liveKw }}>
            {children}
        </WebSocketContext.Provider>
    );
};

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}