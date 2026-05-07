import { getMachineUtilization, CycleStage } from "@/lib/utils/machineSimulation";

const STAGE_COLOR: Record<CycleStage, string> = {
  loading:    "bg-blue-400",
  cutting:    "bg-green-500",
  offloading: "bg-purple-400",
  waiting:    "bg-gray-300",
};

const STAGE_LABEL: Record<CycleStage, string> = {
  loading:    "Loading",
  cutting:    "Cutting",
  offloading: "Offloading",
  waiting:    "Waiting",
};

const STAGE_TEXT: Record<CycleStage, string> = {
  loading:    "text-blue-700",
  cutting:    "text-green-700",
  offloading: "text-purple-700",
  waiting:    "text-gray-500",
};

export default function CycleTimeline({ machineId }: { machineId: string }) {
  const { cycleStages, cycles } = getMachineUtilization(machineId);
  const total = cycleStages.reduce((s, c) => s + c.durationMin, 0);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Current cycle</span>
        <span>{cycles} cycles today</span>
      </div>

      {/* Gantt bar */}
      <div className="flex h-7 rounded-md overflow-hidden gap-[2px]">
        {cycleStages.map(({ stage, durationMin }) => (
          <div
            key={stage}
            className={`${STAGE_COLOR[stage]} flex items-center justify-center`}
            style={{ flexBasis: `${(durationMin / total) * 100}%` }}
            title={`${STAGE_LABEL[stage]}: ${durationMin} min`}
          >
            <span className="text-white text-[10px] font-semibold truncate px-1">
              {durationMin}m
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {cycleStages.map(({ stage, durationMin }) => (
          <div key={stage} className="flex items-center gap-1 text-xs">
            <div className={`w-2.5 h-2.5 rounded-sm ${STAGE_COLOR[stage]}`} />
            <span className={STAGE_TEXT[stage]}>
              {STAGE_LABEL[stage]} ({durationMin} min)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
