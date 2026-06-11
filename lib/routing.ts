import { ZPAT, TM } from "./constants";
import { FuelConfig } from "./types";

export function dz(a: string | null | undefined): string {
  if (!a) return 'downtown';
  const s = a.toLowerCase();
  for (const [p, z] of ZPAT) {
    if (s.includes(p)) return z;
  }
  return 'downtown';
}

export function zmins(z1: string, z2: string): number {
  if (z1 === z2) return 7;
  const r = TM[z1] || TM[z2];
  if (!r) return 25;
  return r[z2] ?? r[z1] ?? 25;
}

export function tmins(a1: string, a2: string): number {
  return zmins(dz(a1), dz(a2));
}

export function hubMins(addr: string): number {
  return zmins('dic', dz(addr));
}

export function kmz(z1: string, z2: string): number {
  // DIC (far SW) is the anchor for mileage
  if (z1 === 'dic' || z2 === 'dic') {
    const other = z1 === 'dic' ? z2 : z1;
    if (other === 'dic') return 5;
    if (other === 'abu_dhabi') return 80;
    if (other === 'sharjah') return 75;
    if (other === 'ajman') return 88;
    return Math.round(zmins('dic', other) * 0.95);
  }
  // intra-zone
  if (z1 === z2) return 5;
  // standard factor else
  return Math.round(zmins(z1, z2) * 0.72);
}

export function kmAddr(a1: string, a2: string): number {
  return kmz(dz(a1), dz(a2));
}

export function outsourceTripCost(addr: string): number {
  return dz(addr) === 'abu_dhabi' ? 350 : 200;
}

export function fuelPerKm(fuelConfig: FuelConfig | null | undefined): number {
  const f = fuelConfig || { dieselAED: 4.33, lPer100: 20 };
  const r = +f.dieselAED || 0, l = +f.lPer100 || 0;
  return r * l / 100;
}

export function hubKm(addr: string): number {
  return kmz('dic', dz(addr));
}

export function kmOf(mins: number): number {
  return Math.round(mins * 0.62);
}
