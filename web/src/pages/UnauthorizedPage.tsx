import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUser } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export function UnauthorizedPage() {
  const { isSignedIn, isLoaded } = useUser();
  const role = useQuery(api.users.getCurrentUserRole);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isLoaded || !mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <p className="text-sm text-slate-600">Checking access...</p>
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <h1 className="text-2xl font-bold text-rose-700 sm:text-3xl">Access Denied</h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Please sign in to access the dashboard.
          </p>
        </section>
      </main>
    );
  }

  if (role === "pending") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <section className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-6 text-center shadow-sm sm:p-10">
          <h1 className="text-2xl font-bold text-amber-700 sm:text-3xl">Access Pending</h1>
          <p className="mt-3 text-sm text-slate-700 sm:text-base">
            Your account is pending operator approval. You cannot view the dashboard until an admin approves your access.
          </p>
          <a
            href="mailto:admin@ai-jeep.local?subject=AI-JEEP%20Access%20Request"
            className="mt-6 inline-flex items-center justify-center rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-700 sm:text-base"
          >
            Contact Admin
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <section className="w-full max-w-xl rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-rose-700 sm:text-3xl">Access Denied</h1>
        <p className="mt-3 text-sm text-slate-700 sm:text-base">
          You do not have permission to view this dashboard.
        </p>
      </section>
    </main>
  );
}
