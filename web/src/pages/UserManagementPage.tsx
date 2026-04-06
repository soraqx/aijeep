import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { UserButton } from "@clerk/clerk-react";
import { useState } from "react";

export function UserManagementPage() {
  const users = useQuery(api.users.getAllUsers);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const [updating, setUpdating] = useState<string | null>(null);

  const pendingUsers = users?.filter((u) => u.role === "pending") ?? [];
  const activeAdmins = users?.filter((u) => u.role === "admin") ?? [];

  const handleApprove = async (userId: string) => {
    setUpdating(userId);
    try {
      // @ts-expect-error - Convex handles Id type coercion at runtime
      await updateUserRole({ userId, newRole: "admin" });
    } catch (error) {
      console.error("Failed to approve user:", error);
    } finally {
      setUpdating(null);
    }
  };

  if (!users) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading users...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
            <p className="text-sm text-slate-600">Manage operator access</p>
          </div>
          <UserButton afterSignOutUrl="/" />
        </header>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Pending Approvals
          </h2>
          {pendingUsers.length === 0 ? (
            <p className="text-sm text-slate-500">No pending users</p>
          ) : (
            <div className="space-y-2">
              {pendingUsers.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleApprove(user._id)}
                    disabled={updating === user._id}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    {updating === user._id ? "Approving..." : "Approve"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Active Admins
          </h2>
          {activeAdmins.length === 0 ? (
            <p className="text-sm text-slate-500">No admins found</p>
          ) : (
            <div className="space-y-2">
              {activeAdmins.map((user) => (
                <div
                  key={user._id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
                >
                  <div>
                    <p className="font-medium text-slate-900">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                  </div>
                  <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                    Admin
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}