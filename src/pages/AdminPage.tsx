import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings } from "lucide-react";

const AdminPage = () => {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold">Admin Panel</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">User management coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPage;
