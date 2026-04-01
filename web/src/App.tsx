import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { DashboardPage } from "./pages/DashboardPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">AI-JEEP</h1>
        <p className="mt-2 text-sm text-slate-600 sm:text-base">
          Operator access portal. Continue to the protected dashboard.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 sm:text-base"
        >
          Go to Dashboard
        </a>
      </div>
    </main>
  );
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const role = useQuery(api.users.getCurrentUserRole);

  if (role !== "operator") {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <>{children}</>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
