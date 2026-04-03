import { useEffect, useRef, useState } from "react";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap } from "react-leaflet";
import { X } from "lucide-react";

// Types
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

type LiveMapViewProps = {
    telemetryData: Telemetry[] | undefined;
    jeepneyData: Jeepney[] | undefined;
    calculateAcceleration: (accelX: number, accelY: number, accelZ: number) => number;
    determineStatus: (earValue: number, acceleration: number) => string;
    parseGPS: (gpsString: string) => LatLngTuple;
    jeepneyIcon: L.Icon;
};

/**
 * PLACEHOLDER ROUTE DATA
 * ========================
 * This is a static route from Malolos to San Jose del Monte.
 * 
 * INSTRUCTIONS FOR PRODUCTION:
 * Replace the coordinates below with the actual GPS coordinates of your final route.
 * Format: [latitude, longitude] pairs in order from start to finish.
 * 
 * Example structure (from Malolos to San Jose del Monte):
 * const MALOLOS_TO_SJDM_ROUTE: LatLngTuple[] = [
 *   [14.8353, 120.8396],  // Malolos Start
 *   [14.8360, 120.8420],  // Through main road
 *   ... more waypoints ...
 *   [14.8050, 120.9850],  // San Jose del Monte End
 * ];
 */
const MALOLOS_TO_SJDM_ROUTE: LatLngTuple[] = [
    [14.8353, 120.8396], // Malolos City Center
    [14.8360, 120.8420],
    [14.8390, 120.8500],
    [14.8450, 120.8650],
    [14.8520, 120.8800],
    [14.8580, 120.9000],
    [14.8620, 120.9150],
    [14.8650, 120.9300],
    [14.8670, 120.9450],
    [14.8680, 120.9600],
    [14.8670, 120.9750],
    [14.8650, 120.9850],
    [14.8300, 121.0050], // San Jose del Monte Area
];

/**
 * Component to handle map centering and tracking behavior
 */
function MapController({
    selectedJeepneyId,
    selectedPosition,
}: {
    selectedJeepneyId: string | null;
    selectedPosition: LatLngTuple | null;
}) {
    const map = useMap();

    useEffect(() => {
        if (selectedJeepneyId && selectedPosition) {
            // Fly to the selected jeepney with smooth animation
            map.flyTo(selectedPosition, 16, {
                duration: 1.5, // seconds for animation
                easeLinearity: 0.25,
            });
        }
    }, [map, selectedJeepneyId, selectedPosition]);

    return null;
}

/**
 * LiveMapView Component
 *
 * Displays a live map with:
 * - Static route line (Malolos to San Jose del Monte)
 * - Dynamic jeepney markers with real-time positions
 * - Driver status indicators
 * - Marker click selection with map recentering
 * - Tracking mode for selected vehicles
 */
export function LiveMapView({
    telemetryData,
    jeepneyData,
    calculateAcceleration,
    determineStatus,
    parseGPS,
    jeepneyIcon,
}: LiveMapViewProps) {
    const [selectedJeepneyId, setSelectedJeepneyId] = useState<string | null>(null);
    const jeepneyPositionsRef = useRef<Map<string, Telemetry>>(new Map());
    const mapRef = useRef<any>(null);

    const metroManilaCenter: LatLngTuple = [14.5995, 120.9842];

    // Build a map of jeepney positions (latest telemetry per vehicle)
    useEffect(() => {
        if (!telemetryData) return;

        const positions = new Map<string, Telemetry>();
        for (const telemetry of telemetryData) {
            if (!positions.has(telemetry.jeepneyId)) {
                positions.set(telemetry.jeepneyId, telemetry);
            }
        }
        jeepneyPositionsRef.current = positions;
    }, [telemetryData]);

    // Get selected jeepney's current position for map centering
    const selectedPosition = selectedJeepneyId
        ? parseGPS(jeepneyPositionsRef.current.get(selectedJeepneyId)?.gps || "")
        : null;

    const handleMarkerClick = (jeepneyId: string) => {
        setSelectedJeepneyId(selectedJeepneyId === jeepneyId ? null : jeepneyId);
    };

    const handleDeselect = () => {
        setSelectedJeepneyId(null);
    };

    return (
        <div className="relative h-full w-full">
            <MapContainer
                center={metroManilaCenter}
                zoom={13}
                scrollWheelZoom
                className="h-full w-full"
                ref={mapRef}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Static Route Line */}
                <Polyline
                    positions={MALOLOS_TO_SJDM_ROUTE}
                    color="#3b82f6"
                    weight={4}
                    opacity={0.7}
                    dashArray="8, 4"
                    lineCap="round"
                    lineJoin="round"
                />

                {/* Route Start & End Markers */}
                <Marker
                    position={MALOLOS_TO_SJDM_ROUTE[0]}
                    icon={L.icon({
                        iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMxMGI5ODEiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjwvc3ZnPg==",
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                        popupAnchor: [0, -16],
                    })}
                >
                    <Popup>
                        <p className="font-semibold text-emerald-700">Route Start: Malolos</p>
                    </Popup>
                </Marker>

                <Marker
                    position={MALOLOS_TO_SJDM_ROUTE[MALOLOS_TO_SJDM_ROUTE.length - 1]}
                    icon={L.icon({
                        iconUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNlZjQ0NDQiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjwvc3ZnPg==",
                        iconSize: [32, 32],
                        iconAnchor: [16, 16],
                        popupAnchor: [0, -16],
                    })}
                >
                    <Popup>
                        <p className="font-semibold text-red-700">Route End: San Jose del Monte</p>
                    </Popup>
                </Marker>

                {/* Dynamic Jeepney Markers */}
                {Array.from(jeepneyPositionsRef.current.values()).map((telemetry: Telemetry) => {
                    const gpsPosition = parseGPS(telemetry.gps);
                    const jeepney = jeepneyData?.find((j: Jeepney) => j._id === telemetry.jeepneyId);
                    const accel = calculateAcceleration(telemetry.accelX, telemetry.accelY, telemetry.accelZ);
                    const status = determineStatus(telemetry.earValue, accel);
                    const isSelected = selectedJeepneyId === telemetry.jeepneyId;

                    // Create a custom icon with visual feedback for selection
                    const selectedIconHtml = isSelected
                        ? `<div style="background: yellow; border: 3px solid #fbbf24; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(251, 191, 36, 0.8);"><div style="width: 30px; height: 30px; background: url('https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png'); background-size: contain;"></div></div>`
                        : undefined;

                    const iconElement = selectedIconHtml
                        ? L.divIcon({
                            html: selectedIconHtml,
                            className: "custom-marker-icon",
                            iconSize: [50, 50],
                            iconAnchor: [25, 25],
                            popupAnchor: [0, -25],
                        })
                        : jeepneyIcon;

                    return (
                        <Marker
                            key={telemetry.jeepneyId}
                            position={gpsPosition}
                            icon={iconElement}
                            eventHandlers={{
                                click: () => handleMarkerClick(telemetry.jeepneyId),
                            }}
                        >
                            <Popup>
                                <div className="text-sm space-y-1">
                                    <p className="font-semibold text-slate-900">{jeepney?.plateNumber || "Unknown"}</p>
                                    <p className="text-xs text-slate-600">Driver: {jeepney?.driverName || "Unknown"}</p>
                                    <p className="text-xs text-slate-600">Status: {status}</p>
                                    <p className="text-xs text-slate-600">EAR: {telemetry.earValue.toFixed(2)}</p>
                                    <p className="text-xs text-slate-600">Accel: {accel.toFixed(1)} m/s²</p>
                                    {isSelected && (
                                        <p className="text-xs font-semibold text-blue-600 mt-2">📍 Tracking Active</p>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Map Controller for dynamic recentering */}
                <MapController selectedJeepneyId={selectedJeepneyId} selectedPosition={selectedPosition} />
            </MapContainer>

            {/* Selection Panel */}
            {selectedJeepneyId && (
                <div className="absolute right-4 top-4 z-50 rounded-lg border border-blue-200 bg-blue-50 p-4 shadow-lg max-w-xs">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-blue-900">Tracking Jeepney</h3>
                        <button
                            onClick={handleDeselect}
                            className="rounded-lg hover:bg-blue-100 p-1 text-blue-700 transition"
                            aria-label="Stop tracking"
                        >
                            <X size={18} />
                        </button>
                    </div>
                    {jeepneyPositionsRef.current.get(selectedJeepneyId) && (
                        <div className="space-y-2 text-sm">
                            <div>
                                <p className="text-xs text-blue-700 font-semibold">VEHICLE</p>
                                <p className="text-blue-900">
                                    {jeepneyData?.find((j) => j._id === selectedJeepneyId)?.plateNumber || "Unknown"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-700 font-semibold">DRIVER</p>
                                <p className="text-blue-900">
                                    {jeepneyData?.find((j) => j._id === selectedJeepneyId)?.driverName || "Unknown"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-700 font-semibold">COORDINATES</p>
                                <p className="font-mono text-xs text-blue-900">
                                    {selectedPosition ? `${selectedPosition[0].toFixed(4)}, ${selectedPosition[1].toFixed(4)}` : "..."}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-blue-700 font-semibold">STATUS</p>
                                {jeepneyPositionsRef.current.get(selectedJeepneyId) && (
                                    <p className="text-blue-900">
                                        {determineStatus(
                                            jeepneyPositionsRef.current.get(selectedJeepneyId)!.earValue,
                                            calculateAcceleration(
                                                jeepneyPositionsRef.current.get(selectedJeepneyId)!.accelX,
                                                jeepneyPositionsRef.current.get(selectedJeepneyId)!.accelY,
                                                jeepneyPositionsRef.current.get(selectedJeepneyId)!.accelZ
                                            )
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                    <p className="mt-3 text-xs text-blue-600 italic">Map will center and track this vehicle</p>
                </div>
            )}
        </div>
    );
}
