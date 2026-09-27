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
