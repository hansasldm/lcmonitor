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
      <h1 className="text-3xl font-display font-bold">Good morning!</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Status</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">Not Clocked In</div>
            <p className="text-xs text-muted-foreground mt-1">Clock in to start tracking</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Hours Today</CardTitle>
            <Timer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">0h 0m</div>
            <p className="text-xs text-muted-foreground mt-1">Active time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Week</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">0h 0m</div>
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

  const members: TeamMember[] = data?.members ?? [];
  const workingNow = members.filter((m) => m.is_working);
  const totalMembers = members.length;
  const avgSeconds = totalMembers > 0
    ? Math.floor(members.reduce((sum, m) => sum + (period === "today" ? m.today_seconds : m.period_seconds), 0) / totalMembers)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Team Overview</h1>
        <div className="flex gap-2">
          <Button
            variant={period === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("today")}
          >
            Today
          </Button>
          <Button
            variant={period === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("week")}
          >
            This Week
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : totalMembers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Working Now</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : workingNow.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalMembers > 0 ? `${Math.round((workingNow.length / totalMembers) * 100)}% of team` : ""}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Hours {period === "today" ? "Today" : "This Week"}
            </CardTitle>
            <Clock className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : formatDuration(avgSeconds)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sessions</CardTitle>
            <CalendarCheck className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">
              {isLoading ? "…" : members.reduce((sum, m) => sum + m.session_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{period === "today" ? "today" : "this week"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
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
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Today's Hours</TableHead>
                  {period === "week" && <TableHead>Week Total</TableHead>}
                  <TableHead>Clock In</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{m.first_name} {m.last_name}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {m.is_working ? (
                        <Badge className="bg-success/15 text-success border-success/30">Working</Badge>
                      ) : m.today_session ? (
                        <Badge variant="secondary">Done</Badge>
                      ) : (
                        <Badge variant="outline">Not started</Badge>
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
      <h1 className="text-3xl font-display font-bold">Admin Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => navigate("/admin/users")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">{stats.activeUsers} active</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Working Now</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{activeSessions.length}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => navigate("/admin/teams")}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
            <UsersRound className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : stats.totalTeams}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Reviews</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : stats.pendingCorrections}</div>
          </CardContent>
        </Card>
      </div>

      {/* Who is working now */}
      {activeSessions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-success" />
              Who's Working Now
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeSessions.map((s: { id: string; start_time: string; user: { first_name: string; last_name: string; email: string } | null }) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">
                      {s.user ? `${s.user.first_name} ${s.user.last_name}` : "Unknown"}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.user?.email}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Since {new Date(s.start_time).toLocaleTimeString()}
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
