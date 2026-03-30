import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { workSessionsApi } from "@/lib/work-sessions-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Clock, Users, CalendarCheck, AlertTriangle, Activity, Timer, UsersRound, Coffee } from "lucide-react";
import { useNavigate } from "react-router-dom";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/8",
  clickable,
  onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  iconColor?: string;
  iconBg?: string;
  clickable?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`card-premium ${clickable ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className={`h-[18px] w-[18px] ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-[26px] font-display font-bold tracking-tight leading-none">
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
        <h1 className="text-2xl font-display font-bold tracking-tight">Good morning!</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's your workday overview</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Today's Status"
          value="Not Clocked In"
          subtitle="Clock in to start tracking"
          icon={Clock}
        />
        <StatCard
          title="Hours Today"
          value="0h 0m"
          subtitle="Active time"
          icon={Timer}
          iconColor="text-accent"
          iconBg="bg-accent/8"
        />
        <StatCard
          title="This Week"
          value="0h 0m"
          subtitle="of 40h target"
          icon={Activity}
          iconColor="text-info"
          iconBg="bg-info/8"
        />
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
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_working: boolean;
  today_seconds: number;
  period_seconds: number;
  session_count: number;
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
        <h1 className="text-2xl font-display font-bold tracking-tight">Team Overview</h1>
        <Card className="card-premium">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-muted flex items-center justify-center">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-lg font-display font-semibold">No Team Assigned</p>
              <p className="text-sm text-muted-foreground mt-1">
                {data?.message || "You haven't been assigned to a team yet."}
              </p>
            </div>
            <Button variant="outline" size="sm">
              Request Admin to Assign Team
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Team Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor your team's attendance and activity</p>
        </div>
        <div className="flex gap-1 bg-muted/60 p-1 rounded-xl border border-border/40">
          <Button
            variant={period === "today" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("today")}
            className="h-7 text-xs px-3 rounded-lg"
          >
            Today
          </Button>
          <Button
            variant={period === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("week")}
            className="h-7 text-xs px-3 rounded-lg"
          >
            This Week
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Team Members" value={isLoading ? "…" : totalMembers} icon={Users} />
        <StatCard
          title="Working Now"
          value={isLoading ? "…" : workingNow.length}
          subtitle={totalMembers > 0 ? `${Math.round((workingNow.length / totalMembers) * 100)}% of team` : ""}
          icon={Activity}
          iconColor="text-success"
          iconBg="bg-success/8"
        />
        <StatCard
          title={`Avg Hours ${period === "today" ? "Today" : "This Week"}`}
          value={isLoading ? "…" : formatDuration(avgSeconds)}
          icon={Clock}
          iconColor="text-info"
          iconBg="bg-info/8"
        />
        <StatCard
          title="Sessions"
          value={isLoading ? "…" : members.reduce((sum, m) => sum + m.session_count, 0)}
          subtitle={period === "today" ? "today" : "this week"}
          icon={CalendarCheck}
        />
      </div>

      <Card className="card-premium">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em]">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em]">Status</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em]">Today's Hours</TableHead>
                  {period === "week" && <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em]">Week Total</TableHead>}
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.1em]">Clock In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id} className="border-border/40">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded-lg bg-primary/8 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
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
                        <Badge variant="outline" className="font-medium text-[11px] border-border/60">Not started</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">{formatDuration(m.today_seconds)}</TableCell>
                    {period === "week" && (
                      <TableCell className="font-mono text-sm tabular-nums">{formatDuration(m.period_seconds)}</TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
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
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
  });

  const { data: activeData } = useQuery({
    queryKey: ["active-now"],
    queryFn: workSessionsApi.getActiveNow,
    refetchInterval: 30000,
  });

  const stats = data ?? { totalUsers: 0, activeUsers: 0, totalTeams: 0, pendingCorrections: 0 };
  const activeSessions = activeData?.active_sessions ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Organization-wide overview and management</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={isLoading ? "…" : stats.totalUsers}
          subtitle={`${stats.activeUsers} active`}
          icon={Users}
          clickable
          onClick={() => navigate("/admin/users")}
        />
        <StatCard
          title="Working Now"
          value={activeSessions.length}
          icon={Activity}
          iconColor="text-success"
          iconBg="bg-success/8"
        />
        <StatCard
          title="Teams"
          value={isLoading ? "…" : stats.totalTeams}
          icon={UsersRound}
          iconColor="text-info"
          iconBg="bg-info/8"
          clickable
          onClick={() => navigate("/admin/teams")}
        />
        <StatCard
          title="Pending Reviews"
          value={isLoading ? "…" : stats.pendingCorrections}
          icon={AlertTriangle}
          iconColor="text-warning"
          iconBg="bg-warning/8"
        />
      </div>

      {activeSessions.length > 0 && (
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display font-semibold flex items-center gap-2.5">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Who's Working Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {activeSessions.map((s: { id: string; start_time: string; user: { first_name: string; last_name: string; email: string } | null }) => (
                <div key={s.id} className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-success/8 flex items-center justify-center text-[10px] font-bold text-success shrink-0">
                      {s.user ? `${s.user.first_name[0]}${s.user.last_name[0]}` : "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {s.user ? `${s.user.first_name} ${s.user.last_name}` : "Unknown"}
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
    case "ADMIN":
      return <AdminDashboard />;
    case "MANAGER":
      return <ManagerDashboard />;
    default:
      return <EmployeeDashboard />;
  }
};

export default Dashboard;