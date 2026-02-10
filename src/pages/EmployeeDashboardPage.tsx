import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workSessionsApi } from "@/lib/work-sessions-api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Timer, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function EmployeeDashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [elapsed, setElapsed] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["work-session-status"],
    queryFn: workSessionsApi.getStatus,
    refetchInterval: 30000,
  });

  const session = data?.session ?? null;
  const isWorking = data?.is_working ?? false;

  // Live timer
  useEffect(() => {
    if (!isWorking || !session?.start_time) {
      setElapsed(session?.total_active_seconds ?? 0);
      return;
    }

    const startTime = new Date(session.start_time).getTime();

    const tick = () => {
      const now = Date.now();
      setElapsed(Math.floor((now - startTime) / 1000));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isWorking, session?.start_time, session?.total_active_seconds]);

  const clockInMut = useMutation({
    mutationFn: workSessionsApi.clockIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-session-status"] });
      toast({ title: "Clocked in", description: "Your work session has started." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clockOutMut = useMutation({
    mutationFn: workSessionsApi.clockOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-session-status"] });
      toast({ title: "Clocked out", description: "Your work session has ended." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sessionDone = session && session.end_time;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">
        Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.first_name}!
      </h1>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Status Card */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-lg text-muted-foreground">Loading…</div>
            ) : isWorking ? (
              <Badge className="bg-success/15 text-success border-success/30 text-base px-3 py-1">
                Working
              </Badge>
            ) : sessionDone ? (
              <Badge variant="secondary" className="text-base px-3 py-1">
                Done for today
              </Badge>
            ) : (
              <Badge variant="outline" className="text-base px-3 py-1">
                Not clocked in
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Timer Card */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Time</CardTitle>
            <Timer className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-display font-bold font-mono tracking-wider">
              {formatDuration(elapsed)}
            </div>
            {isWorking && (
              <p className="text-xs text-muted-foreground mt-1 animate-pulse">● Live</p>
            )}
          </CardContent>
        </Card>

        {/* Clock Card */}
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Clock</CardTitle>
            <Clock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            {session?.start_time && (
              <p className="text-xs text-muted-foreground">
                Clocked in: {new Date(session.start_time).toLocaleTimeString()}
              </p>
            )}
            {session?.end_time && (
              <p className="text-xs text-muted-foreground">
                Clocked out: {new Date(session.end_time).toLocaleTimeString()}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        {!isWorking && !sessionDone && (
          <Button
            size="lg"
            onClick={() => clockInMut.mutate()}
            disabled={clockInMut.isPending}
            className="gap-2"
          >
            <LogIn className="h-5 w-5" />
            Clock In
          </Button>
        )}
        {isWorking && (
          <Button
            size="lg"
            variant="destructive"
            onClick={() => clockOutMut.mutate()}
            disabled={clockOutMut.isPending}
            className="gap-2"
          >
            <LogOut className="h-5 w-5" />
            Clock Out
          </Button>
        )}
        {sessionDone && (
          <p className="text-sm text-muted-foreground self-center">
            You've completed your session for today. See you tomorrow!
          </p>
        )}
      </div>
    </div>
  );
}
