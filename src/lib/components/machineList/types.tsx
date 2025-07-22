export type Machine = {
  name: string;
  _id: string;
  liveKw: number;
  status: "running" | "stopped" | "idle";
};
