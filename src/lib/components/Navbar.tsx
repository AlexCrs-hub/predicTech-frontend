import { Link, useNavigate } from "react-router-dom";
import predicTech from "@/lib/assets/logo_predic.svg";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "@/context/AuthContext";
import { NAVIGATION_ROUTES } from "../constants/NavigationRoutes";
import { logoutUser } from "../api/authApi";

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
        <div className="flex justify-between h-14 items-center">
          <Link to="/app" className="flex items-center justify-evenly">
            <img src={predicTech} className="w-8"></img>
            <span className="w-1/2 text-xl font-medium">PredicTech</span>
          </Link>
          <nav className="hidden md:flex gap-6">
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
          <div className="p-6">
            <ThemeToggle />
          </div>
          {userData?.user.name && (
              <>
                <span className="ml-2">{userData.user.name}</span>
                <button
                  onClick={handleLogout}
                  className="ml-4 px-3 py-1 rounded bg-white text-predic font-medium text-sm hover:bg-gray-200 transition"
                >
                  Logout
                </button>
              </>
            )}
        </div>
      </div>
    </nav>
  );
}
