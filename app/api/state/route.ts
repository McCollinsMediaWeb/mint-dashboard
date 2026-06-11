import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildFleet, todayStr } from "@/lib/utils";
import { AppStateData } from "@/lib/types";

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
    }
  };
};

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
