import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchReportableDowntime, DowntimeRecord } from "@/lib/api/downtimeRecordsApi";
import DowntimeReportModal from "./DowntimeReportModal";

const VARIANT_CLASS = {
  card: {
    enabled:  "border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40",
    disabled: "border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-600 bg-transparent cursor-not-allowed",
    base:     "flex-1 flex items-center justify-center gap-1 whitespace-nowrap text-[11px] font-semibold px-2 py-1.5 rounded-lg border transition-colors",
  },
  header: {
    enabled:  "bg-red-500 hover:bg-red-600 text-white border-red-300",
    disabled: "bg-white/10 text-white/50 border-white/20 cursor-not-allowed",
    base:     "flex items-center gap-1.5 whitespace-nowrap text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium",
  },
} as const;

/**
 * "Report downtime" button — greyed out until the machine has unreported downtime.
 * Opens the tabbed report modal with all of the machine's pending downtimes.
 */
export default function ReportDowntimeButton({
  machineId,
  machineName,
  count,
  variant = "card",
  onReported,
}: {
  machineId: string;
  machineName: string;
  /** number of unreported downtimes; 0 disables the button */
  count: number;
  variant?: keyof typeof VARIANT_CLASS;
  onReported?: () => void;
}) {
  const [records, setRecords] = useState<DowntimeRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const enabled = count > 0;
  const cls = VARIANT_CLASS[variant];

  const open = async (e: React.MouseEvent) => {
    // the machine card is a link — keep the click from navigating
    e.preventDefault();
    e.stopPropagation();
    if (!enabled || loading) return;
    setLoading(true);
    try {
      const list = await fetchReportableDowntime(machineId);
      if (list.length > 0) setRecords(list);
      else onReported?.(); // stale count — let the parent refresh
    } catch {
      // leave the button as is; the next refresh will retry
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!enabled || loading}
        onClick={open}
        title={enabled ? `${count} downtime${count !== 1 ? "s" : ""} to report` : "No downtime to report"}
        className={`${cls.base} ${enabled ? cls.enabled : cls.disabled} ${loading ? "opacity-60" : ""}`}
      >
        {loading ? "…" : (
          <>
            Report downtime
            {enabled && (
              <span className="min-w-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] leading-[16px] tabular-nums">
                {count}
              </span>
            )}
          </>
        )}
      </button>

      {records &&
        createPortal(
          // stop React events from bubbling up to the card's <Link>
          <div onClick={(e) => e.stopPropagation()}>
            <DowntimeReportModal
              machineName={machineName}
              records={records}
              onClose={() => { setRecords(null); onReported?.(); }}
              onSaved={() => onReported?.()}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
