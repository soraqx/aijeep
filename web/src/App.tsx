import { Suspense, lazy } from "react";
import { Navigate, Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/clerk-react";

const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const UnauthorizedPage = lazy(() =>
  import("./pages/UnauthorizedPage").then((module) => ({ default: module.UnauthorizedPage }))
);

type ProtectedRouteProps = {
  children: React.ReactNode;
};

function LandingPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <div className="mb-4 flex items-center justify-end gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                Sign In
              </button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>
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
  const { isLoaded, isSignedIn } = useUser();
  const role = useQuery(
    api.users.getCurrentUserRole,
    isSignedIn ? {} : "skip"
  );

  if (!isLoaded) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Checking authentication...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (role === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Checking access role...</p>
      </main>
    );
  }

  if (role !== "operator") {
    return <Navigate to="/unauthorized" replace />;
  }

  return (
    <>{children}</>
  );
}

export default function App() {
  const routeLoadingFallback = (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-600">Loading page...</p>
    </main>
  );

  return (
    <Router>
      <Suspense fallback={routeLoadingFallback}>
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
      </Suspense>
    </Router>
  );
}
