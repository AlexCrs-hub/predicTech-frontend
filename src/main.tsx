import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useRouteError } from "react-router-dom";
import "./index.css";
import "./App.css";
import NotFound from "./pages/NotFoundPage";

function RouteErrorBoundary() {
  const error = useRouteError() as Error;
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-8 bg-gray-50 dark:bg-zinc-950">
      <h1 className="text-xl font-bold text-red-600 dark:text-red-400">Something went wrong</h1>
      <p className="text-sm text-gray-500 dark:text-zinc-400 max-w-md text-center">{error?.message ?? "Unknown error"}</p>
      <a href="/app" className="text-sm text-blue-600 dark:text-blue-400 underline">← Back to machines</a>
    </div>
  );
}
import AddMachinePage from "./pages/(logged-in)/AddMachinePage";
import MachinePage from "./pages/(logged-in)/MachinePage";
import AddReportPage from "./pages/(logged-in)/AddReportPage";
import ReportsPage from "./pages/(logged-in)/ReportsPage";
import OverviewPage from "./pages/(logged-in)/OverviewPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/login/LoginPage";
import RegisterPage from "./pages/auth/register/RegisterPage";
import ActiveMachineList from "./pages/(logged-in)/ActiveMachineList";
import ContactPage from "./pages/(logged-in)/ContactPage";
import BigScreenPage from "./pages/(logged-in)/BigScreenPage";
import TicketsPage from "./pages/(logged-in)/TicketsPage";
import NotificationGroupsPage from "./pages/(logged-in)/NotificationGroupsPage";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./lib/components/PrivateRoute";
import { WebSocketProvider } from "./context/WebSocketContext";
import { NotificationProvider } from "./context/NotificationContext";
import { IS_DEMO } from "./demo/config";
import { installDemoFetch } from "./demo/fetchInterceptor";
import { DemoWebSocketProvider } from "./demo/DemoWebSocketProvider";

// ── Demo mode bootstrap ────────────────────────────────────────────────────────
if (IS_DEMO) {
  installDemoFetch();

  // Pre-populate auth so PrivateRoute passes without a real login
  if (!localStorage.getItem("user")) {
    const demoUser = {
      message: "Demo login",
      success: true,
      user: {
        _id: "demo-user-001",
        name: "Demo Admin",
        email: "demo@predictech.io",
        role: "admin",
        isVerified: true,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
        lastLogin: new Date().toISOString(),
        verificationToken: "",
        verificationTkoenExpiresAt: "",
        __v: 0,
      },
    };
    localStorage.setItem("user", JSON.stringify(demoUser));
  }

  // Pre-populate maintenance tickets so the Overview section is not empty
  if (!localStorage.getItem("predictech_reports")) {
    const now = Date.now();
    const tickets = [
      {
        id: `demo-t1`,
        machineId: "dm-press-003",
        machineName: "Machine 3",
        sensorName: "Power Sensor",
        value: 51.2,
        threshold: 45,
        timestamp: new Date(now - 3 * 3600_000).toISOString(),
        comment: "Power spike detected during press cycle — hydraulic pressure may need calibration.",
        sentAt: new Date(now - 3 * 3600_000).toISOString(),
        status: "in_progress",
        statusHistory: [
          { status: "new",         comment: "Report created",                          changedAt: new Date(now - 3 * 3600_000).toISOString() },
          { status: "in_progress", comment: "Technician assigned. Checking hydraulics.", changedAt: new Date(now - 2 * 3600_000).toISOString() },
        ],
        escalation: null,
      },
      {
        id: `demo-t2`,
        machineId: "dm-weld-004",
        machineName: "Machine 4",
        sensorName: "Power Sensor",
        value: 0.8,
        threshold: 2,
        timestamp: new Date(now - 28 * 3600_000).toISOString(),
        comment: "Machine went below idle threshold during shift — possible unexpected shutdown.",
        sentAt: new Date(now - 28 * 3600_000).toISOString(),
        status: "needs_more_time",
        statusHistory: [
          { status: "new",              comment: "Report created",                             changedAt: new Date(now - 28 * 3600_000).toISOString() },
          { status: "in_progress",      comment: "Investigating power supply unit.",            changedAt: new Date(now - 26 * 3600_000).toISOString() },
          { status: "needs_more_time",  comment: "PSU replaced, monitoring for recurrence.",   changedAt: new Date(now - 10 * 3600_000).toISOString() },
        ],
        escalation: null,
      },
      {
        id: `demo-t3`,
        machineId: "dm-laser-001",
        machineName: "Machine 1",
        sensorName: "Power Sensor",
        value: 27.4,
        threshold: 25,
        timestamp: new Date(now - 72 * 3600_000).toISOString(),
        comment: "Laser head overload — cooling fan noise reported by operator.",
        sentAt: new Date(now - 72 * 3600_000).toISOString(),
        status: "fixed",
        statusHistory: [
          { status: "new",         comment: "Report created",                         changedAt: new Date(now - 72 * 3600_000).toISOString() },
          { status: "in_progress", comment: "Cooling fan replaced.",                  changedAt: new Date(now - 70 * 3600_000).toISOString() },
          { status: "fixed",       comment: "Issue resolved. · Maintenance duration: 1h 45m", changedAt: new Date(now - 68 * 3600_000).toISOString() },
        ],
        escalation: null,
      },
      {
        id: `demo-t4`,
        machineId: "dm-cnc-002",
        machineName: "Machine 2",
        sensorName: "Power Sensor",
        value: 19.8,
        threshold: 18,
        timestamp: new Date(now - 5 * 3600_000).toISOString(),
        comment: "Spindle load exceeded rated power during roughing pass.",
        sentAt: new Date(now - 5 * 3600_000).toISOString(),
        status: "new",
        statusHistory: [
          { status: "new", comment: "Report created", changedAt: new Date(now - 5 * 3600_000).toISOString() },
        ],
        escalation: null,
      },
    ];
    localStorage.setItem("predictech_reports", JSON.stringify(tickets));
  }
}

const WsWrapper = IS_DEMO ? DemoWebSocketProvider : WebSocketProvider;

const router = createBrowserRouter(
  [
    { path: "/", element: <LandingPage />, errorElement: <NotFound /> },
    { path: "/login", element: <LoginPage /> },
    { path: "/register", element: <RegisterPage /> },
    {
      path: "/app",
      element: <PrivateRoute />,
      errorElement: <RouteErrorBoundary />,
      children: [
        { path: "/app", element: <ActiveMachineList /> },
        { path: "/app/active-machines", element: <ActiveMachineList /> },
        { path: "/app/add-machine", element: <AddMachinePage /> },
        { path: "/app/report", element: <AddReportPage /> },
        { path: "/app/reports", element: <ReportsPage /> },
        { path: "/app/overview", element: <OverviewPage /> },
        { path: "/app/contact", element: <ContactPage /> },
        { path: "/app/bigscreen", element: <BigScreenPage /> },
        { path: "/app/tickets", element: <TicketsPage /> },
        { path: "/app/machine", element: <MachinePage /> },
        { path: "/app/notification-groups", element: <NotificationGroupsPage /> },
      ],
    },
  ],
  IS_DEMO ? { basename: "/demo" } : undefined
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <WsWrapper>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </WsWrapper>
    </AuthProvider>
  </StrictMode>,
);
