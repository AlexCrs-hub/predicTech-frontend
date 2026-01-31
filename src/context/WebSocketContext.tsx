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
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [readings, setReadings] = useState<string>("");
    const [machineStates, setMachineStates] = useState<Record<string, MachineStatePayload>>({});
    const clientRef = useRef<Client | null>(null);

    useEffect(() => {
        const socket = new SockJS("https://localhost:8443/ws");
        const client = new Client({
        webSocketFactory: () => socket,
        debug: (str) => console.log(str),
        onConnect: () => {

            client.subscribe("/topic/mqtt-data", (message: IMessage) => {
                console.log("Received message:", message.body);
                setReadings(message.body || "");
            });

            client.subscribe("/topic/machine-state", (message: IMessage) => {
                const payload: MachineStatePayload = JSON.parse(message.body);
                    console.log("Received machine state:", payload);

                    // Update the machineStates map
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

    return (
        <WebSocketContext.Provider value={{ readings, machineStates }}>
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