import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store';
import { Toast, PageLoading } from './components/common';
import { BottomNav } from './components/BottomNav';

// Pages (lazy-like via direct import)
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { GroupsPage } from './pages/GroupsPage';
import { GroupPage } from './pages/GroupPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { NotesPage } from './pages/NotesPage';
import { TasksPage } from './pages/TasksPage';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuthStore();
  if (loading) return <PageLoading />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <main className="main-content">{children}</main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const { init, loading } = useAuthStore();

  useEffect(() => {
    init();
  }, []);

  if (loading) return <PageLoading />;

  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        <Route path="/" element={
          <ProtectedRoute>
            <AppLayout>
              <GroupsPage />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/groups/:groupId" element={
          <ProtectedRoute>
            <AppLayout>
              <GroupPage />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/groups/:groupId/expenses" element={
          <ProtectedRoute>
            <AppLayout>
              <ExpensesPage />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/groups/:groupId/notes" element={
          <ProtectedRoute>
            <AppLayout>
              <NotesPage />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="/groups/:groupId/tasks" element={
          <ProtectedRoute>
            <AppLayout>
              <TasksPage />
            </AppLayout>
          </ProtectedRoute>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
