import { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { useAuth } from './lib/use-auth';
import { MobileLayout } from './layout/MobileLayout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';
import { ProgramsPage } from './pages/ProgramsPage';
import { ProgramSlotsPage } from './pages/ProgramSlotsPage';
import { PaymentPage } from './pages/PaymentPage';
import { MyReservationsPage } from './pages/MyReservationsPage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth();
  if (isRestoring) return <div className="splash">불러오는 중…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// D41 — 같은 Worker의 /m/ 아래에서 서빙되므로 라우터 basename을 /m/으로 둔다(vite base와 맞춘다).
// 끝 슬래시가 없으면 홈 이동이 /m이 되고, 그 주소를 새로고침하면 vite 개발 서버는 404, Worker는 /m/* 규칙 밖이라 관리자 웹으로 간다(log/083).
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/m/">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <RequireAuth>
                <MobileLayout />
              </RequireAuth>
            }
          >
            <Route index element={<HomePage />} />
            <Route path="programs" element={<ProgramsPage />} />
            <Route path="programs/:programId" element={<ProgramSlotsPage />} />
            <Route path="pay/:reservationId" element={<PaymentPage />} />
            <Route path="reservations" element={<MyReservationsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
