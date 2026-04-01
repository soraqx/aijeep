import { useState } from "react";
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
} from "lucide-react";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { UsersDirectory } from "../components/UsersDirectory";

type MetricCardProps = {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "success";
};

function MetricCard({ title, value, subtitle, icon, tone = "default" }: MetricCardProps) {
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
          <p className="mt-2 text-2xl font-bold sm:text-3xl">{value}</p>
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
      className={`group flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
        active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
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

export function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const metroManilaCenter: LatLngTuple = [14.5995, 120.9842];
  const jeepneyPosition: LatLngTuple = metroManilaCenter;
  const jeepneyIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  const telemetryRows = [
    { time: "10:21:14", jeepney: "JPN-042", ear: "0.23", accel: "1.8 m/s²", status: "Normal" },
    { time: "10:21:18", jeepney: "JPN-042", ear: "0.17", accel: "2.7 m/s²", status: "Drowsy Risk" },
    { time: "10:21:23", jeepney: "JPN-017", ear: "0.20", accel: "3.2 m/s²", status: "Erratic Turn" },
    { time: "10:21:31", jeepney: "JPN-031", ear: "0.25", accel: "1.5 m/s²", status: "Normal" },
    { time: "10:21:38", jeepney: "JPN-017", ear: "0.18", accel: "3.8 m/s²", status: "Hard Brake" },
  ];

  const connectedJeepneys = [
    { id: "ABC-123", route: "Cubao - Taft", status: "Normal", lastSeen: "2s ago", lat: 14.5995, lng: 120.9842 },
    { id: "JPN-042", route: "Monumento - Quiapo", status: "Monitoring", lastSeen: "5s ago", lat: 14.6095, lng: 120.9812 },
    { id: "JPN-017", route: "Espana - Divisoria", status: "Alert", lastSeen: "1s ago", lat: 14.6031, lng: 120.9906 },
    { id: "JPN-031", route: "Makati Loop", status: "Normal", lastSeen: "3s ago", lat: 14.5561, lng: 121.0244 },
  ];

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
          <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 sm:text-sm">
            <Activity size={14} className="sm:h-4 sm:w-4" />
            Live Monitoring
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
          className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-slate-200 bg-white p-4 transition-transform duration-300 lg:sticky lg:top-16 lg:z-30 lg:block lg:h-[calc(100vh-4rem)] lg:translate-x-0 lg:p-5 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
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
        </aside>

        <main className="w-full p-4 sm:p-6 lg:p-8">
          {activeTab === "overview" && (
            <>
              <section className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-4">
                <MetricCard
                  title="Active Jeepneys"
                  value="32"
                  subtitle="+4 from previous hour"
                  icon={<Bus size={18} />}
                />
                <MetricCard
                  title="Recent Alerts"
                  value="7"
                  subtitle="3 drowsiness, 4 erratic driving"
                  icon={<AlertTriangle size={18} />}
                  tone="warning"
                />
                <MetricCard
                  title="System Status"
                  value="Online"
                  subtitle="All edge nodes connected"
                  icon={<ShieldCheck size={18} />}
                  tone="success"
                />
                <MetricCard
                  title="Monitoring Throughput"
                  value="24 FPS"
                  subtitle="Average camera stream rate"
                  icon={<Activity size={18} />}
                />
              </section>

              <section className="mt-5 grid grid-cols-1 gap-4 sm:mt-6 sm:gap-5 lg:grid-cols-12">
                <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:col-span-8">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Live Map View</h2>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                      Tracking: Jeepney ABC-123
                    </span>
                  </div>
                  <div className="relative z-0 aspect-video w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 sm:aspect-[16/10] lg:aspect-auto lg:h-[420px]">
                    <MapContainer center={metroManilaCenter} zoom={14} scrollWheelZoom className="h-full w-full">
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={jeepneyPosition} icon={jeepneyIcon}>
                        <Popup>Jeepney ID: ABC-123 (Status: Normal)</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-600 sm:text-sm">
                    <Navigation size={14} className="text-slate-500" />
                    Position is currently hardcoded and ready for Convex live updates.
                  </div>
                </article>
              </section>
            </>
          )}

          {activeTab === "live-map" && (
            <section className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-12">
              <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 lg:col-span-8">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-800 sm:text-base">Live Map View</h2>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    {connectedJeepneys.length} Jeepneys Connected
                  </span>
                </div>
                <div className="relative z-0 h-[420px] w-full overflow-hidden rounded-xl border border-slate-300 bg-slate-100 sm:h-[500px]">
                  <MapContainer center={metroManilaCenter} zoom={13} scrollWheelZoom className="h-full w-full">
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {connectedJeepneys.map((jeepney) => (
                      <Marker key={jeepney.id} position={[jeepney.lat, jeepney.lng]} icon={jeepneyIcon}>
                        <Popup>{`Jeepney ID: ${jeepney.id} (Status: ${jeepney.status})`}</Popup>
                      </Marker>
                    ))}
                  </MapContainer>
                </div>
              </article>
            </section>
          )}

          {activeTab === "alerts" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-base font-semibold text-slate-800">Alerts & Incidents</h2>
              <p className="mt-2 text-sm text-slate-600">
                Alerts panel placeholder. Use Dashboard Overview for combined metrics and telemetry.
              </p>
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
