window.global = window;

import React, { createContext, useState, useRef, useEffect, useContext } from "react";
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

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
        const socket = new SockJS("https://localhost:8443/ws");
        const client = new Client({
        webSocketFactory: () => socket,
        debug: (str) => console.log(str),
        onConnect: () => {

            client.subscribe("/topic/mqtt-data", (message: IMessage) => {
                setReadings(message.body || "");
            });

            client.subscribe("/topic/machine-state", (message: IMessage) => {
                const payload: MachineStatePayload = JSON.parse(message.body);

                    setMachineStates(prev => ({
                        ...prev,
                        [payload.machineId]: payload
                    }));
            });
        },
        });
        client.activate();
        clientRef.current = client;

        return () => {
            client.deactivate();
        };
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