import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users } from "lucide-react";

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  team_id: string | null;
}

const TeamPage = () => {
  const { user } = useAuth();

  const { data: usersData, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminApi.getUsers,
    enabled: !!user,
  });

  const allUsers: User[] = usersData?.users ?? [];

  // Show team members based on current user's team
  const teamMembers = user?.team_id
    ? allUsers.filter((u) => u.team_id === user.team_id)
    : [];

  const roleBadge = (r: string) => {
    const cls: Record<string, string> = {
      ADMIN: "bg-destructive/15 text-destructive border-destructive/30",
      MANAGER: "bg-info/15 text-info border-info/30",
      EMPLOYEE: "bg-primary/15 text-primary border-primary/30",
    };
    return <Badge className={cls[r] || ""} variant="outline">{r}</Badge>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Team</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Team Members
            {teamMembers.length > 0 && (
              <Badge variant="secondary" className="ml-2">{teamMembers.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !user?.team_id ? (
            <p className="text-sm text-muted-foreground">You are not assigned to a team yet.</p>
          ) : teamMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {m.first_name} {m.last_name}
                      {m.id === user?.id && (
                        <span className="text-xs text-muted-foreground ml-2">(you)</span>
                      )}
                    </TableCell>
                    <TableCell>{m.email}</TableCell>
                    <TableCell>{roleBadge(m.role)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TeamPage;
