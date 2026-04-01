import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

type UserRecord = {
  _id?: string;
  name?: string;
  email?: string;
  role?: string;
};

export function UsersDirectory() {
  const users = useQuery(api.users.getAllUsers) as UserRecord[] | undefined;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Users Directory</h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          {users?.length ?? 0} users
        </span>
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
                  <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {user.role ?? "unknown"}
                  </span>
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
