import { useState } from "react";
import { createPortal } from "react-dom";
import { fetchReportableDowntime, DowntimeRecord } from "@/lib/api/downtimeRecordsApi";
import DowntimeReportModal from "./DowntimeReportModal";

const VARIANT_CLASS = {
  card: {
    enabled:  "border-red-500/30 text-red-600 dark:text-red-400 bg-red-500/5 hover:bg-red-500/10",
    disabled: "border-input text-muted-foreground/70 bg-background cursor-not-allowed",
    base:     "flex-1 flex items-center justify-center gap-1.5 whitespace-nowrap h-8 px-2 rounded-lg border text-xs font-medium shadow-sm transition-colors",
  },
  header: {
    enabled:  "bg-red-600 hover:bg-red-700 text-white border-red-600",
    disabled: "bg-background text-muted-foreground/70 border-input cursor-not-allowed shadow-sm",
    base:     "inline-flex items-center gap-1.5 whitespace-nowrap h-9 px-3 text-sm rounded-lg border transition-colors font-medium",
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
              <span className={`min-w-[18px] px-1 rounded-full text-[10px] leading-[16px] tabular-nums ${variant === "header" ? "bg-white text-red-600" : "bg-red-500 text-white"}`}>
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
