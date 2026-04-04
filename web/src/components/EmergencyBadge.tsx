import React from "react";
import { AlertTriangle } from "lucide-react";

interface EmergencyBadgeProps {
  show: boolean;
  message?: string;
}

/**
 * EmergencyBadge displays a red flashing alert badge when there are active alerts.
 * Used as a visual indicator on the dashboard header.
 */
export const EmergencyBadge: React.FC<EmergencyBadgeProps> = ({
  show,
  message = "ACTIVE ALERTS",
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-full border-2 border-red-500 bg-red-50 px-4 py-2 animate-pulse">
      <div className="relative">
        <AlertTriangle size={16} className="text-red-600" />
        <div className="absolute inset-0 animate-ping rounded-full bg-red-600 opacity-20"></div>
      </div>
      <span className="text-xs font-bold text-red-700 sm:text-sm">{message}</span>
    </div>
  );
};
