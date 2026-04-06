import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type UserRecord = {
  _id?: Id<"users">;
  name?: string;
  email?: string;
  role?: string;
};

function getRoleSelectClasses(role: string) {
  if (role === "admin") {
    return "border-blue-300 focus:border-blue-400 focus:ring-blue-100";
  }
  if (role === "pending") {
    return "border-amber-300 focus:border-amber-400 focus:ring-amber-100";
  }
  return "border-slate-300 focus:border-slate-400 focus:ring-slate-200";
}

export function UsersDirectory() {
  const users = useQuery(api.users.getAllUsers) as UserRecord[] | undefined;
  const updateRole = useMutation(api.users.updateUserRole);
  const [updatingUserId, setUpdatingUserId] = useState<Id<"users"> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const handleRoleChange = async (userId: Id<"users">, newRole: string) => {
    setUpdatingUserId(userId);
    setStatusMessage("");
    try {
      await updateRole({ userId, newRole });
      setStatusMessage("Role updated successfully");
      window.setTimeout(() => setStatusMessage(""), 2000);
    } catch (error) {
      console.error("Failed to update role:", error);
      setStatusMessage("Update failed. Please try again.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Users Directory</h2>
        <div className="flex items-center gap-2">
          {statusMessage && <span className="text-xs text-slate-500">{statusMessage}</span>}
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
            {users?.length ?? 0} users
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Name
              </th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Email
              </th>
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Role
              </th>
            </tr>
          </thead>
          <tbody>
            {!users && (
              <tr>
                <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-500 sm:px-4" colSpan={3}>
                  Loading users...
                </td>
              </tr>
            )}
            {users?.map((user) => (
              <tr key={user._id ?? `${user.email}-${user.name}`} className="hover:bg-slate-50">
                <td className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-800 sm:px-4 sm:text-sm">
                  {user.name ?? "Unknown"}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 text-xs text-slate-700 sm:px-4 sm:text-sm">
                  {user.email ?? "No email"}
                </td>
                <td className="border-b border-slate-100 px-3 py-2 sm:px-4">
                  {user._id ? (
                    <select
                      className={`w-full max-w-[180px] rounded-md border bg-white px-2.5 py-1.5 text-xs text-slate-700 shadow-sm outline-none transition focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm ${getRoleSelectClasses(
                        user.role ?? "pending"
                      )}`}
                      value={user.role ?? "pending"}
                      onChange={(e) => {
                        if (!user._id) return;
                        handleRoleChange(user._id, e.target.value);
                      }}
                      disabled={updatingUserId === user._id}
                    >
                      <option value="admin">Admin</option>
                      <option value="guest">Guest</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  ) : (
                    <span className="text-xs text-slate-500">No user id</span>
                  )}
                </td>
              </tr>
            ))}
            {users && users.length === 0 && (
              <tr>
                <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-500 sm:px-4" colSpan={3}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
