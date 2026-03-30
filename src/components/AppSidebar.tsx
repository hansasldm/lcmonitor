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
    ADMIN: "bg-accent/15 text-accent border border-accent/25",
    MANAGER: "bg-info/15 text-info border border-info/25",
    EMPLOYEE: "bg-sidebar-accent text-sidebar-accent-foreground",
  };

  return (
    <Sidebar collapsible="icon">
      {/* ── Logo / Brand ── */}
      <div className="flex items-center justify-center px-3 py-5 border-b border-sidebar-border">
        {collapsed ? (
          <img src={companyIcon} alt="LC Monitor" className="h-10 w-auto object-contain" />
        ) : (
          <div className="flex items-center gap-3">
            <img src={companyIcon} alt="LC Monitor" className="h-12 w-auto object-contain" />
            <div>
              <span className="text-sm font-display font-bold text-sidebar-accent-foreground tracking-tight">
                LC Monitor
              </span>
              <span className="block text-[10px] text-sidebar-muted font-medium tracking-wider uppercase">
                Workforce
              </span>
            </div>
          </div>
        )}
      </div>

      <SidebarContent className="px-2 pt-4">
        {/* ── Main Navigation ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-sidebar-muted mb-2">
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
                      className={`rounded-lg transition-all duration-150 ${
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-inner-glow"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                      }`}
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="truncate text-[13px]">{item.title}</span>
                        {active && !collapsed && (
                          <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
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
              <Separator className="mx-3 my-3 bg-sidebar-border/60" />
            )}
            <SidebarGroup>
              <SidebarGroupLabel className="px-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-sidebar-muted mb-2">
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
                          className={`rounded-lg transition-all duration-150 ${
                            active
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-inner-glow"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                          }`}
                        >
                          <NavLink to={item.url} end>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate text-[13px]">{item.title}</span>
                            {active && !collapsed && (
                              <ChevronRight className="ml-auto h-3 w-3 opacity-40" />
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
      <SidebarFooter className="border-t border-sidebar-border/60 px-3 py-3">
        {user && !collapsed && (
          <div className="mb-2 px-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-sidebar-accent flex items-center justify-center text-xs font-bold text-sidebar-accent-foreground shrink-0">
                {user.first_name[0]}{user.last_name[0]}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-sidebar-accent-foreground truncate">
                  {user.first_name} {user.last_name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge className={`text-[9px] px-1.5 py-0 font-semibold ${roleColor[user.role] || ""}`}>
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="Sign out"
              className="rounded-lg text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-[13px]">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}