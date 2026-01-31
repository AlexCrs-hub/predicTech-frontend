export type Machine = {
  name: string;
  _id: string;
  liveKw: number;
  currentState: "alarm" | "normal" | "unplanned downtime" | "planned downtime";
  status: "on" | "off" | "idle";
};
