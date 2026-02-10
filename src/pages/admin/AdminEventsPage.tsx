import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Activity, ChevronDown, ChevronRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminApi } from "@/lib/admin-api";

interface EventRow {
  id: string;
  timestamp: string;
  type: string;
  device_id: string | null;
  metadata: unknown;
  user_email: string;
}

const typeBadgeVariant: Record<string, string> = {
  LOGIN: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  LOGOUT: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  ACTIVITY: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  IDLE_START: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  IDLE_END: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  MANUAL_CLOCK_IN: "bg-teal-500/15 text-teal-700 dark:text-teal-400",
  MANUAL_CLOCK_OUT: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
};

function MetadataCell({ metadata }: { metadata: unknown }) {
  const [open, setOpen] = useState(false);
  if (!metadata || (typeof metadata === "object" && Object.keys(metadata as object).length === 0)) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1">
          {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {open ? "Hide" : "Show"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <pre className="text-xs bg-muted p-2 rounded mt-1 max-w-xs overflow-auto">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}

const AdminEventsPage = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getEvents();
      setEvents(data.events || []);
    } catch (err) {
      console.error("Failed to fetch events:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Events Log</h1>
        <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Latest 100 Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events recorded yet.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Metadata</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs whitespace-nowrap font-mono">
                        {new Date(e.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm">{e.user_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={typeBadgeVariant[e.type] || ""}>
                          {e.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {e.device_id || "—"}
                      </TableCell>
                      <TableCell>
                        <MetadataCell metadata={e.metadata} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminEventsPage;
