import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workSessionsApi } from "@/lib/work-sessions-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, PlayCircle, StopCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const TimesheetPage = () => {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["work-session-status"],
    queryFn: workSessionsApi.getStatus,
  });

  const session = data?.session ?? null;
  const isWorking = data?.is_working ?? false;
  const sessionDone = session && session.end_time;

  const clockInMut = useMutation({
    mutationFn: workSessionsApi.clockIn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-session-status"] });
      toast({ title: "✅ Clocked In", description: "Your work session has started. Have a productive day!" });
    },
    onError: (e: Error) => toast({ title: "Clock In Failed", description: e.message, variant: "destructive" }),
  });

  const clockOutMut = useMutation({
    mutationFn: workSessionsApi.clockOut,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["work-session-status"] });
      const secs = res?.session?.total_active_seconds ?? 0;
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      toast({ title: "✅ Clocked Out", description: `Session ended. You worked ${h}h ${m}m today.` });
    },
    onError: (e: Error) => toast({ title: "Clock Out Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">My Timesheet</h1>
        <div className="flex gap-2">
          <Button
            className="gap-2"
            onClick={() => clockInMut.mutate()}
            disabled={isWorking || !!sessionDone || clockInMut.isPending || isLoading}
          >
            <PlayCircle className="h-4 w-4" />
            {clockInMut.isPending ? "Clocking in…" : "Clock In"}
          </Button>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => clockOutMut.mutate()}
            disabled={!isWorking || clockOutMut.isPending}
          >
            <StopCircle className="h-4 w-4" />
            {clockOutMut.isPending ? "Clocking out…" : "Clock Out"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Today's Sessions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !session ? (
            <p className="text-sm text-muted-foreground">No sessions recorded today. Clock in to start tracking your time.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Started</span>
                <span className="font-medium">{new Date(session.start_time).toLocaleTimeString()}</span>
              </div>
              {session.end_time && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ended</span>
                  <span className="font-medium">{new Date(session.end_time).toLocaleTimeString()}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={`font-medium ${isWorking ? "text-success" : "text-muted-foreground"}`}>
                  {isWorking ? "● Working" : "Completed"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimesheetPage;
