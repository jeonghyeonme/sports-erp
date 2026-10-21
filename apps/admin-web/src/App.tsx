import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { ToastProvider } from './components/ToastProvider';
import { SlowRequestNotice } from './components/SlowRequestNotice';
import { useAuth } from './lib/use-auth';
import { AppLayout } from './layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { BranchDetailPage } from './pages/BranchDetailPage';
import { MembersPage } from './pages/MembersPage';
import { MemberDetailPage } from './pages/MemberDetailPage';
import { StaffDetailPage } from './pages/StaffDetailPage';
import { StaffPage } from './pages/StaffPage';
import { AttendanceEntry } from './pages/AttendanceEntry';
import { ProgramsPage } from './pages/ProgramsPage';
import { InstructorsPage } from './pages/InstructorsPage';
import { BoardPage } from './pages/BoardPage';
import { PostDetailPage } from './pages/PostDetailPage';
import { FacilitiesPage } from './pages/FacilitiesPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { AssetsPage } from './pages/AssetsPage';
import { DocumentsPage } from './pages/DocumentsPage';
import { PermissionsPage } from './pages/PermissionsPage';
import { SupportRequestsPage } from './pages/SupportRequestsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';

// D61 — 쓰기가 성공하면 처리 대기 건수(배지·대시보드 카드)를 다시 받는다. 승인·처리한 화면에 머물러도 배지가 줄어든다.
const queryClient: QueryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  }),
});

function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <SlowRequestNotice />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/branches/:branchId" element={<BranchDetailPage />} />
                  <Route path="/members" element={<MembersPage />} />
                  <Route path="/members/:id" element={<MemberDetailPage />} />
                  <Route path="/staff" element={<StaffPage />} />
                  <Route path="/staff/:id" element={<StaffDetailPage />} />
                  <Route path="/attendance" element={<AttendanceEntry />} />
                  <Route path="/programs" element={<ProgramsPage />} />
                  <Route path="/instructors" element={<InstructorsPage />} />
                  <Route path="/board" element={<BoardPage />} />
                  <Route path="/board/:id" element={<PostDetailPage />} />
                  <Route path="/facilities" element={<FacilitiesPage />} />
                  <Route path="/reservations" element={<ReservationsPage />} />
                  <Route path="/assets" element={<AssetsPage />} />
                  <Route path="/documents" element={<DocumentsPage />} />
                  <Route path="/permissions" element={<PermissionsPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/support-requests" element={<SupportRequestsPage />} />
                </Route>
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
