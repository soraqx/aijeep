import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Edit, Trash2, X, Loader } from "lucide-react";

type UserRecord = {
  _id?: Id<"users">;
  name?: string;
  firstName?: string;
  lastName?: string;
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
  const currentUser = useQuery(api.users.getCurrentUser) as UserRecord | undefined;
  const updateRole = useMutation(api.users.updateUserRole);
  const deleteUserMutation = useMutation(api.users.deleteUser);

  const [updatingUserId, setUpdatingUserId] = useState<Id<"users"> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Edit role modal state
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editingRole, setEditingRole] = useState<string>("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation state
  const [deletingUserId, setDeletingUserId] = useState<Id<"users"> | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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

  /**
   * Open edit role modal
   */
  const handleEditRole = (user: UserRecord) => {
    setEditingUser(user);
    setEditingRole(user.role || "pending");
  };

  /**
   * Close edit role modal
   */
  const handleCloseEditModal = () => {
    setEditingUser(null);
    setEditingRole("");
  };

  /**
   * Submit role change from modal
   */
  const handleEditRoleSubmit = async () => {
    if (!editingUser || !editingUser._id) return;

    setEditSubmitting(true);
    setStatusMessage("");
    try {
      await updateRole({ userId: editingUser._id, newRole: editingRole });
      setStatusMessage("Role updated successfully");
      handleCloseEditModal();
      window.setTimeout(() => setStatusMessage(""), 2000);
    } catch (error) {
      console.error("Failed to update role:", error);
      setStatusMessage("Update failed. Please try again.");
    } finally {
      setEditSubmitting(false);
    }
  };

  /**
   * Confirm deletion
   */
  const handleConfirmDelete = (userId: Id<"users">) => {
    // Prevent deleting current user
    if (currentUser?._id === userId) {
      alert("You cannot delete your own account");
      return;
    }

    setDeletingUserId(userId);
  };

  /**
   * Execute user deletion
   */
  const handleDeleteUser = async () => {
    if (!deletingUserId) return;

    setDeleteSubmitting(true);
    setStatusMessage("");
    try {
      await deleteUserMutation({ userId: deletingUserId! });
      setStatusMessage("User deleted successfully");
      setDeletingUserId(null);
      window.setTimeout(() => setStatusMessage(""), 2000);
    } catch (error) {
      console.error("Failed to delete user:", error);
      setStatusMessage("Delete failed. Please try again.");
      setDeletingUserId(null);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  /**
   * Cancel deletion
   */
  const handleCancelDelete = () => {
    setDeletingUserId(null);
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
              <th className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 sm:px-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {!users && (
              <tr>
                <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-500 sm:px-4" colSpan={4}>
                  Loading users...
                </td>
              </tr>
            )}
            {users?.map((user) => (
              <tr key={user._id ?? `${user.email}-${user.firstName}`} className="hover:bg-slate-50">
                <td className="border-b border-slate-100 px-3 py-2 text-xs font-medium text-slate-800 sm:px-4 sm:text-sm">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.firstName || user.lastName || "Unknown"}
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
                <td className="border-b border-slate-100 px-3 py-2 sm:px-4">
                  {user._id && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditRole(user)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Edit user role"
                      >
                        <Edit size={14} />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button
                        onClick={() => handleConfirmDelete(user._id!)}
                        disabled={currentUser?._id === user._id}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        title={currentUser?._id === user._id ? "Cannot delete yourself" : "Delete user"}
                      >
                        <Trash2 size={14} />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {users && users.length === 0 && (
              <tr>
                <td className="border-b border-slate-100 px-3 py-3 text-sm text-slate-500 sm:px-4" colSpan={4}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* EDIT ROLE MODAL */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Edit User Role</h2>
              <button
                onClick={handleCloseEditModal}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">
                  {editingUser.firstName && editingUser.lastName
                    ? `${editingUser.firstName} ${editingUser.lastName}`
                    : editingUser.email || "User"}
                </p>
                <p className="text-xs text-slate-500 mb-3">{editingUser.email}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-2">
                  New Role
                </label>
                <select
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value)}
                  className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 ${getRoleSelectClasses(
                    editingRole
                  )}`}
                >
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                  <option value="pending">Pending Approval</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={handleCloseEditModal}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditRoleSubmit}
                  disabled={editSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSubmitting && <Loader size={14} className="animate-spin" />}
                  {editSubmitting ? "Saving..." : "Save Role"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Confirm Delete</h2>
              <button
                onClick={handleCancelDelete}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 p-6">
              <p className="text-sm text-slate-600">
                Are you sure you want to remove this user entirely? This action cannot be undone.
              </p>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  onClick={handleCancelDelete}
                  disabled={deleteSubmitting}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  disabled={deleteSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleteSubmitting && <Loader size={14} className="animate-spin" />}
                  {deleteSubmitting ? "Deleting..." : "Delete User"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
