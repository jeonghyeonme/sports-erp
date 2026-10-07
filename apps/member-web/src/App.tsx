import { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './lib/auth-context';
import { useAuth } from './lib/use-auth';
import { MobileLayout } from './layout/MobileLayout';
import { LoginPage } from './pages/LoginPage';
import { HomePage } from './pages/HomePage';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isRestoring } = useAuth();
  if (isRestoring) return <div className="splash">불러오는 중…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// D41 — 같은 Worker의 /m/ 아래에서 서빙되므로 라우터 basename을 /m으로 둔다(vite base와 맞춘다).
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/m">
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
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
