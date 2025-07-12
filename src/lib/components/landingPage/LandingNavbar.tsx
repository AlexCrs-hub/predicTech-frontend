import { Link } from "react-router-dom";
import predicTech from "../../assets/logo_predic.svg";

export default function LandingNavbar() {
  return (
    <nav className="fixed inset-x-0 top-0 p-2 text-white shadow-sm z-40">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="flex justify-between h-14 items-center">
          <div className="flex items-center justify-evenly">
            <img src={predicTech} className="w-8" alt="PredicTech Logo" />
            <span className="w-1/2 text-xl font-medium">PredicTech</span>
          </div>
          <nav className="gap-4 flex">
            <Link to="/login" className="font-medium text-xl">
              Login
            </Link>
            <Link to="/register" className="font-medium text-xl">
              Register
            </Link>
            <Link to="/about" className="font-medium text-xl">
              About us
            </Link>
          </nav>
        </div>
      </div>
    </nav>
  );
}
