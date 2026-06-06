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
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./lib/components/PrivateRoute";
import { WebSocketProvider } from "./context/WebSocketContext";
import { NotificationProvider } from "./context/NotificationContext";

const router = createBrowserRouter([
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
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <NotificationProvider>
          <RouterProvider router={router} />
        </NotificationProvider>
      </WebSocketProvider>
    </AuthProvider>
  </StrictMode>,
);
