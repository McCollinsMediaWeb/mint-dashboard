import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildFleet, todayStr, twS, teamCap } from "@/lib/utils";
import { AppStateData, Job, Team, Truck } from "@/lib/types";
import { getDistanceKey } from "@/lib/routing";
import { fetchGoogleDistance } from "@/lib/google-maps";
import { computeRuns } from "@/lib/optimizer";

const getDefaultState = (): AppStateData => {
  const fleet = buildFleet();
  return {
    v: 1,
    savedAt: new Date().toISOString(),
    app: "mint-ops",
    selDate: todayStr(),
    jobs: [],
    teams: fleet.teams,
    drivers: fleet.drivers,
    crew: fleet.crew,
    trucks: fleet.trucks,
    venues: [
      { id: "V1", name: "Villa - Small Order", setup: 30 },
      { id: "V2", name: "Villa - Big Order", setup: 90 },
      { id: "V3", name: "Hotel Ballroom - Small Order", setup: 90 },
      { id: "V4", name: "Hotel Ballroom - Big Order", setup: 240 },
      { id: "V5", name: "Exhibition Centre", setup: 120 },
      { id: "V6", name: "Mall", setup: 90 },
      { id: "V7", name: "Restaurant", setup: 60 },
      { id: "V8", name: "Warehouse", setup: 30 },
      { id: "V9", name: "High Rise Building", setup: 120 }
    ],
    def: { del: 60, col: 30, buf: 30 },
    fuel: { dieselAED: 4.33, lPer100: 20 },
    crewRate: 150,
    show: {
      orderNo: true,
      phone: true,
      venue: true,
      items: true,
      notes: true
    },
    distances: {}
  };
};

function extractAllRequiredPairs(payload: AppStateData): { origin: string; dest: string }[] {
  const pairs: { origin: string; dest: string }[] = [];
  const uniquePairs = new Set<string>();

  const addPair = (origin: string, dest: string) => {
    if (!origin || !dest) return;
    const key = `${origin.trim().toLowerCase()}||${dest.trim().toLowerCase()}`;
    if (!uniquePairs.has(key)) {
      uniquePairs.add(key);
      pairs.push({ origin, dest });
    }
  };

  const activeJobs = (payload.jobs || []).filter(j => j.status !== 'cancelled' && j.address);

  // 1. Warehouse to every job address and vice-versa
  activeJobs.forEach(j => {
    addPair('warehouse', j.address);
    addPair(j.address, 'warehouse');
  });

  // 2. Sequential transitions for scheduled runs
  const jobsByDate: Record<string, Job[]> = {};
  activeJobs.forEach(j => {
    if (j.team_id) {
      if (!jobsByDate[j.date]) jobsByDate[j.date] = [];
      jobsByDate[j.date].push(j);
    }
  });

  for (const [ds, dateJobs] of Object.entries(jobsByDate)) {
    for (const team of (payload.teams || [])) {
      const teamJobs = dateJobs.filter(j => j.team_id === team.id);
      if (!teamJobs.length) continue;

      // Sort by time window
      teamJobs.sort((a, b) => (twS(a.time_window) ?? 9999) - (twS(b.time_window) ?? 9999));

      const trucks = payload.trucks || [];
      const _ovr = [...new Set(teamJobs.map(j => (j as any).truckOverride).filter(Boolean))];
      const _effTruck = _ovr.length === 1 ? trucks.find(t => t.id === _ovr[0]) : trucks.find(t => t.id === team.truckId);
      const cap = _ovr.length ? teamCap({ truckId: _effTruck?.id } as Team, trucks) : teamCap(team, trucks);

      try {
        const runs = computeRuns(teamJobs, cap);
        runs.forEach(run => {
          const rj = run.jobs || [];
          for (let i = 1; i < rj.length; i++) {
            addPair(rj[i - 1].address, rj[i].address);
          }
        });
      } catch (err) {
        console.error("Error computing runs for pre-fetching:", err);
      }
    }
  }

  return pairs;
}

export async function GET() {
  try {
    let state = await prisma.appState.findUnique({
      where: { id: 1 }
    });

    if (!state) {
      const initialData = getDefaultState();
      state = await prisma.appState.create({
        data: {
          id: 1,
          data: JSON.stringify(initialData)
        }
      });
    }

    const payload = JSON.parse(state.data);
    return NextResponse.json(payload);
  } catch (error: any) {
    console.error("API GET Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    if (!payload || !payload.app || payload.app !== "mint-ops") {
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    // Update the timestamp
    payload.savedAt = new Date().toISOString();

    // Ensure payload.distances exists
    if (!payload.distances) {
      payload.distances = {};
    }

    // Extract all required origin/destination pairs
    const requiredPairs = extractAllRequiredPairs(payload);
    
    // Find missing pairs not already in cache
    const missingPairs = requiredPairs.filter(p => {
      const key = getDistanceKey(p.origin, p.dest);
      return !payload.distances[key];
    });

    if (missingPairs.length > 0) {
      console.log(`[Google Maps] Fetching ${missingPairs.length} missing distance pairs...`);
      try {
        const results = await Promise.all(
          missingPairs.map(async (p) => {
            const res = await fetchGoogleDistance(p.origin, p.dest);
            return { pair: p, res };
          })
        );

        results.forEach(({ pair, res }) => {
          if (res) {
            const key = getDistanceKey(pair.origin, pair.dest);
            payload.distances[key] = res;
          }
        });
      } catch (err) {
        console.error("Failed to fetch batch distances from Google Maps:", err);
      }
    }

    const state = await prisma.appState.upsert({
      where: { id: 1 },
      update: {
        data: JSON.stringify(payload)
      },
      create: {
        id: 1,
        data: JSON.stringify(payload)
      }
    });

    const savedPayload = JSON.parse(state.data);
    return NextResponse.json(savedPayload);
  } catch (error: any) {
    console.error("API POST Error:", error);
    return NextResponse.json({ error: error.message || "Failed to save state" }, { status: 500 });
  }
}
