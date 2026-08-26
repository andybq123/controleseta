import { Navigate, Route, BrowserRouter, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/Login";
import { DashboardPage } from "./pages/Dashboard";
import { SettingsPage } from "./pages/Settings";
import { KeywordsPage } from "./pages/Keywords";
import { HistoryPage } from "./pages/History";
import { LogsPage } from "./pages/Logs";

function PrivateArea() {
  const { username, loading } = useAuth();

  if (loading) return <p className="p-6 text-slate-400">Carregando...</p>;
  if (!username) return <Navigate to="/login" replace />;

  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<PrivateArea />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/palavras-chave" element={<KeywordsPage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="/historico" element={<HistoryPage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
