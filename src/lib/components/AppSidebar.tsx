import ErrorCard from "./machine/ErrorCard";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/lib/components/ui/sidebar";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { useEffect, useState } from "react";
import { useWebSocket } from "@/context/WebSocketContext";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Link } from "react-router-dom";

type SidebarMachine = {
  _id: string;
  name?: string;
  maxPowerConsumption?: number;
  max_power?: number; // fallback if backend uses this
};

type SensorWarning = {
  id: string;
  machineId: string;
  machineName: string;
  sensorName: string;
  value: number;
  maxPower: number;
  url: string;
  type: 'warning' | 'error';
};

export function AppSidebar() {
  const { readings, machineStates } = useWebSocket();
  const [machines, setMachines] = useState<SidebarMachine[]>([]);
  const [warnings, setWarnings] = useState<SensorWarning[]>([]);
  const [errors, setErrors] = useState<SensorWarning[]>([]);

  useEffect(() => {
    const loadMachines = async () => {
      try {
        const response = await fetchAllMachines();
        const data = Array.isArray(response?.machines)
          ? response.machines
          : Array.isArray(response)
          ? response
          : [];
        setMachines(data);
      } catch {
        setMachines([]);
      }
    };

    loadMachines();
  }, []);

  useEffect(() => {
    if (!readings) return;

    try {
      const parsed = JSON.parse(readings);
      const incomingReadings = parsed.readings;
      if (!Array.isArray(incomingReadings)) return;

      const newWarnings: SensorWarning[] = [];

      incomingReadings.forEach((item: unknown) => {
        if (item === null || typeof item !== "object") return;
        const entry = item as Record<string, unknown>;

        const machineIdRaw = entry.machineId;
        const sensorNameRaw = entry.sensorName;
        const valueRaw = entry.value;

        const machine = machines.find((m) => m._id === String(machineIdRaw));
        if (!machine) return;

        const value = Number(valueRaw);
        if (Number.isNaN(value)) return;

        const sensorName = String(sensorNameRaw);

        const maxPower = Number(machine.maxPowerConsumption ?? machine.max_power ?? 0);
        if (maxPower > 0 && value > maxPower) {
          newWarnings.push({
            id: `${machineIdRaw}-${sensorName}-${Date.now()}-${Math.random()}`,
            machineId: String(machineIdRaw),
            machineName: machine.name || `Machine ${machineIdRaw}`,
            sensorName,
            value,
            maxPower,
            url: `/app/machine?machineId=${machineIdRaw}`,
            type: 'warning',
          });
        }
      });

      setWarnings(prev => [...prev, ...newWarnings]);
    } catch {
      // ignore
    }
  }, [readings, machines]);

  useEffect(() => {
    const newErrors: SensorWarning[] = [];

    Object.entries(machineStates).forEach(([machineId, state]) => {
      const machine = machines.find((m) => m._id === machineId);
      if (!machine) return;

      if (state.health === "DISCONNECTED") {
        newErrors.push({
          id: `${machineId}-connection-${Date.now()}-${Math.random()}`,
          machineId,
          machineName: machine.name || `Machine ${machineId}`,
          sensorName: "Connection",
          value: 0,
          maxPower: 0,
          url: `/app/machine?machineId=${machineId}`,
          type: 'error',
        });
      }
    });

    setErrors(prev => {
      const currentDisconnected = new Set(newErrors.map(ne => ne.machineId));
      const existingKeys = new Set(prev.map(e => e.machineId));
      const toAdd = newErrors.filter(ne => !existingKeys.has(ne.machineId));
      const toKeep = prev.filter(e => currentDisconnected.has(e.machineId));
      return [...toKeep, ...toAdd];
    });
  }, [machineStates, machines]);

  const allNotifications = [...warnings, ...errors];

  const dismissNotification = (id: string) => {
    setWarnings((prev) => prev.filter((item) => item.id !== id));
    setErrors((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <Sidebar className="z-30 mr-0 top-16 dark:border-predic/40">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="pt-2">
              <ScrollArea className="pb-16">
                {allNotifications.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No notifications</div>
                ) : (
                  allNotifications.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <div className="flex items-start gap-2 p-2">
                        <Link to={item.url} className="flex-1">
                          <ErrorCard
                            machineName={item.machineName}
                            isWarning={item.type === 'warning'}
                            message={
                              item.type === 'warning'
                                ? `Sensor ${item.sensorName} is ${item.value}kW (max ${item.maxPower}kW)`
                                : `Machine is disconnected`
                            }
                          />
                        </Link>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            dismissNotification(item.id);
                          }}
                          className="rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                          aria-label={`Dismiss ${item.type} for ${item.machineName}`}>
                          ×
                        </button>
                      </div>
                    </SidebarMenuItem>
                  ))
                )}
              </ScrollArea>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
