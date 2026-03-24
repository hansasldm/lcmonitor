import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card/80 backdrop-blur-sm px-5 sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <span className="text-sm text-muted-foreground font-medium hidden sm:inline">
                Employee Time & Attendance
              </span>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {user.first_name} {user.last_name}
                  </span>
                  <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0 border-border text-muted-foreground">
                    {user.role}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={logout} title="Sign out" className="text-muted-foreground hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
        <ChatWidget />
      </div>
    </SidebarProvider>
  );
}