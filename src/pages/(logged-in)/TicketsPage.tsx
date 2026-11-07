import { useState, useEffect } from "react";
import { useNotifications, Report, ReportStatus } from "@/context/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Button } from "@/lib/components/ui/button";
import { Ticket, History } from "lucide-react";

const PERIODS = [
  { label: "1 day",   hours: 24  },
  { label: "7 days",  hours: 168 },
  { label: "1 month", hours: 720 },
] as const;
type Period = typeof PERIODS[number];

function PeriodToggle({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-1 gap-0.5">
      {PERIODS.map((p) => (
        <button
          key={p.label}
          onClick={() => onChange(p)}
          className={`px-3 py-1 text-xs transition-colors ${
            value.label === p.label
              ? "rounded-md bg-background text-foreground shadow-sm font-semibold"
              : "rounded-md text-muted-foreground hover:text-foreground"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

const STATUS_LABEL: Record<ReportStatus, string> = {
  new: "New",
  in_progress: "In Progress",
  needs_more_time: "Needs More Time",
  fixed: "Fixed",
};

const STATUS_COLOR: Record<ReportStatus, string> = {
  new: "bg-gray-100 text-gray-700 border-gray-300",
  in_progress: "bg-blue-100 text-blue-700 border-blue-300",
  needs_more_time: "bg-orange-100 text-orange-700 border-orange-300",
  fixed: "bg-green-100 text-green-700 border-green-300",
};

const BORDER_COLOR: Record<ReportStatus, string> = {
  new: "border-l-gray-400",
  in_progress: "border-l-blue-500",
  needs_more_time: "border-l-orange-500",
  fixed: "border-l-green-500",
};

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLOR[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function StatusActions({ report }: { report: Report }) {
  const { updateReportStatus } = useNotifications();
  const [step, setStep] = useState<"idle" | "accept" | "resolve">("idle");
  const [nextStatus, setNextStatus] = useState<ReportStatus | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setStep("idle");
    setComment("");
    setNextStatus(null);
  }, [report.status]);

  const handleAccept = () => {
    updateReportStatus(report.id, "in_progress", "Accepted by operator");
    setStep("idle");
  };

  const handleResolve = (s: ReportStatus) => {
    setNextStatus(s);
    setStep("resolve");
    setComment("");
  };

  const handleSubmitResolve = () => {
    if (!nextStatus || !comment.trim()) return;
    updateReportStatus(report.id, nextStatus, comment);
    setStep("idle");
    setComment("");
  };

  if (report.status === "new") {
    return step === "idle" ? (
      <Button size="sm" className="mt-2" onClick={() => setStep("accept")}>Accept</Button>
    ) : (
      <div className="mt-2 flex gap-2">
        <Button size="sm" onClick={handleAccept}>Confirm accept</Button>
        <Button size="sm" variant="outline" onClick={() => setStep("idle")}>Cancel</Button>
      </div>
    );
  }

  if (report.status === "in_progress" || report.status === "needs_more_time") {
    return (
      <div className="mt-3 flex flex-col gap-2">
        {step === "idle" && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleResolve("fixed")}>
              Fixed
            </Button>
            <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white" onClick={() => handleResolve("needs_more_time")}>
              Needs more time
            </Button>
          </div>
        )}
        {step === "resolve" && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground">
              Justification required to mark as{" "}
              <span className="font-semibold">{nextStatus && STATUS_LABEL[nextStatus]}</span>:
            </p>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={3}
              placeholder="Describe what was done or what is still needed…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setStep("idle")}>Cancel</Button>
              {comment.trim() && (
                <Button size="sm" onClick={handleSubmitResolve}>Submit</Button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function TicketCard({ report }: { report: Report }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card
      className={`border-l-4 ${BORDER_COLOR[report.status]} cursor-pointer`}
      onClick={() => setExpanded((v) => !v)}
    >
      <CardHeader className="pb-1">
        <CardTitle className="text-sm flex items-center justify-between gap-2 flex-wrap">
          <span className="font-semibold">{report.sensorName} — {report.machineName}</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={report.status} />
            <span className="text-xs font-normal text-muted-foreground">
              {new Date(report.sentAt).toLocaleString()}
            </span>
          </div>
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="flex flex-col gap-2 text-sm" onClick={(e) => e.stopPropagation()}>
          <p>
            Value: <span className="font-semibold text-red-600">{report.value}</span>{" "}
            (threshold: {report.threshold})
          </p>
          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <span className="font-medium">Comment: </span>{report.comment}
          </div>

          {report.statusHistory && report.statusHistory.length > 0 && (
            <div className="flex flex-col gap-1 mt-1">
              <p className="text-xs font-medium text-muted-foreground">History</p>
              {report.statusHistory.map((entry, i) => (
                <div key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0">{new Date(entry.changedAt).toLocaleString()}</span>
                  <StatusBadge status={entry.status} />
                  <span>{entry.comment}</span>
                </div>
              ))}
            </div>
          )}

          <StatusActions report={report} />
        </CardContent>
      )}
    </Card>
  );
}

export default function TicketsPage() {
  const { reports, clearAllReports } = useNotifications();
  const [period, setPeriod] = useState<Period>(PERIODS[1]); // default 7 days

  const cutoff = new Date(Date.now() - period.hours * 60 * 60 * 1000);
  const inPeriod = (r: Report) => new Date(r.sentAt) >= cutoff;

  const active  = [...reports].filter((r) => r.status !== "fixed" && inPeriod(r)).reverse();
  const history = [...reports].filter((r) => r.status === "fixed"  && inPeriod(r)).reverse();
  const hiddenCount = reports.length - active.length - history.length;

  return (
    <div className="w-full max-w-3xl mx-auto p-6 flex flex-col gap-6">
      {/* header row with period toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <Ticket className="size-5 text-muted-foreground" />
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <div className="ml-auto flex items-center gap-3">
          <PeriodToggle value={period} onChange={setPeriod} />
          {reports.length > 0 && (
            <button
              onClick={clearAllReports}
              className="text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {hiddenCount > 0 && (
        <p className="text-xs text-muted-foreground -mt-3">
          {hiddenCount} older ticket{hiddenCount !== 1 ? "s" : ""} outside selected period.
        </p>
      )}

      {/* active */}
      <div className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
          Active
          <span className="text-xs font-medium text-muted-foreground bg-muted rounded-md px-1.5 py-0.5 tabular-nums">{active.length}</span>
        </h2>
        {active.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center">
            <p className="text-sm font-medium text-foreground">No active tickets</p>
            <p className="text-sm text-muted-foreground mt-1">Nothing needs attention in this period.</p>
          </div>
        ) : (
          active.map((r) => <TicketCard key={r.id} report={r} />)
        )}
      </div>

      {/* history */}
      {history.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 border-t pt-4">
            <History className="size-5 text-muted-foreground" />
            <h2 className="text-xl font-bold">History</h2>
            <span className="ml-auto text-sm text-muted-foreground">{history.length} closed</span>
          </div>
          {history.map((r) => <TicketCard key={r.id} report={r} />)}
        </div>
      )}
    </div>
  );
}
