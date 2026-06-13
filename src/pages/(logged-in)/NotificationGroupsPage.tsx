import { useState } from "react";
import {
  addPhoneToGroup,
  removePhoneFromGroup,
  GroupName,
} from "@/lib/api/notificationGroupsApi";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router-dom";

const GROUPS: { name: GroupName; label: string; description: string; escalation: string; color: string }[] = [
  {
    name: "operator",
    label: "Operators",
    description: "Notified immediately when downtime is detected.",
    escalation: "First to be alerted",
    color: "border-green-300 dark:border-green-800 bg-green-50 dark:bg-green-900/10",
  },
  {
    name: "maintenance",
    label: "Maintenance",
    description: "Escalated after 15 minutes if downtime is unresolved.",
    escalation: "Escalation after 15 min",
    color: "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10",
  },
  {
    name: "admin",
    label: "Admins",
    description: "Escalated after 30 minutes if downtime persists.",
    escalation: "Escalation after 30 min",
    color: "border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/10",
  },
];

type ActionState = "idle" | "saving" | "ok" | "error";

function GroupCard({ group }: { group: typeof GROUPS[number] }) {
  const [addPhone, setAddPhone]     = useState("");
  const [removePhone, setRemovePhone] = useState("");
  const [addState, setAddState]     = useState<ActionState>("idle");
  const [removeState, setRemoveState] = useState<ActionState>("idle");

  const doAdd = async () => {
    if (!addPhone.trim()) return;
    setAddState("saving");
    try {
      await addPhoneToGroup(group.name, addPhone.trim());
      setAddState("ok");
      setAddPhone("");
      setTimeout(() => setAddState("idle"), 3000);
    } catch {
      setAddState("error");
      setTimeout(() => setAddState("idle"), 4000);
    }
  };

  const doRemove = async () => {
    if (!removePhone.trim()) return;
    setRemoveState("saving");
    try {
      await removePhoneFromGroup(group.name, removePhone.trim());
      setRemoveState("ok");
      setRemovePhone("");
      setTimeout(() => setRemoveState("idle"), 3000);
    } catch {
      setRemoveState("error");
      setTimeout(() => setRemoveState("idle"), 4000);
    }
  };

  return (
    <div className={`rounded-xl border p-5 flex flex-col gap-4 ${group.color}`}>
      <div>
        <h3 className="text-base font-bold text-gray-900 dark:text-zinc-50">{group.label}</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{group.description}</p>
        <span className="inline-block mt-1.5 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          {group.escalation}
        </span>
      </div>

      {/* Add number */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          Add phone number
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={addPhone}
            onChange={(e) => { setAddPhone(e.target.value); setAddState("idle"); }}
            placeholder="+48123456789"
            className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={doAdd}
            disabled={!addPhone.trim() || addState === "saving"}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {addState === "saving" ? "…" : "+ Add"}
          </button>
        </div>
        {addState === "ok"    && <p className="text-[11px] text-green-600 dark:text-green-500">✓ Phone number added</p>}
        {addState === "error" && <p className="text-[11px] text-red-500">Failed — check format (+country code)</p>}
      </div>

      {/* Remove number */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
          Remove phone number
        </label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={removePhone}
            onChange={(e) => { setRemovePhone(e.target.value); setRemoveState("idle"); }}
            placeholder="+48123456789"
            className="flex-1 text-sm rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button
            onClick={doRemove}
            disabled={!removePhone.trim() || removeState === "saving"}
            className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {removeState === "saving" ? "…" : "− Remove"}
          </button>
        </div>
        {removeState === "ok"    && <p className="text-[11px] text-green-600 dark:text-green-500">✓ Phone number removed</p>}
        {removeState === "error" && <p className="text-[11px] text-red-500">Failed — check format (+country code)</p>}
      </div>
    </div>
  );
}

export default function NotificationGroupsPage() {
  const { isAdmin, getRole } = useAuth();
  const navigate = useNavigate();

  if (!isAdmin()) {
    return (
      <div className="w-full max-w-lg mx-auto p-6 mt-10 flex flex-col items-center gap-4">
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-6 py-5 text-center">
          <p className="text-sm font-semibold text-red-700 dark:text-red-400">Access restricted</p>
          <p className="text-xs text-red-600 dark:text-red-500 mt-1">
            This page is available to admins only. Your role: <strong>{getRole() ?? "unknown"}</strong>
          </p>
        </div>
        <button
          onClick={() => navigate("/app")}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Back to machines
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-50">Notification Groups</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
          Manage WhatsApp phone numbers for each notification group. Numbers receive downtime alerts based on the escalation schedule.
        </p>
      </div>

      {/* Escalation flow diagram */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-zinc-400 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3">
        <span className="font-semibold text-gray-700 dark:text-zinc-300">Escalation flow:</span>
        <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">Operator</span>
        <span>→ immediately</span>
        <span className="mx-1">→</span>
        <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium">Maintenance</span>
        <span>→ +15 min</span>
        <span className="mx-1">→</span>
        <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 font-medium">Admin</span>
        <span>→ +30 min</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {GROUPS.map((g) => <GroupCard key={g.name} group={g} />)}
      </div>

      <p className="text-xs text-gray-400 dark:text-zinc-500">
        Phone numbers must include country code, e.g. <code className="font-mono">+48123456789</code>. Notifications stop automatically when an operator logs a downtime reason.
      </p>
    </div>
  );
}
