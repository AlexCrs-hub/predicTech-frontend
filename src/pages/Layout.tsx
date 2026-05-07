import { Outlet } from "react-router-dom";
import Navbar from "@/lib/components/Navbar";
import { SidebarProvider } from "@/lib/components/ui/sidebar";
import { AppSidebar } from "@/lib/components/AppSidebar";
import { CustomTrigger } from "@/lib/components/ui/CustomTrigger";

export default function Layout() {
  return (
    <SidebarProvider className="flex w-max-[1920px]">
      <AppSidebar />
      <Navbar />
      <div className="pt-[4.5rem] h-screen w-full">
        <CustomTrigger />
        <Outlet />
      </div>
    </SidebarProvider>
  );
}
