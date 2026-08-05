import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

export default function BrowserHistoryPage() {
  const { data: history, isLoading } = useQuery({
    queryKey: ["browser-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("browser_history")
        .select(`
          id,
          url,
          title,
          timestamp,
          duration_seconds,
          user_id,
          users (
            first_name,
            last_name,
            email
          )
        `)
        .order("timestamp", { ascending: false })
        .limit(200);
        
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Browser History</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Employee Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading history...</p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Website Title</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Time Visited</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {entry.users?.first_name} {entry.users?.last_name}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate" title={entry.title || ""}>
                        {entry.title || "Unknown"}
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground" title={entry.url}>
                        <a href={entry.url} target="_blank" rel="noreferrer" className="hover:underline">
                          {entry.url}
                        </a>
                      </TableCell>
                      <TableCell>
                        {format(new Date(entry.timestamp), "MMM d, yyyy h:mm a")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!history || history.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No browser history found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
