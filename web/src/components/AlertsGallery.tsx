import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, Zap, X, CheckCircle2, Loader } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { AlertDetailsModal } from "./AlertDetailsModal";

interface AlertSnapshot {
    id: string;
    _id?: Id<"alerts">;
    jeepneyId: string;
    alertType: "DROWSY" | "HARSH_BRAKING" | "UNKNOWN";
    timestamp: number;
    confidenceScore: number;
    snapshotUrl?: string;
    snapshotFilename?: string;
    isResolved?: boolean;
    jeepneyInfo?: {
        plateNumber: string;
        driverName: string;
        status: string;
    } | null;
}

interface AlertsGalleryProps {
    alerts: AlertSnapshot[];
    isLoading?: boolean;
    onDismiss?: (alertId: string) => void;
}

/**
 * AlertsGallery displays a grid of recent alert snapshots with timestamps and confidence scores.
 * Each card shows the captured image, alert type, time, and ML model confidence.
 * Includes dismiss button and click-to-details modal functionality.
 */
export const AlertsGallery: React.FC<AlertsGalleryProps> = ({
    alerts = [],
    isLoading = false,
    onDismiss,
}) => {
    const resolveAlertMutation = useMutation(api.alerts.resolveAlert);

    const getAlertIcon = (alertType: AlertSnapshot["alertType"]) => {
        switch (alertType) {
            case "DROWSY":
                return <AlertTriangle size={18} className="text-amber-600" />;
            case "HARSH_BRAKING":
                return <Zap size={18} className="text-red-600" />;
            default:
                return <AlertTriangle size={18} className="text-slate-600" />;
        }
    };

    const getAlertColor = (alertType: AlertSnapshot["alertType"]) => {
        switch (alertType) {
            case "DROWSY":
                return "border-amber-200 bg-amber-50";
            case "HARSH_BRAKING":
                return "border-red-200 bg-red-50";
            default:
                return "border-slate-200 bg-slate-50";
        }
    };

    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    };

    const formatDate = (timestamp: number) => {
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString("en-US");
    };

    // Individual alert card component
    const AlertCard: React.FC<{ alert: AlertSnapshot }> = ({ alert }) => {
        const [detailsOpen, setDetailsOpen] = useState(false);
        const [isDismissing, setIsDismissing] = useState(false);

        const handleDismiss = async (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!alert._id) return;

            try {
                setIsDismissing(true);
                await resolveAlertMutation({ alertId: alert._id });
                onDismiss?.(alert.id);
            } catch (error) {
                console.error("Failed to dismiss alert:", error);
            } finally {
                setIsDismissing(false);
            }
        };

        return (
            <>
                <div
                    className={`group relative overflow-hidden rounded-xl border p-3 shadow-sm transition hover:shadow-md cursor-pointer ${getAlertColor(alert.alertType)}`}
                    onClick={() => setDetailsOpen(true)}
                >
                    {/* Placeholder or actual snapshot image */}
                    <div className="aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-300 to-slate-400 mb-3">
                        {alert.snapshotUrl ? (
                            <img
                                src={alert.snapshotUrl}
                                alt={`Alert snapshot ${alert.id}`}
                                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />
                        ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-600">
                                <span className="text-sm font-medium">
                                    {alert.snapshotFilename || "No image"}
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {getAlertIcon(alert.alertType)}
                                <span className="text-xs font-bold uppercase text-slate-700">
                                    {alert.alertType.replace(/_/g, " ")}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1 text-xs text-slate-600">
                            <Clock size={12} />
                            <span>{formatTime(alert.timestamp)}</span>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-slate-600">
                                    Confidence
                                </span>
                                <span className="text-xs font-bold text-slate-900">
                                    {(alert.confidenceScore * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-red-600"
                                    style={{ width: `${Math.min(alert.confidenceScore * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        {/* Dismiss Button */}
                        <button
                            onClick={handleDismiss}
                            disabled={isDismissing || alert.isResolved}
                            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {isDismissing ? (
                                <>
                                    <Loader size={14} className="animate-spin" />
                                    <span>Dismissing...</span>
                                </>
                            ) : alert.isResolved ? (
                                <>
                                    <CheckCircle2 size={14} />
                                    <span>Dismissed</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 size={14} />
                                    <span>Dismiss</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Details Modal */}
                <AlertDetailsModal
                    alert={alert._id ? {
                        _id: alert._id,
                        jeepneyId: alert.jeepneyId as Id<"jeepneys">,
                        alertType: alert.alertType,
                        timestamp: alert.timestamp,
                        confidenceScore: alert.confidenceScore,
                        snapshotFilename: alert.snapshotFilename,
                        imageUrl: alert.snapshotUrl,
                        isResolved: alert.isResolved || false,
                        jeepneyInfo: alert.jeepneyInfo,
                    } : null}
                    isOpen={detailsOpen}
                    onClose={() => setDetailsOpen(false)}
                />
            </>
        );
    };

    if (isLoading) {
        return (
            <div className="flex min-h-[400px] items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (alerts.length === 0) {
        return (
            <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <div className="text-center">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-slate-400" />
                    <p className="text-sm font-medium text-slate-600">No active alerts</p>
                    <p className="text-xs text-slate-500">
                        System is operating normally
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
            ))}
        </div>
    );
};
