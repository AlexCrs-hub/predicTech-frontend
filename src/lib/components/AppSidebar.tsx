import ErrorCard from "./machine/ErrorCard";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/lib/components/ui/sidebar";
import { ScrollArea } from "@radix-ui/react-scroll-area";

const items = [
  {
    id: 1,
    isWarning: true,
    message:
      "Cutter Machine is drawing elevated current (avg 96.8 A). Possible blade dullness or material jam.",
    url: `/machines/1`,
  },
  {
    id: 2,
    isWarning: false,
    message:
      "Current consumption exceeded the threshold value.",
    url: "/machines/2",
  },
  {
    id: 9,
    isWarning: true,
    message:
      "Cutter Machine temperature rising rapidly. Cooling efficiency may be reduced.",
    url: "/machines/9",
  },
];

export function AppSidebar() {
  return (
    <Sidebar className="z-30 mr-0 top-16 dark:border-predic/40">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="pt-2">
              <ScrollArea className="pb-16">
                {items.map((item) => (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton className="flex h-full">
                      <a href={item.url} className="flex h-full">
                        <ErrorCard
                          machineId={item.id}
                          isWarning={item.isWarning}
                          message={item.message}
                        />
                      </a>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </ScrollArea>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
