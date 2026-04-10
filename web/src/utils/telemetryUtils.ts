import type { LatLngTuple } from "leaflet";

/**
 * Converts degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates the Haversine distance between two GPS coordinates
 * @param coord1 - First coordinate [latitude, longitude]
 * @param coord2 - Second coordinate [latitude, longitude]
 * @returns Distance in meters
 */
export function haversineDistance(coord1: LatLngTuple, coord2: LatLngTuple): number {
  const [lat1, lon1] = coord1;
  const [lat2, lon2] = coord2;
  
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * 
    Math.cos(lat1Rad) * Math.cos(lat2Rad);
    
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

/**
 * Calculates speed in km/h between two telemetry points
 * @param current - Current telemetry reading
 * @param previous - Previous telemetry reading
 * @returns Speed in km/h (or 0 if cannot be calculated)
 */
export function calculateSpeed(
  current: { gps: string; timestamp: number },
  previous: { gps: string; timestamp: number }
): number {
  // Cannot calculate speed with less than 2 points
  if (!current || !previous) {
    return 0;
  }

  try {
    const currentPos = parseGPS(current.gps);
    const previousPos = parseGPS(previous.gps);
    
    // Calculate distance in meters
    const distanceMeters = haversineDistance(currentPos, previousPos);
    
    // Calculate time difference in seconds
    const timeDiffSeconds = (current.timestamp - previous.timestamp) / 1000;
    
    // Avoid division by zero or negative time
    if (timeDiffSeconds <= 0) {
      return 0;
    }
    
    // Speed in m/s, then convert to km/h
    const speedMs = distanceMeters / timeDiffSeconds;
    const speedKmh = speedMs * 3.6;
    
    return speedKmh;
  } catch (error) {
    // Return 0 if parsing fails
    return 0;
  }
}

/**
 * Parses GPS string "lat,lng" into a LatLngTuple
 */
export function parseGPS(gpsString: string): LatLngTuple {
  const [lat, lng] = gpsString.split(",").map((v) => parseFloat(v));
  return [lat || 14.5995, lng || 120.9842]; // Fallback to Metro Manila center
}