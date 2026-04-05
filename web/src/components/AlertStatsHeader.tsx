import React from "react";
import { AlertTriangle, CheckCircle2, Zap, AlertCircle, TrendingUp } from "lucide-react";

interface AlertStatistics {
    totalToday: number;
    activeToday: number;
    resolvedToday: number;
    drowsyToday: number;
    harshBrakingToday: number;
    totalAllTime: number;
    activeAllTime: number;
    resolvedAllTime: number;
}

interface AlertStatsHeaderProps {
    stats: AlertStatistics | null;
    isLoading?: boolean;
}

/**
 * AlertStatsHeader displays real-time aggregated alert statistics.
 * Shows today's counts and all-time metrics for alert types and resolution status.
 */
export const AlertStatsHeader: React.FC<AlertStatsHeaderProps> = ({
    stats,
    isLoading = false,
}) => {
    const StatCard = ({
        label,
        value,
        subtext,
        icon,
        color,
    }: {
        label: string;
        value: string | number;
        subtext?: string;
        icon: React.ReactNode;
        color: "red" | "amber" | "emerald" | "slate";
    }) => {
        const colorClasses = {
            red: "border-red-200 bg-red-50 text-red-900",
            amber: "border-amber-200 bg-amber-50 text-amber-900",
            emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
            slate: "border-slate-200 bg-slate-50 text-slate-900",
        };

        return (
            <div className={`rounded-xl border p-3 sm:p-4 ${colorClasses[color]}`}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                            {label}
                        </p>
                        <p className="mt-1 text-2xl font-bold sm:text-3xl">
                            {isLoading ? "..." : value}
                        </p>
                        {subtext && (
                            <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtext}</p>
                        )}
                    </div>
                    <div className="rounded-lg border border-current border-opacity-20 p-2.5 text-xl sm:text-2xl opacity-75">
                        {icon}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {/* Today's Stats Section */}
            <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <TrendingUp size={16} />
                    Today's Activity
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:gap-4">
                    <StatCard
                        label="Total Alerts"
                        value={stats?.totalToday ?? 0}
                        subtext={stats?.activeToday ? `${stats.activeToday} active` : "All resolved"}
                        icon={<AlertCircle size={20} />}
                        color={stats?.activeToday ? "red" : "emerald"}
                    />
                    <StatCard
                        label="Drowsiness"
                        value={stats?.drowsyToday ?? 0}
                        subtext="Driver fatigue events"
                        icon={<AlertTriangle size={20} />}
                        color="amber"
                    />
                    <StatCard
                        label="Harsh Braking"
                        value={stats?.harshBrakingToday ?? 0}
                        subtext="Erratic driving detected"
                        icon={<Zap size={20} />}
                        color="red"
                    />
                    <StatCard
                        label="Resolved Today"
                        value={stats?.resolvedToday ?? 0}
                        subtext="Issues addressed"
                        icon={<CheckCircle2 size={20} />}
                        color="emerald"
                    />
                </div>
            </div>

            {/* All-Time Stats Section (collapsed by default) */}
            <details className="group rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700 hover:text-slate-900">
                    📊 View All-Time Statistics
                </summary>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4">
                    <StatCard
                        label="Total All-Time"
                        value={stats?.totalAllTime ?? 0}
                        icon={<AlertCircle size={18} />}
                        color="slate"
                    />
                    <StatCard
                        label="Active All-Time"
                        value={stats?.activeAllTime ?? 0}
                        icon={<AlertTriangle size={18} />}
                        color="slate"
                    />
                    <StatCard
                        label="Resolved All-Time"
                        value={stats?.resolvedAllTime ?? 0}
                        icon={<CheckCircle2 size={18} />}
                        color="slate"
                    />
                </div>
            </details>
        </div>
    );
};
