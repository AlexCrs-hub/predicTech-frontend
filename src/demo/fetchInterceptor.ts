import {
  demoCycles, demoDowntime, demoUtilization, demoCutting,
  demoPlannedUnplanned, demoDowntimeStats,
  demoSensorsForMachine, demoReadingsForSensor,
  demoStartInterval, demoStopInterval,
  demoMachineList, demoMachineById,
} from "./demoData";
import type { ApiPeriod } from "@/lib/api/metricsApi";

function ok(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function created(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

function notFound(msg = "Not found"): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status: 404,
    headers: { "Content-Type": "application/json" },
  });
}

export function installDemoFetch() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.href
        : (input as Request).url;

    // Only intercept backend API calls
    if (!url.includes("/api/")) return originalFetch(input, init);

    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();

    // Extract path after /api/
    const apiPath = url.split("/api/")[1]?.split("?")[0] ?? "";
    const segs = apiPath.split("/");
    const [r0, r1, r2, r3] = segs;

    // ── auth ───────────────────────────────────────────────────────────────────
    if (r0 === "auth") return ok({ success: true });

    // ── machines ───────────────────────────────────────────────────────────────
    if (r0 === "machines") {
      if (!r1) return ok(demoMachineList());
      // skip non-ID sub-resources like "line", "report"
      if (r1 === "line" || r1 === "report" || r1 === "name") return ok({ machines: [] });
      const res = demoMachineById(r1);
      return res ? ok(res) : notFound();
    }

    // ── metrics ────────────────────────────────────────────────────────────────
    if (r0 === "metrics") {
      const [, metricType, machineId, period] = segs;
      const p = period as ApiPeriod;
      switch (metricType) {
        case "cycles":           return ok(demoCycles(machineId, p));
        case "downtime":         return ok(demoDowntime(machineId, p));
        case "utilization":      return ok(demoUtilization(machineId, p));
        case "cutting":          return ok(demoCutting(machineId, p));
        case "planned-unplanned": return ok(demoPlannedUnplanned(machineId, p));
        default:                 return notFound("Unknown metric");
      }
    }

    // ── downtime records ───────────────────────────────────────────────────────
    if (r0 === "downtime-records") {
      if (r1 === "unresolved")   return ok([]);
      if (r1 === "stats")        return ok(demoDowntimeStats(r2, r3 as ApiPeriod));
      // PATCH /:id/reason
      if (r2 === "reason" && method === "PATCH") {
        return ok({ _id: r1, reasonRecorded: true, reason: "other", downtimeType: "unplanned" });
      }
      return ok([]);
    }

    // ── work intervals ─────────────────────────────────────────────────────────
    if (r0 === "work-intervals") {
      const [, action, machineId] = segs;
      if (action === "start" && method === "POST") return created(demoStartInterval(machineId));
      if (action === "stop"  && method === "PATCH") return ok(demoStopInterval(machineId));
      return notFound();
    }

    // ── sensors ────────────────────────────────────────────────────────────────
    if (r0 === "sensors") {
      if (r1 === "machine") return ok(demoSensorsForMachine(r2));
      return ok([]);
    }

    // ── readings ───────────────────────────────────────────────────────────────
    if (r0 === "readings") {
      const sensorId = r1;
      // /readings/:sensorId/last24h or /readings/:sensorId
      return ok(demoReadingsForSensor(sensorId));
    }

    // ── notification groups ────────────────────────────────────────────────────
    if (r0 === "notification-groups") return ok([]);

    // ── users ──────────────────────────────────────────────────────────────────
    if (r0 === "users") return ok({ message: "ok" });

    // ── lines ──────────────────────────────────────────────────────────────────
    if (r0 === "lines") return ok({ lines: [] });

    // Fallback — let through (HMR, etc.)
    return originalFetch(input, init);
  };
}
