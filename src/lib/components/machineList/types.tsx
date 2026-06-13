export type Machine = {
  name: string;
  _id: string;
  liveKw: number;
  maxPowerConsumption?: number;
  downtimeThreshold?: number;
  currentState: "on" | "idle" | "in maintenance";
  status: "on" | "off" | "idle";
};
