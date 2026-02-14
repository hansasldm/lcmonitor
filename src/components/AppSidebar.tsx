import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Clock,
  CalendarCheck,
  Users,
  Settings,
  ShieldCheck,
  LogOut,
  LogIn,
  UsersRound,
  Activity,
} from "lucide-react";
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

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "My Workday", url: "/employee", icon: LogIn, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "My Timesheet", url: "/timesheet", icon: Clock, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "Attendance", url: "/attendance", icon: CalendarCheck, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "Team", url: "/team", icon: Users, roles: ["MANAGER", "ADMIN"] },
];

const adminItems = [
  { title: "Overview", url: "/admin", icon: Settings },
  { title: "Users", url: "/admin/users", icon: Users },
  { title: "Teams", url: "/admin/teams", icon: UsersRound },
  { title: "Events", url: "/admin/events", icon: Activity },
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
    ADMIN: "bg-destructive text-destructive-foreground",
    MANAGER: "bg-info text-info-foreground",
    EMPLOYEE: "bg-primary text-primary-foreground",
  };

  const isAdminRoute = location.pathname.startsWith("/admin");

  return (
    <Sidebar collapsible="icon">
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <ShieldCheck className="h-6 w-6 shrink-0 text-sidebar-primary" />
        {!collapsed && (
          <span className="font-display text-lg font-bold text-sidebar-foreground">
            SLM Tracking
          </span>
        )}
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.url}
                    tooltip={item.title}
                  >
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user?.role === "ADMIN" && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location.pathname === item.url}
                      tooltip={item.title}
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        {user && !collapsed && (
          <div className="px-2 pb-2">
            <div className="text-sm font-medium text-sidebar-foreground">
              {user.first_name} {user.last_name}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`text-[10px] px-1.5 py-0 ${roleColor[user.role] || ""}`}>
                {user.role}
              </Badge>
              <span className="text-xs text-sidebar-foreground/60 truncate">{user.email}</span>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={logout} tooltip="Sign out">
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
