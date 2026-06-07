import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";

export type ThresholdAlert = {
  id: string;
  machineId: string;
  machineName: string;
  sensorName: string;
  value: number;
  threshold: number;
  timestamp: Date;
};

export type ReportStatus = "new" | "in_progress" | "needs_more_time" | "fixed";

export type EscalationLevel = "supervisor" | "manager" | "director";

export type StatusEntry = {
  status: ReportStatus;
  comment: string;
  changedAt: string;
};

export type EscalationEntry = {
  level: EscalationLevel;
  note: string;
  escalatedAt: string;
};

export type Report = ThresholdAlert & {
  comment: string;
  sentAt: string;
  status: ReportStatus;
  statusHistory: StatusEntry[];
  escalation?: EscalationEntry | null;
};

const REPORTS_KEY = "predictech_reports";

const PLACEHOLDER_COMMENTS: Record<string, string> = {
  "I have no idea": "Sensor value dropped below threshold — investigation required.",
  "test": "Sensor alert triggered during routine check.",
  "asdf": "Anomalous reading detected. Maintenance team notified.",
  "asd": "Anomalous reading detected. Maintenance team notified.",
};

const FALLBACK_COMMENTS = [
  "Vibration exceeded safe threshold. Machine halted for inspection.",
  "Unexpected sensor drop. Operator flagged for review.",
  "Threshold breach detected during production run.",
  "Sensor alert triggered — possible mechanical issue.",
  "Reading below safe operating level. Scheduled for maintenance.",
];

const loadReports = (): Report[] => {
  try {
    const raw: any[] = JSON.parse(localStorage.getItem(REPORTS_KEY) || "[]");
    return raw.map((r, i) => ({
      ...r,
      status: (r.status as ReportStatus) ?? "new",
      statusHistory: Array.isArray(r.statusHistory) ? r.statusHistory : [],
      escalation: r.escalation ?? null,
      comment:
        PLACEHOLDER_COMMENTS[r.comment?.trim()] ??
        (r.comment?.trim().length < 6
          ? FALLBACK_COMMENTS[i % FALLBACK_COMMENTS.length]
          : r.comment),
    }));
  } catch {
    return [];
  }
};

const saveReports = (reports: Report[]) =>
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));

export type CreateTicketData = {
  machineId: string;
  machineName: string;
  sensorName: string;
  value: number;
  threshold: number;
  comment: string;
};

interface NotificationContextType {
  alerts: ThresholdAlert[];
  addAlert: (alert: Omit<ThresholdAlert, "id">) => void;
  dismissAlert: (id: string) => void;
  sendReport: (id: string, comment: string) => void;
  reports: Report[];
  updateReportStatus: (id: string, status: ReportStatus, comment: string) => void;
  escalateReport: (id: string, level: EscalationLevel, note: string) => void;
  createTicket: (data: CreateTicketData) => void;
  clearAllReports: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
  const [alerts, setAlerts] = useState<ThresholdAlert[]>([]);
  const [reports, setReports] = useState<Report[]>(loadReports);

  const alertsRef = useRef(alerts);
  useEffect(() => { alertsRef.current = alerts; }, [alerts]);

  const addAlert = useCallback((alert: Omit<ThresholdAlert, "id">) => {
    setAlerts((prev) => {
      const already = prev.some(
        (a) => a.machineId === alert.machineId && a.sensorName === alert.sensorName,
      );
      if (already) return prev;
      return [...prev, { ...alert, id: `${Date.now()}-${Math.random()}` }];
    });
  }, []);

  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const sendReport = useCallback((id: string, comment: string) => {
    const alert = alertsRef.current.find((a) => a.id === id);
    if (!alert) return;
    const now = new Date().toISOString();
    const report: Report = {
      ...alert,
      comment,
      sentAt: now,
      status: "new",
      statusHistory: [{ status: "new", comment: "Report created", changedAt: now }],
      escalation: null,
    };
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setReports((prev) => {
      const updated = [...prev, report];
      saveReports(updated);
      return updated;
    });
  }, []);

  const updateReportStatus = useCallback(
    (id: string, status: ReportStatus, comment: string) => {
      setReports((prev) => {
        const report = prev.find((r) => r.id === id);

        let finalComment = comment;
        if (status === "fixed" && report) {
          const inProgressEntry = [...(report.statusHistory ?? [])].reverse()
            .find((e) => e.status === "in_progress");
          if (inProgressEntry) {
            const ms  = Date.now() - new Date(inProgressEntry.changedAt).getTime();
            const min = Math.round(ms / 60000);
            const dur = min < 60
              ? `${min} min`
              : `${Math.floor(min / 60)}h ${min % 60}m`;
            finalComment = `${comment} · Maintenance duration: ${dur}`;
          }
        }

        const entry: StatusEntry = { status, comment: finalComment, changedAt: new Date().toISOString() };
        const updated = prev.map((r) =>
          r.id !== id ? r : { ...r, status, statusHistory: [...(r.statusHistory ?? []), entry] },
        );
        saveReports(updated);
        return updated;
      });
    },
    [],
  );

  const escalateReport = useCallback(
    (id: string, level: EscalationLevel, note: string) => {
      setReports((prev) => {
        const escalation: EscalationEntry = {
          level,
          note,
          escalatedAt: new Date().toISOString(),
        };
        const updated = prev.map((r) => (r.id !== id ? r : { ...r, escalation }));
        saveReports(updated);
        return updated;
      });
    },
    [],
  );

  const clearAllReports = useCallback(() => {
    setReports([]);
    saveReports([]);
  }, []);

  const createTicket = useCallback((data: CreateTicketData) => {
    const now = new Date().toISOString();
    const report: Report = {
      id: `${Date.now()}-${Math.random()}`,
      machineId: data.machineId,
      machineName: data.machineName,
      sensorName: data.sensorName,
      value: data.value,
      threshold: data.threshold,
      timestamp: new Date(),
      comment: data.comment,
      sentAt: now,
      status: "new",
      statusHistory: [{ status: "new", comment: "Ticket created", changedAt: now }],
      escalation: null,
    };
    setReports((prev) => {
      const updated = [...prev, report];
      saveReports(updated);
      return updated;
    });
  }, []);

  return (
    <NotificationContext.Provider
      value={{ alerts, addAlert, dismissAlert, sendReport, reports, updateReportStatus, escalateReport, createTicket, clearAllReports }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
};
