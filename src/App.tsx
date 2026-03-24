import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import Dashboard from "@/pages/Dashboard";
import TimesheetPage from "@/pages/TimesheetPage";
import AttendancePage from "@/pages/AttendancePage";
import TeamPage from "@/pages/TeamPage";
import AdminPage from "@/pages/AdminPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminTeamsPage from "@/pages/admin/AdminTeamsPage";

import AdminScreenshotsPage from "@/pages/admin/AdminScreenshotsPage";
import EmployeeDashboardPage from "@/pages/EmployeeDashboardPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
            <Route path="/employee" element={<ProtectedPage><EmployeeDashboardPage /></ProtectedPage>} />
            <Route path="/timesheet" element={<ProtectedPage><TimesheetPage /></ProtectedPage>} />
            <Route path="/attendance" element={<ProtectedPage><AttendancePage /></ProtectedPage>} />
            <Route path="/team" element={<ProtectedPage><TeamPage /></ProtectedPage>} />
            <Route path="/admin" element={<ProtectedPage><AdminPage /></ProtectedPage>} />
            <Route path="/admin/users" element={<ProtectedPage><AdminUsersPage /></ProtectedPage>} />
            <Route path="/admin/teams" element={<ProtectedPage><AdminTeamsPage /></ProtectedPage>} />
            <Route path="/admin/events" element={<ProtectedPage><AdminEventsPage /></ProtectedPage>} />
            <Route path="/admin/screenshots" element={<ProtectedPage><AdminScreenshotsPage /></ProtectedPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
