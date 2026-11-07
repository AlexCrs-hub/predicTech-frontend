import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Bell, ChevronDown, LogOut, Menu, X } from "lucide-react";
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
        aria-label="Account menu"
        aria-expanded={open}
        className="flex items-center gap-2 h-9 pl-1 pr-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground"
      >
        <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
          {name[0].toUpperCase()}
        </span>
        <span className="hidden sm:inline max-w-[10rem] truncate">{name}</span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-popover text-popover-foreground border rounded-xl shadow-lg p-2 flex flex-col gap-1 z-50">
          {/* User info */}
          <div className="flex items-center gap-3 p-2 pb-3 mb-1 border-b">
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold shrink-0">
              {name[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{name}</p>
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
              className="flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg text-foreground/80 hover:bg-accent transition-colors"
            >
              <Bell className="size-4 text-muted-foreground" />
              Notification Groups
            </button>
          )}

          {/* Logout */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex items-center gap-2 w-full text-left text-sm px-3 py-2 rounded-lg text-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          >
            <LogOut className="size-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
    isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
  }`;

export default function Navbar() {
  const { getUser, logout } = useAuth();
  const userData = getUser();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // close the mobile menu on navigation
  useEffect(() => setMenuOpen(false), [pathname]);

  const handleLogout = () => {
    logoutUser();
    logout();
    navigate("/login");
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="w-full max-w-screen-2xl mx-auto px-3 sm:px-6">
        <div className="flex h-14 items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-foreground hover:bg-accent transition-colors"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
            <Link to="/app" className="flex items-center gap-2 shrink-0 mr-4">
              <img src={predicTech} className="w-7" alt="" />
              <span className="text-base font-semibold tracking-tight text-foreground">PredicTech</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 flex-1">
            {NAVIGATION_ROUTES.map((route) => (
              <NavLink key={route.to} to={route.to} end={route.to === "/app"} className={linkClass}>
                {route.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <ThemeToggle />
            {userData?.user?.name && (
              <ProfileDropdown name={userData.user.name} onLogout={handleLogout} />
            )}
          </div>
        </div>

        {/* mobile menu */}
        {menuOpen && (
          <nav className="md:hidden flex flex-col gap-1 pb-3 pt-2 border-t">
            {NAVIGATION_ROUTES.map((route) => (
              <NavLink key={route.to} to={route.to} end={route.to === "/app"} className={linkClass}>
                {route.label}
              </NavLink>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
