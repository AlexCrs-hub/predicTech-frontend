import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex w-full items-center gap-8 justify-center p-8 flex-col">
      <h3 className="text-3xl flex flex-col gap-6 font-bold text-center">
        <p className="text-4xl">404</p>
        <p className="font-medium">Page Not Found</p>
      </h3>
      <Link
        to="/app"
        className="w-64 bg-zinc-800 text-white text-center p-1.5 rounded-md hover:bg-zinc-700 duration-100 font-medium"
      >
        Redirect to main page
      </Link>
    </div>
  );
}
