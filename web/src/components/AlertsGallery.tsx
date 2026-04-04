import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, Zap, X } from "lucide-react";

interface AlertSnapshot {
    id: string;
    jeepneyId: string;
    alertType: "DROWSY" | "HARSH_BRAKING" | "UNKNOWN";
    timestamp: number;
    confidenceScore: number;
    snapshotUrl?: string;
    snapshotFilename?: string;
}

interface AlertsGalleryProps {
    alerts: AlertSnapshot[];
    isLoading?: boolean;
}

/**
 * AlertsGallery displays a grid of recent alert snapshots with timestamps and confidence scores.
 * Each card shows the captured image, alert type, time, and ML model confidence.
 */
export const AlertsGallery: React.FC<AlertsGalleryProps> = ({
    alerts = [],
    isLoading = false,
}) => {
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
        const [viewerOpen, setViewerOpen] = useState(false);

        return (
            <>
                <div
                    className={`group relative overflow-hidden rounded-xl border p-3 shadow-sm transition hover:shadow-md cursor-pointer ${getAlertColor(alert.alertType)}`}
                    onClick={() => setViewerOpen(true)}
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
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-slate-600">
                                    Confidence
                                </span>
                                <span className="text-xs font-bold text-slate-900">
                                    {(alert.confidenceScore * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="mt-1 h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-red-600"
                                    style={{ width: `${Math.min(alert.confidenceScore * 100, 100)}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Full-screen image viewer modal */}
                {viewerOpen && (
                    <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4"
                        onClick={() => setViewerOpen(false)}
                    >
                        <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
                            <button
                                onClick={() => setViewerOpen(false)}
                                className="absolute top-2 right-2 z-10 rounded-full bg-slate-900 p-2 text-white hover:bg-slate-800"
                                aria-label="Close image viewer"
                            >
                                <X size={18} />
                            </button>

                            <div className="rounded-lg overflow-hidden bg-black">
                                {alert.snapshotUrl ? (
                                    <img
                                        src={alert.snapshotUrl}
                                        alt={`Alert snapshot ${alert.id}`}
                                        className="w-full object-contain max-h-[70vh]"
                                    />
                                ) : (
                                    <div className="aspect-video w-full flex items-center justify-center bg-slate-800 text-slate-400">
                                        <span>Image unavailable</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 uppercase">
                                            Alert Type
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {alert.alertType.replace(/_/g, " ")}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 uppercase">
                                            Confidence
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {(alert.confidenceScore * 100).toFixed(1)}%
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 uppercase">
                                            Date
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {formatDate(alert.timestamp)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs font-semibold text-slate-600 uppercase">
                                            Time
                                        </p>
                                        <p className="text-sm font-bold text-slate-900">
                                            {formatTime(alert.timestamp)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
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
