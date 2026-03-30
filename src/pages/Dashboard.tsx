import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { workSessionsApi } from "@/lib/work-sessions-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Clock, Users, CalendarCheck, AlertTriangle, Activity, Timer, UsersRound, Coffee, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

function StatCard({
  title, value, subtitle, icon: Icon,
  iconColor = "text-primary", iconBg = "bg-primary/8",
  clickable, onClick,
}: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ElementType; iconColor?: string; iconBg?: string;
  clickable?: boolean; onClick?: () => void;
}) {
  return (
    <Card
      className={`card-premium ${clickable ? "card-interactive" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="section-label">{title}</CardTitle>
        <div className={`stat-icon ${iconBg}`}>
          <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-[28px] font-display font-extrabold tracking-tight leading-none tabular-nums">
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-heading">Good morning!</h1>
        <p className="page-subheading">Here's your workday overview</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Today's Status" value="Not Clocked In" subtitle="Clock in to start tracking" icon={Clock} />
        <StatCard title="Hours Today" value="0h 0m" subtitle="Active time" icon={Timer} iconColor="text-accent" iconBg="bg-accent/8" />
        <StatCard title="This Week" value="0h 0m" subtitle="of 40h target" icon={TrendingUp} iconColor="text-info" iconBg="bg-info/8" />
      </div>
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}h ${m}m`;
}

interface TeamMember {
  id: string; first_name: string; last_name: string; email: string;
  role: string; is_working: boolean; today_seconds: number;
  period_seconds: number; session_count: number;
  today_session: { start_time: string; end_time: string | null } | null;
}

function ManagerDashboard() {
  const [period, setPeriod] = useState<"today" | "week">("today");
  const { data, isLoading } = useQuery({
    queryKey: ["team-overview", period],
    queryFn: () => workSessionsApi.getTeamOverview(period),
    refetchInterval: 30000,
  });

  const hasTeam = data?.hasTeam !== false;
  const members: TeamMember[] = data?.members ?? [];
  const workingNow = members.filter((m) => m.is_working);
  const totalMembers = members.length;
  const avgSeconds = totalMembers > 0
    ? Math.floor(members.reduce((sum, m) => sum + (period === "today" ? m.today_seconds : m.period_seconds), 0) / totalMembers)
    : 0;

  if (!isLoading && !hasTeam) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="page-heading">Team Overview</h1>
        <Card className="card-premium">
          <CardContent className="py-16 text-center space-y-4">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-muted/80 flex items-center justify-center">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-display font-semibold">No Team Assigned</p>
              <p className="text-sm text-muted-foreground mt-1">{data?.message || "You haven't been assigned to a team yet."}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-heading">Team Overview</h1>
          <p className="page-subheading">Monitor your team's attendance and activity</p>
        </div>
        <div className="flex gap-0.5 bg-muted/60 p-1 rounded-xl border border-border/40">
          {(["today", "week"] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? "default" : "ghost"}
              size="sm"
              onClick={() => setPeriod(p)}
              className="h-7 text-xs px-3.5 rounded-lg"
            >
              {p === "today" ? "Today" : "This Week"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Team Members" value={isLoading ? "…" : totalMembers} icon={Users} />
        <StatCard
          title="Working Now" value={isLoading ? "…" : workingNow.length}
          subtitle={totalMembers > 0 ? `${Math.round((workingNow.length / totalMembers) * 100)}% of team` : ""}
          icon={Activity} iconColor="text-success" iconBg="bg-success/8"
        />
        <StatCard
          title={`Avg Hours ${period === "today" ? "Today" : "This Week"}`}
          value={isLoading ? "…" : formatDuration(avgSeconds)}
          icon={Clock} iconColor="text-info" iconBg="bg-info/8"
        />
        <StatCard
          title="Sessions" value={isLoading ? "…" : members.reduce((sum, m) => sum + m.session_count, 0)}
          subtitle={period === "today" ? "today" : "this week"}
          icon={CalendarCheck}
        />
      </div>

      <Card className="card-premium overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground p-6">No team members assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="section-label pl-6">Name</TableHead>
                  <TableHead className="section-label">Status</TableHead>
                  <TableHead className="section-label">Today's Hours</TableHead>
                  {period === "week" && <TableHead className="section-label">Week Total</TableHead>}
                  <TableHead className="section-label pr-6">Clock In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className="border-border/30 hover:bg-muted/30">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary/6 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {m.first_name[0]}{m.last_name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                          <p className="text-[11px] text-muted-foreground">{m.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.is_working ? (
                        <Badge className="bg-success/10 text-success border-success/20 font-medium text-[11px]">Working</Badge>
                      ) : m.today_session ? (
                        <Badge variant="secondary" className="font-medium text-[11px]">Done</Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium text-[11px] border-border/50">Not started</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">{formatDuration(m.today_seconds)}</TableCell>
                    {period === "week" && (
                      <TableCell className="font-mono text-sm tabular-nums">{formatDuration(m.period_seconds)}</TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground tabular-nums pr-6">
                      {m.today_session
                        ? new Date(m.today_session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ["admin-stats"], queryFn: adminApi.getStats });
  const { data: activeData } = useQuery({
    queryKey: ["active-now"], queryFn: workSessionsApi.getActiveNow, refetchInterval: 30000,
  });

  const stats = data ?? { totalUsers: 0, activeUsers: 0, totalTeams: 0, pendingCorrections: 0 };
  const activeSessions = activeData?.active_sessions ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-heading">Admin Dashboard</h1>
        <p className="page-subheading">Organization-wide overview and management</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Users" value={isLoading ? "…" : stats.totalUsers} subtitle={`${stats.activeUsers} active`} icon={Users} clickable onClick={() => navigate("/admin/users")} />
        <StatCard title="Working Now" value={activeSessions.length} icon={Activity} iconColor="text-success" iconBg="bg-success/8" />
        <StatCard title="Teams" value={isLoading ? "…" : stats.totalTeams} icon={UsersRound} iconColor="text-info" iconBg="bg-info/8" clickable onClick={() => navigate("/admin/teams")} />
        <StatCard title="Pending Reviews" value={isLoading ? "…" : stats.pendingCorrections} icon={AlertTriangle} iconColor="text-warning" iconBg="bg-warning/8" />
      </div>

      {activeSessions.length > 0 && (
        <Card className="card-premium overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display font-semibold flex items-center gap-2.5">
              <span className="dot-live" />
              Who's Working Now
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/30">
              {activeSessions.map((s: { id: string; start_time: string; on_break?: boolean; user: { first_name: string; last_name: string; email: string } | null }) => (
                <div key={s.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${s.on_break ? "bg-warning/8 text-warning" : "bg-success/8 text-success"}`}>
                      {s.user ? `${s.user.first_name[0]}${s.user.last_name[0]}` : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium flex items-center gap-2">
                        {s.user ? `${s.user.first_name} ${s.user.last_name}` : "Unknown"}
                        {s.on_break && (
                          <Badge className="bg-warning/10 text-warning border-warning/20 text-[10px] px-1.5 py-0">
                            <Coffee className="h-2.5 w-2.5 mr-0.5" /> Break
                          </Badge>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{s.user?.email}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono tabular-nums">
                    Since {new Date(s.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  if (!user) return null;
  switch (user.role) {
    case "ADMIN": return <AdminDashboard />;
    case "MANAGER": return <ManagerDashboard />;
    default: return <EmployeeDashboard />;
  }
};

export default Dashboard;
