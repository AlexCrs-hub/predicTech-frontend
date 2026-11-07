export type Machine = {
  name: string;
  _id: string;
  mqttName?: string;
  liveKw: number;
  maxPowerConsumption?: number;
  downtimeThreshold?: number;
  cuttingThreshold?: number;
  currentState: "on" | "idle" | "in maintenance";
  status: "on" | "off" | "idle";
};
