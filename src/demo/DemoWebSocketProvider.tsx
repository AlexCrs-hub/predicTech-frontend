import React, { useState, useEffect } from "react";
import { WebSocketContext } from "@/context/WebSocketContext";
import { DEMO_MACHINES } from "./machines";

type State = "ON" | "IDLE" | "OFF";
type Health = "HEALTHY" | "STALE" | "DISCONNECTED";

interface MachineStatePayload {
  machineId: string;
  state: State;
  health: Health;
  timestamp: number;
}

// Initial machine states — 4 ON, 1 IDLE (welder)
function initStates(): Record<string, MachineStatePayload> {
  return Object.fromEntries(
    DEMO_MACHINES.map((m) => [
      m._id,
      {
        machineId: m._id,
        state: m.status === "on" ? "ON" : "IDLE",
        health: "HEALTHY",
        timestamp: Date.now(),
      },
    ])
  );
}

// Initial live kW values
function initKw(): Record<string, number> {
  return Object.fromEntries(
    DEMO_MACHINES.map((m) => [
      m._id,
      m.liveKw,
    ])
  );
}

export const DemoWebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [machineStates, setMachineStates] = useState(initStates);
  const [liveKw, setLiveKw]               = useState(initKw);

  // Fluctuate live kW every 3 s with a smooth random walk
  useEffect(() => {
    const id = setInterval(() => {
      setLiveKw((prev) => {
        const next = { ...prev };
        DEMO_MACHINES.forEach((m) => {
          const isOn = machineStates[m._id]?.state === "ON";
          const target = isOn
            ? m.maxPowerConsumption * 0.78
            : m.downtimeThreshold * 1.15;
          const cur = prev[m._id] ?? target;
          // Smooth toward target with ±3 % noise
          const noise = (Math.random() - 0.5) * m.maxPowerConsumption * 0.06;
          next[m._id] = +Math.max(0, cur * 0.65 + target * 0.35 + noise).toFixed(2);
        });
        return next;
      });
    }, 3_000);
    return () => clearInterval(id);
  }, [machineStates]);

  // Each machine toggles ON↔IDLE on its own staggered interval
  useEffect(() => {
    const timers = DEMO_MACHINES.map((m, i) => {
      // Base interval: 60–120 s, staggered so not all toggle at once
      const base = 60_000 + i * 18_000;
      return setInterval(() => {
        setMachineStates((prev) => {
          const cur = prev[m._id]?.state ?? "ON";
          return {
            ...prev,
            [m._id]: { ...prev[m._id], state: cur === "ON" ? "IDLE" : "ON", timestamp: Date.now() },
          };
        });
      }, base);
    });
    return () => timers.forEach(clearInterval);
  }, []);

  return (
    <WebSocketContext.Provider value={{ readings: "", machineStates, liveKw }}>
      {children}
    </WebSocketContext.Provider>
  );
};
