import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, PlayCircle, StopCircle } from "lucide-react";

const TimesheetPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">My Timesheet</h1>
        <div className="flex gap-2">
          <Button className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Clock In
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            <StopCircle className="h-4 w-4" />
            Clock Out
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
          <p className="text-sm text-muted-foreground">No sessions recorded today. Clock in to start tracking your time.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimesheetPage;
