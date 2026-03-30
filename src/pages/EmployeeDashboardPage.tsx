import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workSessionsApi } from "@/lib/work-sessions-api";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, Timer, Activity, Coffee, Play } from "lucide-react";
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
  const [breakElapsed, setBreakElapsed] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ["work-session-status"],
    queryFn: workSessionsApi.getStatus,
    refetchInterval: 30000,
  });

  const session = data?.session ?? null;
  const isWorking = data?.is_working ?? false;
  const onBreak = data?.on_break ?? false;
  const activeBreak = data?.active_break ?? null;
  const breaks = data?.breaks ?? [];
  const totalBreakSeconds = data?.total_break_seconds ?? 0;

  // Live work timer (excludes break time)
  useEffect(() => {
    if (!isWorking || !session?.start_time) {
      setElapsed(session?.total_active_seconds ?? 0);
      return;
    }

    const startTime = new Date(session.start_time).getTime();

    const tick = () => {
      const now = Date.now();
      const totalSec = Math.floor((now - startTime) / 1000);
      // Subtract total break time for accurate active time
      if (onBreak) {
        // While on break, freeze the active timer at last known value
        const breakStart = activeBreak ? new Date(activeBreak.break_start).getTime() : now;
        const completedBreakSec = breaks
          .filter((b: { break_end: string | null }) => b.break_end)
          .reduce((sum: number, b: { duration_seconds: number }) => sum + b.duration_seconds, 0);
        const currentBreakSec = Math.floor((now - breakStart) / 1000);
        setElapsed(Math.max(0, totalSec - completedBreakSec - currentBreakSec));
      } else {
        const completedBreakSec = breaks
          .filter((b: { break_end: string | null }) => b.break_end)
          .reduce((sum: number, b: { duration_seconds: number }) => sum + b.duration_seconds, 0);
        setElapsed(Math.max(0, totalSec - completedBreakSec));
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isWorking, session?.start_time, session?.total_active_seconds, onBreak, activeBreak, breaks]);

  // Live break timer
  useEffect(() => {
    if (!onBreak || !activeBreak?.break_start) {
      setBreakElapsed(0);
      return;
    }

    const breakStart = new Date(activeBreak.break_start).getTime();
    const tick = () => {
      setBreakElapsed(Math.floor((Date.now() - breakStart) / 1000));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [onBreak, activeBreak?.break_start]);

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

  const breakInMut = useMutation({
    mutationFn: workSessionsApi.breakIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-session-status"] });
      toast({ title: "Break started", description: "Enjoy your break!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const breakOutMut = useMutation({
    mutationFn: workSessionsApi.breakOut,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-session-status"] });
      toast({ title: "Break ended", description: "Welcome back to work!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sessionDone = session && session.end_time;

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-display font-bold tracking-tight">
        Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"}, {user?.first_name}!
      </h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Status Card */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Status</CardTitle>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-primary/8">
              <Activity className="h-[18px] w-[18px] text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-lg text-muted-foreground">Loading…</div>
            ) : onBreak ? (
              <Badge className="bg-warning/10 text-warning border-warning/20 text-sm px-3 py-1">
                <Coffee className="h-3.5 w-3.5 mr-1.5" />
                On Break
              </Badge>
            ) : isWorking ? (
              <Badge className="bg-success/10 text-success border-success/20 text-sm px-3 py-1">
                Working
              </Badge>
            ) : sessionDone ? (
              <Badge variant="secondary" className="text-sm px-3 py-1">
                Done for today
              </Badge>
            ) : (
              <Badge variant="outline" className="text-sm px-3 py-1 border-border/60">
                Not clocked in
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Active Time Card */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Active Time</CardTitle>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-success/8">
              <Timer className="h-[18px] w-[18px] text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[26px] font-display font-bold font-mono tracking-wider tabular-nums leading-none">
              {formatDuration(elapsed)}
            </div>
            {isWorking && !onBreak && (
              <p className="text-xs text-success mt-1.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                Live
              </p>
            )}
            {onBreak && (
              <p className="text-xs text-warning mt-1.5">Paused during break</p>
            )}
          </CardContent>
        </Card>

        {/* Break Time Card */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Break Time</CardTitle>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-warning/8">
              <Coffee className="h-[18px] w-[18px] text-warning" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-[26px] font-display font-bold font-mono tracking-wider tabular-nums leading-none">
              {onBreak
                ? formatDuration(totalBreakSeconds - (activeBreak ? Math.floor((Date.now() - new Date(activeBreak.break_start).getTime()) / 1000) : 0) + breakElapsed)
                : formatDuration(totalBreakSeconds)}
            </div>
            {onBreak && (
              <p className="text-xs text-warning mt-1.5 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                On break — {formatDuration(breakElapsed)}
              </p>
            )}
            {!onBreak && breaks.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1.5">{breaks.length} break{breaks.length !== 1 ? "s" : ""} today</p>
            )}
          </CardContent>
        </Card>

        {/* Clock Info Card */}
        <Card className="card-premium">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Clock</CardTitle>
            <div className="h-10 w-10 rounded-xl flex items-center justify-center bg-info/8">
              <Clock className="h-[18px] w-[18px] text-info" />
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {session?.start_time && (
              <p className="text-xs text-muted-foreground">
                In: <span className="font-mono tabular-nums text-foreground">{new Date(session.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            )}
            {session?.end_time && (
              <p className="text-xs text-muted-foreground">
                Out: <span className="font-mono tabular-nums text-foreground">{new Date(session.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </p>
            )}
            {!session && <p className="text-xs text-muted-foreground">No session today</p>}
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {!isWorking && !sessionDone && (
          <Button
            size="lg"
            onClick={() => clockInMut.mutate()}
            disabled={clockInMut.isPending}
            className="gap-2 shadow-premium"
          >
            <LogIn className="h-5 w-5" />
            Clock In
          </Button>
        )}
        {isWorking && !onBreak && (
          <>
            <Button
              size="lg"
              variant="outline"
              onClick={() => breakInMut.mutate()}
              disabled={breakInMut.isPending}
              className="gap-2 border-warning/30 text-warning hover:bg-warning/5 hover:text-warning"
            >
              <Coffee className="h-5 w-5" />
              Start Break
            </Button>
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
          </>
        )}
        {isWorking && onBreak && (
          <Button
            size="lg"
            onClick={() => breakOutMut.mutate()}
            disabled={breakOutMut.isPending}
            className="gap-2 bg-accent hover:bg-accent/90 shadow-premium"
          >
            <Play className="h-5 w-5" />
            End Break
          </Button>
        )}
        {sessionDone && (
          <p className="text-sm text-muted-foreground self-center">
            You've completed your session for today. See you tomorrow!
          </p>
        )}
      </div>

      {/* Break History */}
      {breaks.length > 0 && (
        <Card className="card-premium">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
              <Coffee className="h-4 w-4 text-warning" />
              Today's Breaks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0">
              {breaks.map((b: { id: string; break_start: string; break_end: string | null; duration_seconds: number }, i: number) => (
                <div key={b.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-lg bg-warning/8 flex items-center justify-center text-[10px] font-bold text-warning">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium tabular-nums font-mono">
                        {new Date(b.break_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        {" → "}
                        {b.break_end
                          ? new Date(b.break_end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : "ongoing"}
                      </p>
                    </div>
                  </div>
                  <Badge variant={b.break_end ? "secondary" : "outline"} className="text-[11px] font-mono tabular-nums">
                    {b.break_end ? formatDuration(b.duration_seconds) : "Active"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}