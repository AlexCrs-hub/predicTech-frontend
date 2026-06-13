import React, { createContext, useState, useRef, useEffect, useContext } from "react";
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';
import { API_URLS } from "@/lib/constants/ApiUrls";

interface MachineStatePayload {
  machineId: string;
  state: "ON" | "IDLE" | "OFF";
  health: "HEALTHY" | "STALE" | "DISCONNECTED";
  timestamp: number;
}

interface WebSocketContextType {
  readings: string;
  machineStates: Record<string, MachineStatePayload>;
  liveKw: Record<string, number>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [readings, setReadings] = useState<string>("");
    const [machineStates, setMachineStates] = useState<Record<string, MachineStatePayload>>({});
    const [liveKw, setLiveKw] = useState<Record<string, number>>({}); 
    const clientRef = useRef<Client | null>(null);

    useEffect(() => {
        let failCount = 0;

        const makeSocket = () => new SockJS(`${API_URLS.WS_URL}/ws`);

        const client = new Client({
            webSocketFactory: makeSocket,
            reconnectDelay: 10_000,
            // suppress per-frame debug noise
            debug: () => {},
            onConnect: () => {
                failCount = 0;
                client.subscribe("/topic/mqtt-data", (message: IMessage) => {
                    setReadings(message.body || "");
                });
                client.subscribe("/topic/machine-state", (message: IMessage) => {
                    try {
                        const payload: MachineStatePayload = JSON.parse(message.body);
                        setMachineStates(prev => ({ ...prev, [payload.machineId]: payload }));
                    } catch { /* malformed frame */ }
                });
            },
            onStompError: () => {
                failCount++;
                // After 3 failed attempts stop retrying to avoid console flood
                if (failCount >= 3) client.deactivate();
            },
            onWebSocketError: () => {
                failCount++;
                if (failCount >= 3) client.deactivate();
            },
        });

        client.activate();
        clientRef.current = client;

        return () => { client.deactivate(); };
    }, []);

    useEffect(() => {
    if (!readings) return;
    try {
      const parsed = JSON.parse(readings);
      const currentReading = parsed.readings[0]; // first element
      if (currentReading) {
        setLiveKw(prev => ({
          ...prev,
          [currentReading.machineId]: currentReading.value, // key by machineId
        }));
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  }, [readings]);

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