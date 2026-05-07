import ErrorCard from "./machine/ErrorCard";
import NotificationModal from "./machine/NotificationModal";
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
import {
  useNotifications,
  ThresholdAlert,
} from "@/context/NotificationContext";
import { fetchAllMachines } from "@/lib/api/machineApi";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";

type SidebarMachine = {
  _id: string;
  name?: string;
  maxPowerConsumption?: number;
  max_power?: number;
};

type SensorWarning = {
  id: string;
  machineId: string;
  machineName: string;
  sensorName: string;
  value: number;
  maxPower: number;
  url: string;
  type: "warning" | "error";
};

export function AppSidebar() {
  const { readings, machineStates } = useWebSocket();
  const { alerts } = useNotifications();
  const [machines, setMachines] = useState<SidebarMachine[]>([]);
  const [warnings, setWarnings] = useState<SensorWarning[]>([]);
  const [errors, setErrors] = useState<SensorWarning[]>([]);
  const [activeAlert, setActiveAlert] = useState<ThresholdAlert | null>(null);

  useEffect(() => {
    fetchAllMachines()
      .then((response) => {
        const data = Array.isArray(response?.machines)
          ? response.machines
          : Array.isArray(response)
            ? response
            : [];
        setMachines(data);
      })
      .catch(() => setMachines([]));
  }, []);

  useEffect(() => {
    if (!readings) return;
    try {
      const parsed = JSON.parse(readings);
      const incomingReadings = parsed.readings;
      if (!Array.isArray(incomingReadings)) return;

      const newWarnings: SensorWarning[] = [];
      incomingReadings.forEach((item: unknown) => {
        if (!item || typeof item !== "object") return;
        const entry = item as Record<string, unknown>;
        const machine = machines.find((m) => m._id === String(entry.machineId));
        if (!machine) return;
        const value = Number(entry.value);
        if (Number.isNaN(value)) return;
        const maxPower = Number(
          machine.maxPowerConsumption ?? machine.max_power ?? 0,
        );
        if (maxPower > 0 && value > maxPower) {
          newWarnings.push({
            id: `${entry.machineId}-${entry.sensorName}-${Date.now()}-${Math.random()}`,
            machineId: String(entry.machineId),
            machineName: machine.name || `Machine ${entry.machineId}`,
            sensorName: String(entry.sensorName),
            value,
            maxPower,
            url: `/app/machine?machineId=${entry.machineId}`,
            type: "warning",
          });
        }
      });
      setWarnings((prev) => [...prev, ...newWarnings]);
    } catch {
      /* ignore */
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
          type: "error",
        });
      }
    });
    setErrors((prev) => {
      const currentDisconnected = new Set(newErrors.map((e) => e.machineId));
      const existingKeys = new Set(prev.map((e) => e.machineId));
      return [
        ...prev.filter((e) => currentDisconnected.has(e.machineId)),
        ...newErrors.filter((e) => !existingKeys.has(e.machineId)),
      ];
    });
  }, [machineStates, machines]);

  const dismissWsNotification = (id: string) => {
    setWarnings((prev) => prev.filter((item) => item.id !== id));
    setErrors((prev) => prev.filter((item) => item.id !== id));
  };

  const totalCount = alerts.length + warnings.length + errors.length;

  return (
    <>
      <Sidebar className="z-30 mr-0 top-16 dark:border-predic/40">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu className="pt-2">
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-muted-foreground">
                  <Bell className="size-4" />
                  Notifications
                  {totalCount > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 text-white text-xs px-2 py-0.5">
                      {totalCount}
                    </span>
                  )}
                </div>

                <ScrollArea className="pb-16">
                  {/* Threshold alerts — persistent, click to manage */}
                  {alerts.map((alert) => (
                    <SidebarMenuItem key={alert.id}>
                      <button
                        type="button"
                        className="w-full text-left p-2 hover:opacity-80 transition-opacity"
                        onClick={() => setActiveAlert(alert)}
                      >
                        <ErrorCard
                          machineName={alert.machineName}
                          isWarning={false}
                          message={`${alert.sensorName} = ${alert.value} (below threshold ${alert.threshold})`}
                        />
                        <p className="text-xs text-muted-foreground mt-1 px-1">
                          Click to manage
                        </p>
                      </button>
                    </SidebarMenuItem>
                  ))}

                  {/* WS-based warnings and errors — dismissible */}
                  {[...warnings, ...errors].map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <div className="flex items-start gap-2 p-2">
                        <Link to={item.url} className="flex-1">
                          <ErrorCard
                            machineName={item.machineName}
                            isWarning={item.type === "warning"}
                            message={
                              item.type === "warning"
                                ? `Sensor ${item.sensorName} is ${item.value}kW (max ${item.maxPower}kW)`
                                : `Machine is disconnected`
                            }
                          />
                        </Link>
                        <button
                          type="button"
                          onClick={() => dismissWsNotification(item.id)}
                          className="rounded-full p-1 text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-700"
                          aria-label="Dismiss"
                        >
                          ×
                        </button>
                      </div>
                    </SidebarMenuItem>
                  ))}

                  {totalCount === 0 && (
                    <div className="p-4 text-sm text-gray-500">
                      No notifications
                    </div>
                  )}
                </ScrollArea>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>

      {activeAlert && (
        <NotificationModal
          alert={activeAlert}
          onClose={() => setActiveAlert(null)}
        />
      )}
    </>
  );
}
