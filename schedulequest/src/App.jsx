import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import NavBar from "./components/NavBar";
import AuthPage from "./pages/AuthPage";
import TodayPage from "./pages/TodayPage";
import TasksPage from "./pages/TasksPage";
import RewardsPage from "./pages/RewardsPage";
import StatsPage from "./pages/StatsPage";
import SettingsPage from "./pages/SettingsPage";
import { useAppStore } from "./store/AppStore";

function ProtectedRoute({ children }) {
  const { activeUser, loading } = useAppStore();
  if (loading) {
    return <div className="page loading">Loading ScheduleQuest...</div>;
  }
  if (!activeUser) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

function AppFrame({ children }) {
  const { error, notice, clearMessages, userState } = useAppStore();
  const location = useLocation();
  useEffect(() => {
    const theme = userState?.settings?.theme === "light" ? "light" : "dark";
    document.body.dataset.theme = theme;
  }, [userState?.settings?.theme]);

  return (
    <div className="app-frame" key={location.pathname}>
      <NavBar />
      {(error || notice) ? (
        <section className="flash-row" onClick={clearMessages} role="status" aria-live="polite">
          {error ? <p className="flash flash-error">{error}</p> : null}
          {notice ? <p className="flash flash-notice">{notice}</p> : null}
        </section>
      ) : null}
      <main>{children}</main>
    </div>
  );
}

export default function App() {
  const { activeUser } = useAppStore();

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/today" element={<ProtectedRoute><AppFrame><TodayPage /></AppFrame></ProtectedRoute>} />
      <Route path="/tasks" element={<ProtectedRoute><AppFrame><TasksPage /></AppFrame></ProtectedRoute>} />
      <Route path="/rewards" element={<ProtectedRoute><AppFrame><RewardsPage /></AppFrame></ProtectedRoute>} />
      <Route path="/stats" element={<ProtectedRoute><AppFrame><StatsPage /></AppFrame></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><AppFrame><SettingsPage /></AppFrame></ProtectedRoute>} />
      <Route path="*" element={<Navigate to={activeUser ? "/today" : "/auth"} replace />} />
    </Routes>
  );
}
