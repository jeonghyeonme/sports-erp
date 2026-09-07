import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth-context';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BranchDetailPage } from './pages/BranchDetailPage';
import { MembersPage } from './pages/MembersPage';
import { StaffPage } from './pages/StaffPage';
import { ProgramsPage } from './pages/ProgramsPage';
import { BoardPage } from './pages/BoardPage';
import { FacilitiesPage } from './pages/FacilitiesPage';
import { PermissionsPage } from './pages/PermissionsPage';

const queryClient = new QueryClient();

function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/branches/:branchId" element={<BranchDetailPage />} />
                <Route path="/members" element={<MembersPage />} />
                <Route path="/staff" element={<StaffPage />} />
                <Route path="/programs" element={<ProgramsPage />} />
                <Route path="/board" element={<BoardPage />} />
                <Route path="/facilities" element={<FacilitiesPage />} />
                <Route path="/permissions" element={<PermissionsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
