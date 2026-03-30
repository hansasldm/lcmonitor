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
  ClipboardList,
} from "lucide-react";
import companyLogo from "@/assets/lemoncode-logo.png";
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
  { title: "Chats", url: "/chats", icon: MessageSquare, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
  { title: "Tasks", url: "/tasks", icon: ClipboardList, roles: ["EMPLOYEE", "MANAGER", "ADMIN"] },
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

  const roleBadge: Record<string, string> = {
    ADMIN: "bg-accent/15 text-accent border-accent/20",
    MANAGER: "bg-info/15 text-info border-info/20",
    EMPLOYEE: "bg-sidebar-accent/80 text-sidebar-accent-foreground border-sidebar-border",
  };

  return (
    <Sidebar collapsible="icon">
      {/* Brand */}
      <div className="flex items-center justify-center px-3 py-5 border-b border-sidebar-border/60">
        {collapsed ? (
          <img src={companyIcon} alt="LC" className="h-9 w-auto object-contain" />
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/[0.06] border border-white/[0.06] flex items-center justify-center p-1.5">
              <img src={companyIcon} alt="LC" className="h-full w-auto object-contain" />
            </div>
            <div>
              <span className="text-[15px] font-display font-bold text-white tracking-tight leading-none">
                LC Monitor
              </span>
              <span className="block text-[10px] text-sidebar-muted font-medium tracking-[0.12em] uppercase mt-0.5">
                Workforce
              </span>
            </div>
          </div>
        )}
      </div>

      <SidebarContent className="px-2.5 pt-5">
        {/* Main Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="section-label px-3 mb-2.5 text-sidebar-muted">
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
                      className={`rounded-lg h-9 transition-all duration-150 ${
                        active
                          ? "bg-sidebar-accent text-white font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                          : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-white/90"
                      }`}
                    >
                      <NavLink to={item.url} end>
                        <item.icon className="h-[15px] w-[15px] shrink-0" />
                        <span className="truncate text-[13px]">{item.title}</span>
                        {active && !collapsed && (
                          <ChevronRight className="ml-auto h-3 w-3 opacity-30" />
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Admin */}
        {user?.role === "ADMIN" && (
          <>
            {!collapsed && (
              <div className="mx-3 my-4 h-px bg-sidebar-border/40" />
            )}
            <SidebarGroup>
              <SidebarGroupLabel className="section-label px-3 mb-2.5 text-sidebar-muted">
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
                          className={`rounded-lg h-9 transition-all duration-150 ${
                            active
                              ? "bg-sidebar-accent text-white font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                              : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-white/90"
                          }`}
                        >
                          <NavLink to={item.url} end>
                            <item.icon className="h-[15px] w-[15px] shrink-0" />
                            <span className="truncate text-[13px]">{item.title}</span>
                            {active && !collapsed && (
                              <ChevronRight className="ml-auto h-3 w-3 opacity-30" />
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

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border/40 px-3 py-3.5">
        {user && !collapsed && (
          <div className="mb-2.5 px-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-sidebar-accent to-sidebar-accent/60 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
                {user.first_name[0]}{user.last_name[0]}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-white/90 truncate leading-tight">
                  {user.first_name} {user.last_name}
                </div>
                <Badge className={`text-[9px] px-1.5 py-0 font-semibold mt-0.5 border ${roleBadge[user.role] || ""}`}>
                  {user.role}
                </Badge>
              </div>
            </div>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={logout}
              tooltip="Sign out"
              className="rounded-lg h-9 text-sidebar-foreground hover:bg-destructive/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="h-[15px] w-[15px]" />
              <span className="text-[13px]">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
