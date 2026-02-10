import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";

const AttendancePage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Attendance</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No attendance records yet.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendancePage;
