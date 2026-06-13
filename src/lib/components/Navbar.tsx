import { Link, useNavigate } from "react-router-dom";
import predicTech from "@/lib/assets/logo_predic.svg";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { NAVIGATION_ROUTES } from "../constants/NavigationRoutes";
import { logoutUser } from "../api/authApi";
import { useState, useRef, useEffect } from "react";

const ROLE_LABEL: Record<string, string> = {
  admin:       "Admin",
  maintenance: "Maintenance",
  operator:    "Operator",
};

function ProfileDropdown({ name, onLogout }: { name: string; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const { getRole, isAdmin } = useAuth();
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const role = getRole();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-sm font-medium text-white"
      >
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
          {name[0].toUpperCase()}
        </span>
        {name}
        <svg className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M0 0l5 6 5-6H0z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl p-4 flex flex-col gap-3 z-50">
          {/* User info */}
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-zinc-800">
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold shrink-0">
              {name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate">{name}</p>
              {role && (
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                  role === "admin"
                    ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                    : role === "maintenance"
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                    : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                }`}>
                  {ROLE_LABEL[role] ?? role}
                </span>
              )}
            </div>
          </div>

          {/* Admin-only: notification groups */}
          {isAdmin() && (
            <button
              onClick={() => { setOpen(false); navigate("/app/notification-groups"); }}
              className="flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span className="text-base">🔔</span>
              Notification Groups
            </button>
          )}

          {/* Logout */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full text-sm py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800 transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { getUser, logout } = useAuth();
  const userData = getUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutUser();
    logout();
    navigate("/login");
  };

  return (
    <nav className="fixed inset-x-0 top-0 p-2 text-white shadow-sm bg-predic z-40">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-14 items-center gap-4">
          <Link to="/app" className="flex items-center gap-2 shrink-0">
            <img src={predicTech} className="w-8" />
            <span className="text-xl font-medium">PredicTech</span>
          </Link>

          <nav className="hidden md:flex gap-6 flex-1 justify-center">
            {NAVIGATION_ROUTES.map((route) => (
              <Link
                key={route.to}
                to={route.to}
                className="font-medium flex items-center text-sm transition-colors hover:underline"
              >
                {route.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <ThemeToggle />
            {userData?.user.name && (
              <ProfileDropdown name={userData.user.name} onLogout={handleLogout} />
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
