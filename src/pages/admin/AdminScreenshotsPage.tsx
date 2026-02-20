import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Camera, X } from "lucide-react";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ScreenshotRecord {
  id: string;
  user_id: string;
  storage_path: string;
  taken_at: string;
  is_blurred: boolean;
  session_id: string | null;
  signed_url: string | null;
  user: { email: string; first_name: string; last_name: string } | null;
}

export default function AdminScreenshotsPage() {
  const [selectedUserId, setSelectedUserId] = useState<string>("_all");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [viewScreenshot, setViewScreenshot] = useState<ScreenshotRecord | null>(null);

  const { data: usersData } = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminApi.getUsers,
  });

  const users = usersData?.users ?? [];
  const dateStr = selectedDate ? format(selectedDate, "yyyy-MM-dd") : undefined;

  const { data: screenshotsData, isLoading } = useQuery({
    queryKey: ["admin-screenshots", selectedUserId, dateStr],
    queryFn: () =>
      adminApi.getScreenshots({
        user_id: selectedUserId !== "_all" ? selectedUserId : undefined,
        date: dateStr,
      }),
    enabled: !!dateStr,
  });

  const screenshots: ScreenshotRecord[] = screenshotsData?.screenshots ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Screenshots</h1>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 min-w-[200px]">
            <label className="text-sm font-medium text-muted-foreground">User</label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="All users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">All Users</SelectItem>
                {users.map((u: { id: string; first_name: string; last_name: string; email: string }) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[200px] justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      {/* Thumbnails Grid */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading screenshots…</p>
          ) : screenshots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No screenshots found for the selected filters.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {screenshots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setViewScreenshot(s)}
                  className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-muted hover:ring-2 hover:ring-primary transition-all cursor-pointer"
                >
                  {s.signed_url ? (
                    <img
                      src={s.signed_url}
                      alt={`Screenshot ${s.taken_at}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No preview
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">
                      {s.user ? `${s.user.first_name} ${s.user.last_name}` : "Unknown"}
                    </p>
                    <p className="text-[10px] text-white/70">
                      {format(new Date(s.taken_at), "HH:mm:ss")}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Image Modal */}
      <Dialog open={!!viewScreenshot} onOpenChange={(open) => !open && setViewScreenshot(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Screenshot Details</span>
            </DialogTitle>
          </DialogHeader>
          {viewScreenshot && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>
                  <strong className="text-foreground">User:</strong>{" "}
                  {viewScreenshot.user
                    ? `${viewScreenshot.user.first_name} ${viewScreenshot.user.last_name} (${viewScreenshot.user.email})`
                    : "Unknown"}
                </span>
                <span>
                  <strong className="text-foreground">Taken at:</strong>{" "}
                  {format(new Date(viewScreenshot.taken_at), "PPP p")}
                </span>
              </div>
              {viewScreenshot.signed_url ? (
                <img
                  src={viewScreenshot.signed_url}
                  alt="Full screenshot"
                  className="w-full rounded-lg border border-border"
                />
              ) : (
                <p className="text-sm text-muted-foreground">Image URL expired. Please refresh.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
