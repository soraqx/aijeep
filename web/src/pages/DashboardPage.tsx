import { useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bus,
  ChevronRight,
  LayoutDashboard,
  MapPinned,
  Menu,
  Navigation,
  ShieldCheck,
  Siren,
  Users,
  X,
  Loader,
  Image,
  LogOut,
  ArrowLeft,
} from "lucide-react";
import { useClerk } from "@clerk/clerk-react";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { api } from "../../convex/_generated/api";
import { UsersDirectory } from "../components/UsersDirectory";
import { LiveMapView } from "../components/LiveMapView";
import { EmergencyBadge } from "../components/EmergencyBadge";
import { AlertsGallery } from "../components/AlertsGallery";
import { haversineDistance, calculateSpeed, parseGPS } from "../utils/telemetryUtils";

// Types matching Convex schema
type Jeepney = {
  _id: string;
  _creationTime: number;
  plateNumber: string;
  driverName: string;
  status: string;
};

type Telemetry = {
  _id: string;
  _creationTime: number;
  jeepneyId: string;
  gps: string;
  earValue: number;
  accelX: number;
  accelY: number;
  accelZ: number;
  timestamp: number;
};

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
    driverName: string;
    status: string;
  } | null;
};

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "success";
  loading?: boolean;
};

function MetricCard({ title, value, subtitle, icon, tone = "default", loading = false }: MetricCardProps) {
  const toneStyles =
    tone === "warning"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-slate-200 bg-white text-slate-900";

  return (
    <article className={`rounded-2xl border p-4 shadow-sm transition hover:shadow-md sm:p-5 ${toneStyles}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
          <p className="mt-2 text-2xl font-bold sm:text-3xl">
            {loading ? <Loader size={24} className="animate-spin" /> : value}
          </p>
          <p className="mt-1 text-xs text-slate-600 sm:text-sm">{subtitle}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700">{icon}</div>
      </div>
    </article>
  );
}

type NavItemProps = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
};

function NavItem({ label, icon, active = false, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
        }`}
    >
      <span className="flex items-center gap-2">
        <span className={active ? "text-white" : "text-slate-500 group-hover:text-slate-700"}>{icon}</span>
        {label}
      </span>
      <ChevronRight
        size={16}
        className={active ? "text-white/80" : "text-slate-400 group-hover:text-slate-600"}
      />
    </button>
  );
}

type DashboardTab = "overview" | "live-map" | "alerts" | "health" | "users";

/**
 * LoadingSpinner component for rendering a centered loading indicator.
 */
function LoadingSpinner() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <Loader size={32} className="animate-spin text-blue-600" />
      <span className="ml-3 text-sm text-slate-600">Loading real-time data...</span>
    </div>
  );
}

/**
 * Calculates total acceleration magnitude from X, Y, Z components.
 */
function calculateAcceleration(accelX: number, accelY: number, accelZ: number): number {
  return Math.sqrt(accelX ** 2 + accelY ** 2 + accelZ ** 2);
}

/**
 * Determines status based on EAR value and acceleration.
 */
function determineStatus(earValue: number, acceleration: number): string {
  if (earValue < 0.15) return "Drowsy Risk";
  if (acceleration > 3.5) return "Hard Brake";
  if (acceleration > 2.5) return "Erratic Turn";
  if (earValue < 0.2) return "Monitoring";
  return "Normal";
}

export function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [selectedJeepneyId, setSelectedJeepneyId] = useState<string | null>(null);
  // Modal state for Alerts tab
  const [selectedAlertJeepneyId, setSelectedAlertJeepneyId] = useState<string | null>(null);
  const [selectedVehicleName, setSelectedVehicleName] = useState<string>("");
  const [alertRefreshKey, setAlertRefreshKey] = useState(0);
  const navigate = useNavigate();
  const { signOut } = useClerk();

  // Fetch live data from Convex
  const telemetryData = useQuery(api.telemetry.getLatest, { limit: 100 });
  const jeepneyData = useQuery(api.jeepneys.getAll, {});
  const alertData = useQuery(api.alerts.getActiveAlerts, {});
  const allAlertsData = useQuery(api.alerts.getAllAlerts, { limit: 50 });
  const alertStats = useQuery(api.alerts.getAlertStats, {});

  // Conditional telemetry fetch - only when a vehicle is selected
  const vehicleTelemetryData = useQuery(
    api.telemetry.getLatestByJeepneyId,
    selectedJeepneyId 
      ? { jeepneyId: selectedJeepneyId as any } 
      : "skip"
  );

  // Conditional alerts fetch for vehicle detail view
  const vehicleAlertsData = useQuery(
    api.alerts.getAlertsByJeepneyId,
    selectedJeepneyId
      ? { jeepneyId: selectedJeepneyId as any }
      : "skip"
  );

  const metroManilaCenter: LatLngTuple = [14.5995, 120.9842];

  const jeepneyIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

// Process telemetry data for table display - now with speed calculation
const telemetryRows = (telemetryData || []).slice(0, 10).map((telemetry: Telemetry, index: number) => {
  // Calculate speed using current and previous telemetry point
  const previousTelemetry = index > 0 ? (telemetryData || [])[index - 1] : null;
  const speedKmh = previousTelemetry 
    ? calculateSpeed(
        { gps: telemetry.gps, timestamp: telemetry.timestamp },
        { gps: previousTelemetry.gps, timestamp: previousTelemetry.timestamp }
      )
    : 0;
  
  const jeepney = jeepneyData?.find((j: Jeepney) => j._id === telemetry.jeepneyId);
  return {
    time: new Date(telemetry.timestamp).toLocaleTimeString(),
    jeepney: jeepney?.plateNumber || "Unknown",
    ear: telemetry.earValue.toFixed(2),
    speed: speedKmh.toFixed(1) + " km/h",
    status: determineStatus(telemetry.earValue, calculateAcceleration(telemetry.accelX, telemetry.accelY, telemetry.accelZ)),
  };
});

// Process alerts data for the Alerts tab - group by jeepney
const vehiclesWithAlerts: {
  jeepneyId: string;
  plateNumber: string;
  driverName: string;
  activeAlerts: number;
  drowsyAlerts: number;
  lastAlertTimestamp: number;
}[] = [];

if (allAlertsData && jeepneyData) {
  // Group alerts by jeepneyId
  const alertsByJeepney: Record<string, Alert[]> = {};
  
  allAlertsData.forEach((alert) => {
    if (!alertsByJeepney[alert.jeepneyId]) {
      alertsByJeepney[alert.jeepneyId] = [];
    }
    alertsByJeepney[alert.jeepneyId].push(alert);
  });
  
  // Create vehicle summary objects
  Object.keys(alertsByJeepney).forEach((jeepneyId) => {
    const jeepney = jeepneyData.find((j) => j._id === jeepneyId);
    if (jeepney) {
      const alerts = alertsByJeepney[jeepneyId];
      const activeAlerts = alerts.filter((a) => !a.isResolved).length;
      const drowsyAlerts = alerts.filter((a) => a.alertType === "DROWSY" && !a.isResolved).length;
      const lastAlertTimestamp = Math.max(...alerts.map((a) => a.timestamp));
      
      vehiclesWithAlerts.push({
        jeepneyId,
        plateNumber: jeepney.plateNumber,
        driverName: jeepney.driverName,
        activeAlerts,
        drowsyAlerts,
        lastAlertTimestamp
      });
    }
  });
  
  // Sort by most recent alert first
  vehiclesWithAlerts.sort((a, b) => b.lastAlertTimestamp - a.lastAlertTimestamp);
}

// Conditional alerts fetch for vehicle detail view (modal)
const selectedVehicleAlerts = useQuery(
  api.alerts.getAlertsByJeepneyId,
  selectedAlertJeepneyId
    ? { jeepneyId: selectedAlertJeepneyId as any }
    : "skip"
);

const selectedVehicleAlertsLoading = selectedVehicleAlerts === undefined;

const handleAlertResolved = () => {
  // Trigger a refresh by briefly clearing and re-setting the selected jeepney
  const currentId = selectedAlertJeepneyId;
  setSelectedAlertJeepneyId(null);
  setTimeout(() => setSelectedAlertJeepneyId(currentId), 50);
};



  // Count metrics
  const activeJeepneyCount = jeepneyData?.length || 0;
  const alertCount = alertData?.filter((a: Alert) => !a.isResolved).length || 0;
  const drowsinessCount = (alertData || []).filter((a: Alert) => a.alertType === "drowsiness" && !a.isResolved).length;
  const erraticCount = (alertData || []).filter((a: Alert) => a.alertType === "erratic_driving" && !a.isResolved).length;
  const totalAlertCount = allAlertsData?.length || 0;
  const resolvedAlertCount = (allAlertsData || []).filter((a: Alert) => a.isResolved).length;

  const onTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-[1600px] items-center justify-between px-4 sm:h-16 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-blue-600 p-2 text-white">
                <Bus size={18} className="sm:h-5 sm:w-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold sm:text-base">AI-JEEP Safety Dashboard</h1>
                <p className="hidden text-xs text-slate-500 sm:block">
                  Real-time driver vigilance and road behavior monitoring
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {alertCount > 0 ? (
              <EmergencyBadge show={true} message={`${alertCount} ACTIVE ALERTS`} />
            ) : (
              <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:text-sm">
                <Activity size={14} className="sm:h-4 sm:w-4" />
                Live Monitoring
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {sidebarOpen && (
          <button
            aria-label="Close navigation overlay"
            className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white p-4 transition-transform duration-300 lg:sticky lg:top-16 lg:z-30 lg:block lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:p-5 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
        >
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <p className="text-sm font-semibold text-slate-600">Navigation</p>
            <button
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X size={16} />
            </button>
          </div>

           <nav className="space-y-2">
             <NavItem
               label="Dashboard Overview"
               icon={<LayoutDashboard size={16} />}
               active={activeTab === "overview"}
               onClick={() => onTabChange("overview")}
             />
             <NavItem
               label="Live Map View"
               icon={<MapPinned size={16} />}
               active={activeTab === "live-map"}
               onClick={() => onTabChange("live-map")}
             />
<NavItem
                label="Alerts & Incidents"
                icon={<Siren size={16} />}
                active={activeTab === "alerts"}
                onClick={() => onTabChange("alerts")}
              />
              <NavItem
                label="System Health"
               icon={<ShieldCheck size={16} />}
               active={activeTab === "health"}
               onClick={() => onTabChange("health")}
             />
             <NavItem
               label="Users"
               icon={<Users size={16} />}
               active={activeTab === "users"}
               onClick={() => onTabChange("users")}
             />
           </nav>
           
            <div className="mt-6 pt-5 border-t border-slate-200">
             <button
               onClick={async () => {
                 await signOut();
               }}
               className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition text-slate-700 hover:bg-slate-100 hover:text-slate-900"
             >
               <span className="flex items-center gap-2">
                 <LogOut size={16} className="text-slate-500 group-hover:text-slate-700" />
                 Sign Out
               </span>
             </button>
           </div>
        </aside>

        <main className="w-full p-4 sm:p-6 lg:p-8">
          {activeTab === "overview" && (
            <>
              <section className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Active Jeepneys"
                  value={activeJeepneyCount.toString()}
                  subtitle={`${activeJeepneyCount} vehicles streaming`}
                  icon={<Bus size={18} />}
                  loading={jeepneyData === undefined}
                />
                <MetricCard
                  title="Recent Alerts"
                  value={alertCount.toString()}
                  subtitle={`${drowsinessCount} drowsiness, ${erraticCount} erratic`}
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                  loading={alertData === undefined}
                />
                <MetricCard
                  title="System Status"
                  value={activeJeepneyCount > 0 ? "Online" : "Waiting"}
                  subtitle={activeJeepneyCount > 0 ? "All edge nodes connected" : "Connecting to edge devices"}
                  icon={<ShieldCheck size={18} />}
                  tone={activeJeepneyCount > 0 ? "success" : "default"}
                  loading={jeepneyData === undefined}
                />
<MetricCard
                   title="Current Speed"
                   value={telemetryData && telemetryData.length > 0 
                     ? ((() => {
                         const latest = telemetryData[telemetryData.length - 1];
                         const previous = telemetryData.length > 1 ? telemetryData[telemetryData.length - 2] : null;
                         if (!latest || !previous) return "0";
                         const speed = calculateSpeed(
                           { gps: latest.gps, timestamp: latest.timestamp },
                           { gps: previous.gps, timestamp: previous.timestamp }
                         );
                         return speed.toFixed(1);
                       })())
                     : "0"
                   }
                   subtitle="Speed of latest telemetry reading"
                   icon={<Activity size={18} />}
                   loading={telemetryData === undefined}
                 />
              </section>

              {/* Vehicle Detail View - Only shown when a vehicle is selected */}
              {selectedJeepneyId && (
                <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedJeepneyId(null)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <ArrowLeft size={16} />
                        Back to Fleet
                      </button>
                      <h2 className="text-lg font-semibold text-slate-800">
                        {(() => {
                          const jeepney = jeepneyData?.find((j: Jeepney) => j._id === selectedJeepneyId);
                          return jeepney ? `${jeepney.plateNumber} - ${jeepney.driverName}` : "Vehicle Details";
                        })()}
                      </h2>
                    </div>
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
                      Detailed Telemetry
                    </span>
                  </div>

                  {vehicleTelemetryData === undefined ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader size={20} className="animate-spin text-blue-600" />
                      <span className="ml-2 text-sm text-slate-600">Loading vehicle telemetry...</span>
                    </div>
                  ) : !vehicleTelemetryData ? (
                    <p className="text-center text-sm text-slate-500 py-8">No telemetry data available for this vehicle</p>
                  ) : (
                    (() => {
                      const telemetry = vehicleTelemetryData;
                      if (!telemetry) return null;
                      
                      const gps = parseGPS(telemetry.gps);
                      const accel = calculateAcceleration(telemetry.accelX, telemetry.accelY, telemetry.accelZ);
                      const status = determineStatus(telemetry.earValue, accel);
                      
                      // Convert Unix timestamp (seconds) to milliseconds
                      const telemetryTime = telemetry.timestamp * 1000;
                      const now = Date.now();
                      const timeDiff = now - telemetryTime;
                      
                      // Format relative time
                      const getRelativeTime = (diff: number): string => {
                        if (diff < 0) return "Just now";
                        const seconds = Math.floor(diff / 1000);
                        const minutes = Math.floor(seconds / 60);
                        const hours = Math.floor(minutes / 60);
                        const days = Math.floor(hours / 24);
                        
                        if (seconds < 60) return "Just now";
                        if (minutes < 60) return `${minutes} min${minutes !== 1 ? 's' : ''} ago`;
                        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
                        return `${days} day${days !== 1 ? 's' : ''} ago`;
                      };
                      
                      const timeAgo = getRelativeTime(timeDiff);

                      // Calculate speed using global telemetry data to find previous reading
                      const globalIndex = telemetryData?.findIndex((t) => t._id === telemetry._id) ?? -1;
                      const previousTelemetry = globalIndex > 0 ? telemetryData?.[globalIndex + 1] : null;
                      const speedKmh = previousTelemetry
                        ? calculateSpeed(
                            { gps: telemetry.gps, timestamp: telemetry.timestamp },
                            { gps: previousTelemetry.gps, timestamp: previousTelemetry.timestamp }
                          )
                        : telemetry.speedKmh ?? 0;

                      return (
                        <>
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            {/* Current Speed */}
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Current Speed</p>
                              <p className="mt-2 text-2xl font-bold text-slate-900">
                                {speedKmh.toFixed(1)}
                                <span className="ml-1 text-sm font-normal text-slate-500">km/h</span>
                              </p>
                            </div>
                            
                            {/* Driver State (EAR) */}
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver State</p>
                              <p className="mt-2 text-2xl font-bold text-slate-900">
                                {telemetry.earValue.toFixed(2)}
                                <span className="ml-1 text-sm font-normal text-slate-500">
                                  - {status === "Normal" ? "Awake" : status === "Monitoring" ? "Monitoring" : "Alert"}
                                </span>
                              </p>
                            </div>
                            
                            {/* Location */}
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Location</p>
                              <p className="mt-2 text-lg font-bold text-slate-900 font-mono">
                                {gps ? `${gps[0].toFixed(4)}, ${gps[1].toFixed(4)}` : "N/A"}
                              </p>
                            </div>
                            
                            {/* Last Updated */}
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Updated</p>
                              <p className="mt-2 text-2xl font-bold text-slate-900">{timeAgo}</p>
                            </div>
                          </div>

                          {/* Live Map */}
                          {gps && (
                            <div className="mt-6 h-[400px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                              <MapContainer
                                center={gps}
                                zoom={15}
                                scrollWheelZoom={false}
                                style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
                              >
                                <TileLayer
                                  attribution='&copy; OpenStreetMap contributors'
                                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                />
                                <Marker position={gps} icon={jeepneyIcon}>
                                  <Popup>
                                    {(() => {
                                      const jeepney = jeepneyData?.find((j: Jeepney) => j._id === selectedJeepneyId);
                                      return jeepney?.plateNumber || "Vehicle";
                                    })()}
                                  </Popup>
                                </Marker>
                              </MapContainer>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                </section>
              )}

              

              {/* Fleet Overview - Vehicle Cards */}
              {!selectedJeepneyId && (
                <section className="mt-6">
                  <h3 className="mb-4 text-sm font-semibold text-slate-700">Fleet Overview - Click a vehicle for details</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {jeepneyData?.map((jeepney: Jeepney) => {
                      const latestTelemetry = telemetryData?.find((t: Telemetry) => t.jeepneyId === jeepney._id);
                      const accel = latestTelemetry ? calculateAcceleration(latestTelemetry.accelX, latestTelemetry.accelY, latestTelemetry.accelZ) : 0;
                      const status = latestTelemetry ? determineStatus(latestTelemetry.earValue, accel) : "Unknown";
                      
                      return (
                        <button
                          key={jeepney._id}
                          onClick={() => setSelectedJeepneyId(jeepney._id)}
                          className="flex flex-col items-start rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-400 hover:shadow-md"
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                              {jeepney.plateNumber}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                status === "Normal"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : status === "Monitoring"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-slate-900">{jeepney.driverName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {latestTelemetry
                              ? `EAR: ${latestTelemetry.earValue.toFixed(2)}`
                              : "No telemetry"}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-12">
                <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:col-span-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Latest Telemetry</h2>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Live Feed
                    </span>
                  </div>
                  {telemetryData === undefined ? (
                    <LoadingSpinner />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
<thead>
                           <tr className="border-b border-slate-200">
                             <th className="px-3 py-2 text-left font-semibold text-slate-600">Time</th>
                             <th className="px-3 py-2 text-left font-semibold text-slate-600">Jeepney</th>
                             <th className="px-3 py-2 text-left font-semibold text-slate-600">EAR</th>
                             <th className="px-3 py-2 text-left font-semibold text-slate-600">Speed</th>
                             <th className="px-3 py-2 text-left font-semibold text-slate-600">Status</th>
                           </tr>
                         </thead>
                        <tbody>
{telemetryRows.length > 0 ? (
                             telemetryRows.map((row, idx) => (
                               <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                                 <td className="px-3 py-2.5 font-mono text-slate-600">{row.time}</td>
                                 <td className="px-3 py-2.5 font-semibold text-slate-900">{row.jeepney}</td>
                                 <td className="px-3 py-2.5 text-slate-600">{row.ear}</td>
                                 <td className="px-3 py-2.5 text-slate-600">{row.speed}</td>
                                 <td className="px-3 py-2.5">
                                   <span
                                     className={`rounded-full px-2.5 py-1 text-xs font-medium ${row.status === "Normal"
                                       ? "bg-emerald-100 text-emerald-700"
                                       : row.status === "Monitoring"
                                         ? "bg-blue-100 text-blue-700"
                                         : "bg-amber-100 text-amber-700"
                                       }`}
                                   >
                                     {row.status}
                                   </span>
                                 </td>
                               </tr>
                             ))
                           ) : (
                             <tr>
                               <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                                 No telemetry data available yet
                               </td>
                             </tr>
                           )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>

                <aside className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:col-span-4">
                  <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Active Alerts</h2>
                  {alertData === undefined ? (
                    <div className="mt-4 flex items-center justify-center py-8">
                      <Loader size={20} className="animate-spin text-blue-600" />
                    </div>
                  ) : alertData.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {alertData.slice(0, 5).map((alert: Alert) => {
                        const jeepney = jeepneyData?.find((j: Jeepney) => j._id === alert.jeepneyId);
                        return (
                          <li key={alert._id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" />
                            <div className="flex-1">
                              <p className="text-xs font-semibold text-slate-900">
                                {alert.alertType.replace(/_/g, " ").toUpperCase()}
                              </p>
                              <p className="text-xs text-slate-600">{jeepney?.plateNumber || "Unknown"}</p>
                              <p className="text-xs text-slate-500">
                                {new Date(alert.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-4 text-center text-sm text-slate-500">No active alerts</p>
                  )}
                </aside>
              </section>
            </>
          )}

          {activeTab === "live-map" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 overflow-hidden">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Live Map View</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                  {jeepneyData?.length || 0} Vehicles Connected
                </span>
              </div>
              {telemetryData === undefined || jeepneyData === undefined ? (
                <LoadingSpinner />
              ) : (
                <div className="relative z-0 h-[420px] w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 sm:h-[500px]">
<LiveMapView
  telemetryData={telemetryData}
  jeepneyData={jeepneyData}
  calculateAcceleration={calculateAcceleration}
  determineStatus={determineStatus}
  parseGPS={parseGPS}
  calculateSpeed={calculateSpeed}
  jeepneyIcon={jeepneyIcon}
/>
                </div>
              )}
            </section>
          )}

{activeTab === "alerts" && (
            <>
              {/* Modal for Vehicle Alert Details */}
              {selectedAlertJeepneyId && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center">
                  <div className="relative w-full max-w-4xl max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-2xl">
                    <div className="flex items-center justify-between p-4 border-b border-slate-200">
                      <h2 className="text-lg font-semibold text-slate-800">
                        {selectedVehicleName}
                      </h2>
                      <button
                        onClick={() => setSelectedAlertJeepneyId(null)}
                        className="rounded-lg hover:bg-slate-100 p-2"
                        aria-label="Close modal"
                      >
                        <X size={20} className="text-slate-500 hover:text-slate-700" />
                      </button>
                    </div>
<div className="p-6 space-y-6">
                      <AlertsGallery
                        alerts={selectedVehicleAlerts || []}
                        isLoading={selectedVehicleAlertsLoading}
                        onAlertResolved={handleAlertResolved}
                      />
                      <div className="border-t border-slate-200 pt-4">
                        <h3 className="mb-3 text-sm font-semibold text-slate-700">Alert History</h3>
                        {selectedVehicleAlertsLoading ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader size={16} className="animate-spin text-amber-600" />
                            <span className="ml-2 text-sm text-slate-500">Loading alert history...</span>
                          </div>
                        ) : selectedVehicleAlerts?.length === 0 ? (
                          <p className="text-center text-sm text-slate-500 py-4">No alert history for this vehicle</p>
                        ) : (
                          <div className="space-y-3">
                            {selectedVehicleAlerts?.map((alert) => (
                              <div key={alert._id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    alert.alertType === "DROWSY" 
                                      ? "bg-red-100 text-red-700" 
                                      : alert.alertType === "HARSH_BRAKING"
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-slate-100 text-slate-700"
                                  }`}>
                                    {alert.alertType === "DROWSY" ? "DROWSY" : alert.alertType === "HARSH_BRAKING" ? "HARSH BRAKING" : alert.alertType}
                                  </span>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                    alert.isResolved 
                                      ? "bg-emerald-100 text-emerald-700" 
                                      : "bg-amber-100 text-amber-700"
                                  }`}>
                                    {alert.isResolved ? "Resolved" : "Active"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500">{new Date(alert.timestamp).toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Alerts & Incidents Main Content */}
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-base font-semibold text-slate-800">Alerts & Incidents</h2>
                {allAlertsData === undefined ? (
                  <LoadingSpinner />
                ) : (
                  <div className="mt-4">
                    <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-600">Total Alerts</p>
                        <p className="mt-1 text-2xl font-bold text-amber-900">{totalAlertCount}</p>
                      </div>
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-xs text-amber-600">Active Alerts</p>
                        <p className="mt-1 text-2xl font-bold text-amber-900">{alertCount}</p>
                      </div>
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                        <p className="text-xs text-emerald-600">Resolved Alerts</p>
                        <p className="mt-1 text-2xl font-bold text-emerald-900">{resolvedAlertCount}</p>
                      </div>
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                        <p className="text-xs text-red-600">Drowsiness</p>
                        <p className="mt-1 text-2xl font-bold text-red-900">{drowsinessCount}</p>
                      </div>
                    </div>
                    <div className="mt-6">
                      <h3 className="mb-4 text-sm font-semibold text-slate-700">Vehicles with Alerts</h3>
                      {vehiclesWithAlerts.length === 0 ? (
                        <p className="text-center text-sm text-slate-500 py-8">No vehicles with alerts</p>
                      ) : (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                          {vehiclesWithAlerts.map((vehicle) => (
                            <button
                              key={vehicle.jeepneyId}
                              onClick={() => {
                                setSelectedAlertJeepneyId(vehicle.jeepneyId as any);
                                setSelectedVehicleName(`${vehicle.plateNumber} - ${vehicle.driverName}`);
                              }}
                              className={`relative overflow-hidden rounded-xl border border-amber-200 bg-white p-4 hover:border-amber-300 hover:shadow-md transition-all ${
                                vehicle.activeAlerts > 0 && vehicle.drowsyAlerts > 0
                                  ? "border-red-300"
                                  : ""
                              }`}
                            >
                              <div className="mb-2 flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-slate-900">{vehicle.plateNumber}</p>
                                  <p className="mt-1 text-xs text-slate-500">{vehicle.driverName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    vehicle.activeAlerts > 0 
                                      ? "bg-amber-100 text-amber-700" 
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}>
                                    {vehicle.activeAlerts} Active
                                  </span>
                                  {vehicle.drowsyAlerts > 0 && (
                                    <span className="ml-2 rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                                      {vehicle.drowsyAlerts} Drowsy
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-slate-100">
                                <p className="text-xs text-slate-500">Last alert: {new Date(vehicle.lastAlertTimestamp).toLocaleString()}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>
            </>
          )}

            {activeTab === "health" && (
               <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                 <h2 className="text-base font-semibold text-slate-800">System Health</h2>
                 <p className="mt-2 text-sm text-slate-600">
                   System health panel placeholder. Use Dashboard Overview for operational status cards.
                 </p>
               </section>
             )}
             
           {activeTab === "users" && (
             <UsersDirectory />
           )}
         </main>
      </div>

      <style>{`
        .leaflet-pane,
        .leaflet-top,
        .leaflet-bottom,
        .leaflet-control {
          z-index: 10 !important;
        }
      `}</style>
    </div>
  );
}
