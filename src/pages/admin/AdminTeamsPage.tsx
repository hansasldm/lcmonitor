import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "@/lib/admin-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Team {
  id: string;
  name: string;
  manager_id: string | null;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export default function AdminTeamsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<Team | null>(null);
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");

  const { data: teamsData, isLoading } = useQuery({
    queryKey: ["admin-teams"],
    queryFn: adminApi.getTeams,
  });

  const { data: usersData } = useQuery({
    queryKey: ["admin-users"],
    queryFn: adminApi.getUsers,
  });

  const teams: Team[] = teamsData?.teams ?? [];
  const managers: User[] = (usersData?.users ?? []).filter(
    (u: User) => u.role === "MANAGER" || u.role === "ADMIN"
  );

  const createMut = useMutation({
    mutationFn: adminApi.createTeam,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-teams"] });
      setOpen(false);
      toast({ title: "Team created" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; manager_id?: string | null }) =>
      adminApi.updateTeam(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-teams"] });
      setOpen(false);
      setEditTeam(null);
      toast({ title: "Team updated" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => {
    setEditTeam(null);
    setName("");
    setManagerId("");
    setOpen(true);
  };

  const openEdit = (t: Team) => {
    setEditTeam(t);
    setName(t.name);
    setManagerId(t.manager_id ?? "");
    setOpen(true);
  };

  const handleSubmit = () => {
    if (editTeam) {
      updateMut.mutate({ id: editTeam.id, name, manager_id: managerId || null });
    } else {
      createMut.mutate({ name, manager_id: managerId || null });
    }
  };

  const managerName = (mid: string | null) => {
    if (!mid) return "—";
    const m = managers.find((u) => u.id === mid);
    return m ? `${m.first_name} ${m.last_name}` : "—";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-display font-bold">Team Management</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditTeam(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" /> New Team
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>{editTeam ? "Edit Team" : "Create Team"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Team Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Manager</Label>
                <Select value={managerId} onValueChange={(v) => setManagerId(v === "_none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">No manager</SelectItem>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.first_name} {m.last_name} ({m.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending} className="w-full">
                {editTeam ? "Save Changes" : "Create Team"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">All Teams</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Manager</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teams.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{managerName(t.manager_id)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {teams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">No teams yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
