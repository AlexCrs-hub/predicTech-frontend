import { Outlet } from "react-router-dom";
import Navbar from "@/lib/components/Navbar";
import { SidebarProvider } from "@/lib/components/ui/sidebar";
import { AppSidebar } from "@/lib/components/AppSidebar";
import { CustomTrigger } from "@/lib/components/ui/CustomTrigger";

// Notifications/alerts sidebar is hidden for now — flip to bring it back
const SHOW_NOTIFICATIONS_SIDEBAR = false;

export default function Layout() {
  return (
    <SidebarProvider className="flex w-max-[1920px]">
      {SHOW_NOTIFICATIONS_SIDEBAR && <AppSidebar />}
      <Navbar />
      <div className="pt-14 min-h-screen w-full bg-muted/30">
        {SHOW_NOTIFICATIONS_SIDEBAR && <CustomTrigger />}
        <Outlet />
      </div>
    </SidebarProvider>
  );
}
