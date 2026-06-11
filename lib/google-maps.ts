import { normalizeAddress } from "./routing";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const WAREHOUSE_REAL_ADDRESS = "Dubai Investment Park, Dubai, UAE";

export interface DistanceResult {
  km: number;
  mins: number;
}

export async function fetchGoogleDistance(origin: string, dest: string): Promise<DistanceResult | null> {
  if (!GOOGLE_MAPS_API_KEY) {
    console.warn("GOOGLE_MAPS_API_KEY is not defined. Google Maps API calls will be skipped.");
    return null;
  }

  const oAddr = normalizeAddress(origin) === "warehouse" ? WAREHOUSE_REAL_ADDRESS : origin;
  const dAddr = normalizeAddress(dest) === "warehouse" ? WAREHOUSE_REAL_ADDRESS : dest;

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
      oAddr
    )}&destinations=${encodeURIComponent(dAddr)}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "OK" && data.rows?.[0]?.elements?.[0]?.status === "OK") {
      const element = data.rows[0].elements[0];
      const meters = element.distance.value; // meters
      const seconds = element.duration.value; // seconds

      return {
        km: Math.round(meters / 1000),
        mins: Math.round(seconds / 60)
      };
    } else {
      console.error(
        "Google Maps API error status:",
        data.status,
        data.rows?.[0]?.elements?.[0]?.status,
        data.error_message || ""
      );
      return null;
    }
  } catch (err) {
    console.error("Failed to fetch distance from Google Maps:", err);
    return null;
  }
}
