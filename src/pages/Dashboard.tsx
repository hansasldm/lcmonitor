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
import { Clock, Users, CalendarCheck, AlertTriangle, Activity, Timer, UsersRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

function EmployeeDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Good morning!</h1>
        <p className="text-sm text-muted-foreground mt-1">Here's your workday overview</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today's Status</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">Not Clocked In</div>
            <p className="text-xs text-muted-foreground mt-1">Clock in to start tracking</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours Today</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Timer className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">0h 0m</div>
            <p className="text-xs text-muted-foreground mt-1">Active time</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">This Week</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">0h 0m</div>
            <p className="text-xs text-muted-foreground mt-1">of 40h target</p>
          </CardContent>
        </Card>
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
      <div className="space-y-6">
        <h1 className="text-2xl font-display font-bold tracking-tight">Team Overview</h1>
        <Card className="shadow-card">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-14 w-14 mx-auto rounded-full bg-muted flex items-center justify-center">
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight">Team Overview</h1>
          <p className="text-sm text-muted-foreground mt-1">Monitor your team's attendance and activity</p>
        </div>
        <div className="flex gap-1.5 bg-muted p-1 rounded-lg">
          <Button
            variant={period === "today" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("today")}
            className="h-7 text-xs px-3"
          >
            Today
          </Button>
          <Button
            variant={period === "week" ? "default" : "ghost"}
            size="sm"
            onClick={() => setPeriod("week")}
            className="h-7 text-xs px-3"
          >
            This Week
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Team Members</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{isLoading ? "…" : totalMembers}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working Now</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{isLoading ? "…" : workingNow.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalMembers > 0 ? `${Math.round((workingNow.length / totalMembers) * 100)}% of team` : ""}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Avg Hours {period === "today" ? "Today" : "This Week"}
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{isLoading ? "…" : formatDuration(avgSeconds)}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sessions</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarCheck className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">
              {isLoading ? "…" : members.reduce((sum, m) => sum + m.session_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{period === "today" ? "today" : "this week"}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
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
                <TableRow>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Name</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Today's Hours</TableHead>
                  {period === "week" && <TableHead className="text-xs font-semibold uppercase tracking-wide">Week Total</TableHead>}
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Clock In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.is_working ? (
                        <Badge className="bg-success/15 text-success border-success/30 font-medium text-[11px]">Working</Badge>
                      ) : m.today_session ? (
                        <Badge variant="secondary" className="font-medium text-[11px]">Done</Badge>
                      ) : (
                        <Badge variant="outline" className="font-medium text-[11px]">Not started</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{formatDuration(m.today_seconds)}</TableCell>
                    {period === "week" && (
                      <TableCell className="font-mono text-sm">{formatDuration(m.period_seconds)}</TableCell>
                    )}
                    <TableCell className="text-xs text-muted-foreground">
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Organization-wide overview and management</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card
          className="shadow-card cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
          onClick={() => navigate("/admin/users")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Users</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{isLoading ? "…" : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.activeUsers} active</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Working Now</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Activity className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{activeSessions.length}</div>
          </CardContent>
        </Card>
        <Card
          className="shadow-card cursor-pointer hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
          onClick={() => navigate("/admin/teams")}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Teams</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-info/10 flex items-center justify-center">
              <UsersRound className="h-4 w-4 text-info" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{isLoading ? "…" : stats.totalTeams}</div>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pending Reviews</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold tracking-tight">{isLoading ? "…" : stats.pendingCorrections}</div>
          </CardContent>
        </Card>
      </div>

      {activeSessions.length > 0 && (
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display font-semibold flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Who's Working Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {activeSessions.map((s: { id: string; start_time: string; user: { first_name: string; last_name: string; email: string } | null }) => (
                <div key={s.id} className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {s.user ? `${s.user.first_name} ${s.user.last_name}` : "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.user?.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
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