import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  Users,
  Settings,
  LogOut,
  LogIn,
  UsersRound,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import companyLogo from "@/assets/company-logo.png";
import companyIcon from "@/assets/company-icon.png";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "My Workday", url: "/employee", icon: LogIn, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "My Timesheet", url: "/timesheet", icon: Clock, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "Chats", url: "/chats", icon: MessageSquare, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "Team", url: "/team", icon: Users, roles: ["MANAGER", "ADMIN"] },
];

const adminItems = [
  { title: "Overview", url: "/admin", icon: Settings },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Teams", url: "/admin/teams", icon: UsersRound },
];

export function AppSidebar() {
  const { user, logout } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const filteredItems = navItems.filter((item) =>
    user ? item.roles.includes(user.role) : false
  );

  const roleColor: Record<string, string> = {
    ADMIN: "bg-accent/20 text-accent border border-accent/30",
    MANAGER: "bg-info/20 text-info border border-info/30",
    EMPLOYEE: "bg-sidebar-accent text-sidebar-accent-foreground",
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Logo / Brand ── */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="shrink-0 flex items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm p-1.5">
          <img
            src={companyLogo}
            alt="LC Monitor"
            className="h-8 w-8 object-contain"
          />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight text-sidebar-accent-foreground leading-tight">
              LC Monitor
            </span>
            <span className="text-[10px] font-medium text-sidebar-muted tracking-wide uppercase">
              Employee Tracking
            </span>
          </div>
        )}
      </div>

      <SidebarContent className="px-2 pt-4">
        {/* ── Main Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold tracking-widest uppercase text-sidebar-muted mb-1">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {filteredItems.map((item) => {
                const active = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className={`rounded-md transition-all duration-150 ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                        {active && !collapsed && (
                          <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Admin Section ── */}
        {user?.role === "ADMIN" && (
          <>
            {!collapsed && (
              <Separator className="mx-3 my-3 bg-sidebar-border" />
            )}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold tracking-widest uppercase text-sidebar-muted mb-1">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {adminItems.map((item) => {
                    const active = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className={`rounded-md transition-all duration-150 ${
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                          }`}
                        >
                          <NavLink to={item.url} end>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.title}</span>
                            {active && !collapsed && (
                              <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-50" />
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* ── Footer / User Info ── */}
      <SidebarFooter className="border-t border-sidebar-border px-3 py-3">
        {user && !collapsed && (
          <div className="mb-2">
            <div className="text-sm font-medium text-sidebar-accent-foreground">
              {user.first_name} {user.last_name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] px-1.5 py-0 font-medium ${roleColor[user.role] || ""}`}>
                {user.role}
              </Badge>
              <span className="text-[11px] text-sidebar-muted truncate">{user.email}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="Sign out"
              className="rounded-md text-sidebar-foreground hover:bg-destructive/15 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}