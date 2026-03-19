import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./App.css";
import NotFound from "./pages/NotFoundPage";
import AddMachinePage from "./pages/(logged-in)/AddMachinePage";
import MachinePage from "./pages/(logged-in)/MachinePage";
import AddReportPage from "./pages/(logged-in)/AddReportPage";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/auth/login/LoginPage";
import RegisterPage from "./pages/auth/register/RegisterPage";
import ActiveMachineList from "./pages/(logged-in)/ActiveMachineList";
import ContactPage from "./pages/(logged-in)/ContactPage";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./lib/components/PrivateRoute";
import { WebSocketProvider } from "./context/WebSocketContext";

const router = createBrowserRouter([
  { path: "/", element: <LandingPage />, errorElement: <NotFound /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/app",
    element: <PrivateRoute />,
    children: [
      { path: "/app", element: <ActiveMachineList /> },
      { path: "/app/active-machines", element: <ActiveMachineList /> },
      { path: "/app/add-machine", element: <AddMachinePage /> },
      { path: "/app/report", element: <AddReportPage /> },
      { path: "/app/contact", element: <ContactPage /> },
      { path: "/app/machine", element: <MachinePage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthProvider>
      <WebSocketProvider>
        <RouterProvider router={router} />
      </WebSocketProvider>
    </AuthProvider>
  </StrictMode>
);
