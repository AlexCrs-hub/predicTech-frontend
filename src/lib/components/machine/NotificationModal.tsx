import { useState } from "react";
import {
  useNotifications,
  ThresholdAlert,
} from "@/context/NotificationContext";
import { Button } from "@/lib/components/ui/button";

type Props = {
  alert: ThresholdAlert;
  onClose: () => void;
};

export default function NotificationModal({ alert, onClose }: Props) {
  const { dismissAlert, sendReport } = useNotifications();
  const [step, setStep] = useState<"choose" | "comment">("choose");
  const [comment, setComment] = useState("");

  const handleIgnore = () => {
    dismissAlert(alert.id);
    onClose();
  };

  const handleSend = () => {
    sendReport(alert.id, comment);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background border rounded-xl shadow-xl w-full max-w-md mx-4 p-6 flex flex-col gap-4 bg-white">
        <div>
          <h2 className="text-lg font-bold text-red-600 mb-1">
            Threshold Alert
          </h2>
          <p className="text-sm text-muted-foreground">
            Sensor{" "}
            <span className="font-semibold text-foreground">
              {alert.sensorName}
            </span>{" "}
            on{" "}
            <span className="font-semibold text-foreground">
              {alert.machineName}
            </span>{" "}
            dropped to{" "}
            <span className="font-bold text-red-600">{alert.value}</span>{" "}
            (threshold: {alert.threshold})
          </p>
        </div>

        {step === "choose" && (
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" onClick={handleIgnore}>
              Ignore notification
            </Button>
            <Button className="w-full" onClick={() => setStep("comment")}>
              Notify maintenance group
            </Button>
          </div>
        )}

        {step === "comment" && (
          <div className="flex flex-col gap-3">
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
              placeholder="Describe what might be happening…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setStep("choose")}>
                Back
              </Button>
              {comment.trim() && (
                <Button onClick={handleSend}>Send report</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
