import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarCheck } from "lucide-react";

const AttendancePage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-heading">Attendance</h1>
        <p className="page-subheading">Your monthly attendance records</p>
      </div>
      <Card className="card-premium">
        <CardHeader>
          <CardTitle className="text-sm font-display font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
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
