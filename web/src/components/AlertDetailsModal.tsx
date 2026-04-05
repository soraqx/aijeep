import React from "react";
import { Clock, AlertTriangle, Zap, X, Loader, CheckCircle2, AlertCircle } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface AlertDetails {
    _id: Id<"alerts">;
    jeepneyId: Id<"jeepneys">;
    alertType: string;
    timestamp: number;
    confidenceScore?: number;
    snapshotFilename?: string;
    imageUrl?: string | null;
    isResolved: boolean;
    jeepneyInfo?: {
        plateNumber: string;
        driverName: string;
        status: string;
    } | null;
}

interface AlertDetailsModalProps {
    alert: AlertDetails | null;
    isOpen: boolean;
    isLoading?: boolean;
    onClose: () => void;
}

/**
 * AlertDetailsModal displays comprehensive alert information in a modal overlay.
 * Shows the snapshot image, full metadata, driver/vehicle info, and resolve button.
 */
export const AlertDetailsModal: React.FC<AlertDetailsModalProps> = ({
    alert,
    isOpen,
    isLoading = false,
    onClose,
}) => {
    const resolveAlertMutation = useMutation(api.alerts.resolveAlert);
    const [isResolving, setIsResolving] = React.useState(false);

    if (!isOpen || !alert) return null;

    const handleResolve = async () => {
        try {
            setIsResolving(true);
            await resolveAlertMutation({ alertId: alert._id });
            setTimeout(() => {
                onClose();
                setIsResolving(false);
            }, 500);
        } catch (error) {
            console.error("Failed to resolve alert:", error);
            setIsResolving(false);
        }
    };

    const getAlertColor = (alertType: string) => {
        switch (alertType) {
            case "DROWSY":
                return { bg: "bg-amber-100", border: "border-amber-300", text: "text-amber-900" };
            case "HARSH_BRAKING":
                return { bg: "bg-red-100", border: "border-red-300", text: "text-red-900" };
            default:
                return { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-900" };
        }
    };

    const getAlertIcon = (alertType: string) => {
        switch (alertType) {
            case "DROWSY":
                return <AlertTriangle size={20} className="text-amber-600" />;
            case "HARSH_BRAKING":
                return <Zap size={20} className="text-red-600" />;
            default:
                return <AlertCircle size={20} className="text-slate-600" />;
        }
    };

    const colors = getAlertColor(alert.alertType);
    const alertDate = new Date(alert.timestamp * 1000);
    const confidence = alert.confidenceScore ? Math.round(alert.confidenceScore * 100) : null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 z-20 rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100"
                    aria-label="Close modal"
                >
                    <X size={20} />
                </button>

                {/* Content Container */}
                <div className="max-h-[90vh] overflow-y-auto">
                    {/* Alert Image Section */}
                    <div className="relative bg-slate-900">
                        {alert.imageUrl ? (
                            <img
                                src={alert.imageUrl}
                                alt="Alert snapshot"
                                className="max-h-96 w-full object-contain"
                            />
                        ) : (
                            <div className="aspect-video flex items-center justify-center bg-slate-800 text-slate-400">
                                <span>Image unavailable</span>
                            </div>
                        )}

                        {/* Alert Badge Overlay */}
                        <div className={`absolute left-4 top-4 flex items-center gap-2 rounded-lg ${colors.bg} ${colors.text} px-3 py-2 backdrop-blur-sm`}>
                            {getAlertIcon(alert.alertType)}
                            <span className="font-semibold uppercase">
                                {alert.alertType.replace(/_/g, " ")}
                            </span>
                        </div>

                        {/* Resolution Badge */}
                        {alert.isResolved && (
                            <div className="absolute right-4 top-4 flex items-center gap-2 rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900 backdrop-blur-sm">
                                <CheckCircle2 size={18} />
                                <span className="font-semibold">Resolved</span>
                            </div>
                        )}
                    </div>

                    {/* Alert Details Section */}
                    <div className="space-y-4 p-6">
                        {/* Timestamp & Confidence */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Timestamp
                                </p>
                                <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                                    <Clock size={16} />
                                    <span>
                                        {alertDate.toLocaleString("en-US", {
                                            year: "numeric",
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                            second: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </div>

                            {confidence !== null && (
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                        ML Confidence
                                    </p>
                                    <div className="mt-1 space-y-2">
                                        <p className="text-lg font-bold text-slate-900">{confidence}%</p>
                                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-500 to-red-600 transition-all duration-300"
                                                style={{ width: `${confidence}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Jeepney & Driver Info */}
                        {alert.jeepneyInfo && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Vehicle & Driver Information
                                </p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                    <div>
                                        <p className="text-xs text-slate-600">Plate Number</p>
                                        <p className="font-mono font-semibold text-slate-900">
                                            {alert.jeepneyInfo.plateNumber}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-600">Driver Name</p>
                                        <p className="font-semibold text-slate-900">
                                            {alert.jeepneyInfo.driverName || "Unknown"}
                                        </p>
                                    </div>
                                    <div className="sm:col-span-2">
                                        <p className="text-xs text-slate-600">Status</p>
                                        <p className="inline-block rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-900">
                                            {alert.jeepneyInfo.status || "Active"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Snapshot Filename */}
                        {alert.snapshotFilename && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    File
                                </p>
                                <p className="mt-2 font-mono text-xs text-slate-900">
                                    {alert.snapshotFilename}
                                </p>
                            </div>
                        )}

                        {/* Alert Status & Action Buttons */}
                        <div className="flex justify-between gap-3 border-t border-slate-200 pt-4">
                            <div className="flex-1">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                    Status
                                </p>
                                <p className={`mt-2 inline-block rounded-full px-3 py-1.5 text-xs font-bold ${alert.isResolved
                                        ? "border border-emerald-300 bg-emerald-50 text-emerald-700"
                                        : "border border-amber-300 bg-amber-50 text-amber-700"
                                    }`}>
                                    {alert.isResolved ? "Resolved" : "Active"}
                                </p>
                            </div>

                            {!alert.isResolved && (
                                <button
                                    onClick={handleResolve}
                                    disabled={isResolving || isLoading}
                                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                                >
                                    {isResolving ? (
                                        <>
                                            <Loader size={16} className="animate-spin" />
                                            <span>Resolving...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 size={16} />
                                            <span>Resolve Alert</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
