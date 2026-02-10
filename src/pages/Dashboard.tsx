import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, CalendarCheck, AlertTriangle, Activity, Timer, Settings, UsersRound } from "lucide-react";
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

function ManagerDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Team Overview</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Present Today</CardTitle>
            <CalendarCheck className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Corrections</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Hours Today</CardTitle>
            <Clock className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">0h</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: adminApi.getStats,
  });

  const stats = data ?? { totalUsers: 0, activeUsers: 0, totalTeams: 0, pendingCorrections: 0 };

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
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Today</CardTitle>
            <Activity className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-display font-bold">{isLoading ? "…" : stats.activeUsers}</div>
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
