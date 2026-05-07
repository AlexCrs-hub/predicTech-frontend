import { useState, useEffect } from "react";
import { useNotifications, Report, ReportStatus } from "@/context/NotificationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/lib/components/ui/card";
import { Button } from "@/lib/components/ui/button";
import { Ticket, History } from "lucide-react";

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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">History</p>
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

  const active = [...reports].filter((r) => r.status !== "fixed").reverse();
  const history = [...reports].filter((r) => r.status === "fixed").reverse();

  return (
    <div className="w-full max-w-3xl mx-auto p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Ticket className="size-5 text-muted-foreground" />
          <h1 className="text-xl font-bold">Active Tickets</h1>
          {reports.length > 0 && (
            <button
              onClick={clearAllReports}
              className="ml-auto text-xs text-muted-foreground hover:text-red-500 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
        {active.length === 0 ? (
          <p className="text-muted-foreground text-sm">No active tickets.</p>
        ) : (
          active.map((r) => <TicketCard key={r.id} report={r} />)
        )}
      </div>

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
