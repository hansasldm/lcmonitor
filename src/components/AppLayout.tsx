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
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4">
            <div className="flex items-center gap-2">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground font-medium">
                Employee Time & Activity Tracking
              </span>
            </div>
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">
                  {user.first_name} {user.last_name}
                </span>
                <Badge variant="outline" className="text-xs">
                  {user.role}
                </Badge>
                <Button variant="ghost" size="icon" onClick={logout} title="Sign out">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </header>
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
