import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { ChevronDown, Loader, Plus, X } from "lucide-react";
import { api } from "../../convex/_generated/api";

/**
 * Driver data type from Convex
 */
type Driver = {
  _id: string;
  _creationTime: number;
  firstName: string;
  lastName: string;
  contactNumber?: string;
  licenseNumber?: string;
};

/**
 * Jeepney data type from Convex
 */
type Jeepney = {
  _id: string;
  _creationTime: number;
  plateNumber: string;
  status: string;
  activeDriverId?: string;
  driverName: string | null;
  activeDriver?: Driver | null;
};

type FleetTabType = "drivers" | "vehicles";

interface AddDriverFormData {
  firstName: string;
  lastName: string;
  contactNumber: string;
  licenseNumber: string;
}

const INITIAL_FORM_STATE: AddDriverFormData = {
  firstName: "",
  lastName: "",
  contactNumber: "",
  licenseNumber: "",
};

/**
 * FleetManagement Component
 *
 * Displays two tabs: Drivers and Vehicles
 * - Drivers Tab: Table of all drivers with ability to add new drivers
 * - Vehicles Tab: Table of all jeepneys with ability to assign drivers via dropdown
 */
export function FleetManagement() {
  const [activeTab, setActiveTab] = useState<FleetTabType>("drivers");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<AddDriverFormData>(INITIAL_FORM_STATE);
  const [formErrors, setFormErrors] = useState<Partial<AddDriverFormData>>({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch data from Convex
  const drivers = useQuery(api.drivers.getAll, {});
  const jeepneys = useQuery(api.jeepneys.getAll, {});

  // Mutations
  const createDriver = useMutation(api.drivers.createDriver);
  const assignDriver = useMutation(api.jeepneys.assignDriver);

  const [assigningJeepneyId, setAssigningJeepneyId] = useState<string | null>(null);

  /**
   * Validate add driver form
   */
  const validateForm = (): boolean => {
    const errors: Partial<AddDriverFormData> = {};

    if (!formData.firstName.trim()) {
      errors.firstName = "First name is required";
    }
    if (!formData.lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle add driver form submission
   */
  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await createDriver({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        contactNumber: formData.contactNumber.trim() || undefined,
        licenseNumber: formData.licenseNumber.trim() || undefined,
      });

      setFormData(INITIAL_FORM_STATE);
      setShowAddForm(false);
      setFormErrors({});
    } catch (error) {
      console.error("Failed to create driver:", error);
      alert("Failed to create driver. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle driver assignment for a vehicle
   */
  const handleAssignDriver = async (jeepneyId: string, driverId: string) => {
    setAssigningJeepneyId(jeepneyId);
    try {
      await assignDriver({
        jeepneyId: jeepneyId as any,
        driverId: driverId as any,
      });
    } catch (error) {
      console.error("Failed to assign driver:", error);
      alert("Failed to assign driver. Please try again.");
    } finally {
      setAssigningJeepneyId(null);
    }
  };

  /**
   * Update form field
   */
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (formErrors[name as keyof AddDriverFormData]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  return (
    <div className="w-full">
      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("drivers")}
          className={`px-4 py-3 font-medium transition border-b-2 ${
            activeTab === "drivers"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Drivers
        </button>
        <button
          onClick={() => setActiveTab("vehicles")}
          className={`px-4 py-3 font-medium transition border-b-2 ${
            activeTab === "vehicles"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Vehicles
        </button>
      </div>

      {/* DRIVERS TAB */}
      {activeTab === "drivers" && (
        <div className="space-y-4">
          {/* Add Driver Button */}
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-medium text-white hover:bg-blue-700 transition"
            >
              <Plus size={16} />
              Add Driver
            </button>
          </div>

          {/* Add Driver Form */}
          {showAddForm && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">New Driver</h3>
              <form onSubmit={handleAddDriver} className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      First Name *
                    </label>
                    <input
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleFormChange}
                      placeholder="John"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {formErrors.firstName && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.firstName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleFormChange}
                      placeholder="Doe"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {formErrors.lastName && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.lastName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Contact Number
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleFormChange}
                      placeholder="+63 9xx xxx xxxx"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      License Number
                    </label>
                    <input
                      type="text"
                      name="licenseNumber"
                      value={formData.licenseNumber}
                      onChange={handleFormChange}
                      placeholder="DL12345678"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setFormData(INITIAL_FORM_STATE);
                      setFormErrors({});
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting && <Loader size={14} className="animate-spin" />}
                    {submitting ? "Creating..." : "Create Driver"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Drivers Table */}
          {drivers === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-slate-600">Loading drivers...</span>
            </div>
          ) : drivers && drivers.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Contact</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">License</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver: Driver) => (
                    <tr key={driver._id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {driver.firstName} {driver.lastName}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {driver.contactNumber || <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {driver.licenseNumber || <span className="text-slate-400">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">No drivers found. Click "Add Driver" to create one.</p>
            </div>
          )}
        </div>
      )}

      {/* VEHICLES TAB */}
      {activeTab === "vehicles" && (
        <div>
          {jeepneys === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} className="animate-spin text-blue-600 mr-2" />
              <span className="text-sm text-slate-600">Loading vehicles...</span>
            </div>
          ) : jeepneys && jeepneys.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Plate Number</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Assigned Driver</th>
                  </tr>
                </thead>
                <tbody>
                  {jeepneys.map((jeepney: Jeepney) => (
                    <tr key={jeepney._id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-4 py-3 font-medium text-slate-900">{jeepney.plateNumber}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            jeepney.status === "active"
                              ? "bg-emerald-100 text-emerald-700"
                              : jeepney.status === "idle"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {jeepney.status.charAt(0).toUpperCase() + jeepney.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative inline-block w-full max-w-xs">
                          <select
                            value={jeepney.activeDriverId || ""}
                            onChange={(e) => {
                              if (e.target.value) {
                                handleAssignDriver(jeepney._id, e.target.value);
                              }
                            }}
                            disabled={assigningJeepneyId === jeepney._id}
                            className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2 pr-8 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            <option value="">
                              {assigningJeepneyId === jeepney._id ? "Assigning..." : "No driver"}
                            </option>
                            {drivers &&
                              drivers.map((driver: Driver) => (
                                <option key={driver._id} value={driver._id}>
                                  {driver.firstName} {driver.lastName}
                                </option>
                              ))}
                          </select>
                          <ChevronDown
                            size={16}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <p className="text-sm text-slate-600">No vehicles found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
