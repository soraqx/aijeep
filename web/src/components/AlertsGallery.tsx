import { useState } from "react";
import { useMutation } from "convex/react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "../../convex/_generated/api";

type Alert = {
  _id: string;
  _creationTime: number;
  jeepneyId: string;
  alertType: string;
  timestamp: number;
  isResolved: boolean;
  imageUrl?: string | null;
  snapshotUrl?: string | null;
  jeepneyInfo?: {
    plateNumber: string;
    driverName: string | null; // <-- This is the fix
    status: string;
  } | null;
};

type AlertsGalleryProps = {
  alerts: Alert[];
  isLoading?: boolean;
  onAlertResolved?: () => void;
};

export function AlertsGallery({ alerts, isLoading = false, onAlertResolved }: AlertsGalleryProps) {
  const resolveAlert = useMutation(api.alerts.resolveAlert);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const handleResolve = async (alertId: string) => {
    setResolvingId(alertId);
    try {
      await resolveAlert({ alertId: alertId as any });
      if (onAlertResolved) {
        onAlertResolved();
      }
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    } finally {
      setResolvingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 border-2 border-amber-200 rounded-full border-t-transparent border-l-transparent border-b-amber-500 border-r-amber-500 animate-spin"></div>
          <span className="text-sm text-slate-500">Loading gallery...</span>
        </div>
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <p className="text-center text-sm text-slate-500 py-8">
        No snapshots available for this vehicle
      </p>
    );
  }

  return (
    <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden pr-2 scrollbar-thin scrollbar-thumb-slate-300">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 pb-4">
        {alerts.map((alert) => (
          <div key={alert._id} className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
            {alert.snapshotUrl ? (
              <div className="aspect-video w-full overflow-hidden bg-slate-100">
                <img
                  src={alert.snapshotUrl}
                  alt="incident snapshot"
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center bg-slate-100">
                <p className="text-xs text-slate-400">No snapshot available</p>
              </div>
            )}
            <div className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${alert.alertType === "DROWSY"
                  ? "bg-red-100 text-red-700"
                  : alert.alertType === "HARSH_BRAKING"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-slate-100 text-slate-700"
                  }`}>
                  {alert.alertType === "DROWSY" ? "DROWSY" : alert.alertType === "HARSH_BRAKING" ? "HARSH BRAKING" : alert.alertType}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${alert.isResolved
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
                  }`}>
                  {alert.isResolved ? "Resolved" : "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-500">{new Date(alert.timestamp).toLocaleString()}</p>
              <div className="mt-3 pt-3 border-t border-slate-100">
                {alert.isResolved ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-slate-400 text-sm font-medium">
                    <CheckCircle2 size={16} />
                    Resolved
                  </div>
                ) : resolvingId === alert._id ? (
                  <div className="flex items-center justify-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-700 text-sm font-medium">
                    <Loader2 size={16} className="animate-spin" />
                    Resolving...
                  </div>
                ) : (
                  <button
                    onClick={() => handleResolve(alert._id)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    Resolve
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}