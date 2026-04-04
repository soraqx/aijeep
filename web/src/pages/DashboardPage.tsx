import { useState } from "react";
import { useQuery } from "convex/react";
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
} from "lucide-react";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { api } from "../../convex/_generated/api";
import { UsersDirectory } from "../components/UsersDirectory";
import { LiveMapView } from "../components/LiveMapView";
import { EmergencyBadge } from "../components/EmergencyBadge";
import { AlertsGallery } from "../components/AlertsGallery";

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

type DashboardTab = "overview" | "live-map" | "alerts" | "snapshot-alerts" | "health" | "users";

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
 * Parses GPS string "lat,lng" into a LatLngTuple.
 */
function parseGPS(gpsString: string): LatLngTuple {
  const [lat, lng] = gpsString.split(",").map((v) => parseFloat(v));
  return [lat || 14.5995, lng || 120.9842]; // Fallback to Metro Manila center
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

  // Fetch live data from Convex
  const telemetryData = useQuery(api.telemetry.getLatest, { limit: 100 });
  const jeepneyData = useQuery(api.jeepneys.getAll, {});
  const alertData = useQuery(api.alerts.getActiveAlerts, {});

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

  // Process telemetry data for table display
  const telemetryRows = (telemetryData || []).slice(0, 10).map((telemetry: Telemetry) => {
    const accel = calculateAcceleration(telemetry.accelX, telemetry.accelY, telemetry.accelZ);
    const jeepney = jeepneyData?.find((j: Jeepney) => j._id === telemetry.jeepneyId);
    return {
      time: new Date(telemetry.timestamp).toLocaleTimeString(),
      jeepney: jeepney?.plateNumber || "Unknown",
      ear: telemetry.earValue.toFixed(2),
      accel: accel.toFixed(1) + " m/s²",
      status: determineStatus(telemetry.earValue, accel),
    };
  });

  // Process jeepney data with GPS positions
  const jeepneyPositions = (telemetryData || [])
    .reduce(
      (acc: Map<string, Telemetry>, telemetry: Telemetry) => {
        if (!acc.has(telemetry.jeepneyId)) {
          acc.set(telemetry.jeepneyId, telemetry);
        }
        return acc;
      },
      new Map()
    )
    .values();

  // Count metrics
  const activeJeepneyCount = jeepneyData?.length || 0;
  const alertCount = alertData?.filter((a: Alert) => !a.isResolved).length || 0;
  const drowsinessCount = (alertData || []).filter((a: Alert) => a.alertType === "drowsiness" && !a.isResolved).length;
  const erraticCount = (alertData || []).filter((a: Alert) => a.alertType === "erratic_driving" && !a.isResolved).length;

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
              label="Alert Snapshots"
              icon={<Image size={16} />}
              active={activeTab === "snapshot-alerts"}
              onClick={() => onTabChange("snapshot-alerts")}
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
                  title="Data Points"
                  value={(telemetryData?.length || 0).toString()}
                  subtitle="Telemetry records in stream"
                  icon={<Activity size={18} />}
                  loading={telemetryData === undefined}
                />
              </section>

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
                            <th className="px-3 py-2 text-left font-semibold text-slate-600">Acceleration</th>
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
                                <td className="px-3 py-2.5 text-slate-600">{row.accel}</td>
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
                    jeepneyIcon={jeepneyIcon}
                  />
                </div>
              )}
            </section>
          )}

          {activeTab === "alerts" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-800">Alerts & Incidents</h2>
              {alertData === undefined ? (
                <LoadingSpinner />
              ) : alertData.length > 0 ? (
                <div className="mt-4">
                  <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs text-amber-600">Total Active Alerts</p>
                      <p className="mt-1 text-2xl font-bold text-amber-900">{alertCount}</p>
                    </div>
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-600">Drowsiness Alerts</p>
                      <p className="mt-1 text-2xl font-bold text-red-900">{drowsinessCount}</p>
                    </div>
                    <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                      <p className="text-xs text-orange-600">Erratic Driving</p>
                      <p className="mt-1 text-2xl font-bold text-orange-900">{erraticCount}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {alertData.map((alert: Alert) => {
                      const jeepney = jeepneyData?.find((j: Jeepney) => j._id === alert.jeepneyId);
                      return (
                        <div key={alert._id} className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <AlertTriangle size={18} className="mt-0.5 flex-shrink-0 text-amber-600" />
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">
                              {alert.alertType.replace(/_/g, " ").toUpperCase()}
                            </p>
                            <p className="text-sm text-slate-600">{jeepney?.plateNumber || "Unknown"} • {jeepney?.driverName || "Unknown"}</p>
                            <p className="text-xs text-slate-500">{new Date(alert.timestamp).toLocaleString()}</p>
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${alert.isResolved ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-700"}`}>
                            {alert.isResolved ? "Resolved" : "Active"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-center text-sm text-slate-500">No active alerts - all systems operating normally!</p>
              )}
            </section>
          )}

          {activeTab === "snapshot-alerts" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-800">Active Alerts Gallery</h2>
                {alertCount > 0 && (
                  <span className="rounded-full border-2 border-red-500 bg-red-50 px-3 py-1 text-xs font-bold text-red-700">
                    {alertCount} Active
                  </span>
                )}
              </div>
              <AlertsGallery
                alerts={
                  alertData
                    ?.filter((a: Alert) => !a.isResolved)
                    .slice(0, 12)
                    .map((alert: Alert) => ({
                      id: alert._id,
                      jeepneyId: alert.jeepneyId,
                      alertType: alert.alertType as "DROWSY" | "HARSH_BRAKING" | "UNKNOWN",
                      timestamp: alert.timestamp,
                      confidenceScore: Math.random() * 0.3 + 0.7, // Mock confidence 70-100%
                      snapshotFilename: `alert_${new Date(alert.timestamp * 1000).toISOString().replace(/[:-]/g, "").slice(0, 15)}.jpg`,
                    })) || []
                }
                isLoading={alertData === undefined}
              />
            </section>
          )}

          {activeTab === "health" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-800">System Health</h2>
              <p className="mt-2 text-sm text-slate-600">
                System health panel placeholder. Use Dashboard Overview for operational status cards.
              </p>
            </section>
          )}

          {activeTab === "users" && <UsersDirectory />}
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
