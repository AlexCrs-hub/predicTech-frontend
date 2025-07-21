window.global = window;

import React, { createContext, useState, useRef, useEffect, useContext } from "react";
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client/dist/sockjs';

interface WebSocketContextType {
    message: string;

}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<string>("");
    const clientRef = useRef<Client | null>(null);

    useEffect(() => {
        const socket = new SockJS("https://localhost:8443/ws");
        const client = new Client({
        webSocketFactory: () => socket,
        debug: (str) => console.log(str),
        onConnect: () => {
            client.subscribe("/topic/mqtt-data", (message: IMessage) => {
                console.log("Received message:", message.body);
                setMessages(message.body || "");
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
        <WebSocketContext.Provider value={{ message: messages }}>
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