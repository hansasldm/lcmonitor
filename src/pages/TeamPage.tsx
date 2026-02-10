import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

const TeamPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamPage;
