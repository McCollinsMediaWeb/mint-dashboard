import { Job, Team, Driver, Crew, Truck, Venue, LeavePeriod, FuelConfig } from "./types";
import { SIZE, SizeKey, LOADMIN, MINT_ROSTER, TPAL, DEFAULT_VENUES } from "./constants";

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function esc(s: string | null | undefined): string {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function initials(n: string | null | undefined): string {
  return (n || '?').trim().split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export function teamBadge(label: string | null | undefined): string {
  return String(label || '?').trim().charAt(0).toUpperCase();
}

export function localISO(d: Date): string {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function isoToDMY(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso || '';
  const p = iso.split('-');
  return p[2] + '/' + p[1] + '/' + p[0];
}

export function dmyToISO(s: string | null | undefined): string {
  s = String(s || '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (!m) return '';
  let d = +m[1], mo = +m[2], y = +m[3];
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return '';
  return String(y).padStart(4, '0') + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}

export function todayStr(): string {
  return localISO(new Date());
}

export function coreNo(no: string | null | undefined): string {
  return String(no || '').trim().toUpperCase().replace(/^MQTN[-\s]?/, '').replace(/^([DC])-/, '');
}

export function fmtOrderNo(raw: string | null | undefined, type: string | null | undefined): string {
  const c = coreNo(raw);
  if (!c) return '';
  return (String(type || '').toLowerCase() === 'collection' ? 'C-' : 'D-') + c;
}

export function gen5(): string {
  return String(Math.floor(10000 + Math.random() * 90000));
}

export function autoLinkPairs(jobs: Job[]): void {
  const map: Record<string, Job> = {};
  jobs.forEach(j => {
    if (!j._portionOf && j.order_no) map[j.order_no] = j;
  });
  jobs.forEach(j => {
    if (j._portionOf || j.linked_order) return;
    const m = /^([DC])-(.+)$/.exec(j.order_no || '');
    if (!m) return;
    const other = (m[1] === 'D' ? 'C-' : 'D-') + m[2];
    if (map[other]) {
      j.linked_order = other;
      if (!map[other].linked_order) map[other].linked_order = j.order_no;
    }
  });
}

export function normSize(s: string | null | undefined): SizeKey {
  const normalized = String(s || '').trim().toUpperCase();
  return (SIZE[normalized as SizeKey] ? normalized : 'S') as SizeKey;
}

export function loadMins(sz: string | null | undefined): number {
  return LOADMIN[normSize(sz)] || 15;
}

export function loadFrac(s: string | null | undefined): number {
  return SIZE[normSize(s)].frac;
}

export function venueColSetup(v: Venue | null | undefined): number {
  if (!v) return 30;
  return (v.colSetup != null && v.colSetup !== '') ? +v.colSetup : Math.max(5, Math.round((v.setup || 60) / 2));
}

export function ensureVenues(venues: Venue[]): boolean {
  let changed = false;
  const legacy = venues.find(v => v.name === 'Villa - Small');
  if (legacy && !venues.some(v => v.name === 'Villa - Small Order')) {
    legacy.name = 'Villa - Small Order';
    changed = true;
  }
  DEFAULT_VENUES.forEach(w => {
    if (!venues.some(v => v.name.toLowerCase() === w.name.toLowerCase())) {
      venues.push({ id: 'V' + uid(), name: w.name, setup: w.setup });
      changed = true;
    }
  });
  return changed;
}

export function truckCap(truck: Truck | null | undefined): number {
  if (!truck) return 1;
  let c = (truck.capFrac != null ? truck.capFrac : ((truck.tonnage || 5) / 5));
  if ((truck.tonnage || 5) <= 1 && c < 0.25) c = 0.25;
  return c;
}

export function truckLPer100(tr: Truck | null | undefined, fuelConfig: FuelConfig): number {
  if (!tr) return fuelConfig?.lPer100 || 20;
  if (tr.lPer100 != null && String(tr.lPer100) !== '') return +tr.lPer100;
  const t = tr.tonnage || 5;
  return t <= 1 ? 12 : (t <= 3 ? 16 : (t <= 5 ? 20 : 28));
}

export function teamFuelWeight(team: Team, trucks: Truck[], fuelConfig: FuelConfig): number {
  const tr = trucks.find(t => t.id === (team && team.truckId));
  return truckLPer100(tr, fuelConfig) / 20;
}

export function teamLead(t: Team | null | undefined, crew: Crew[], drivers: Driver[]): string {
  if (!t) return '';
  const c = crew.find(x => x.id === t.crew1Id);
  const d = drivers.find(x => x.id === t.driverId);
  return (c && c.name) || (d && d.name) || t.label;
}

export function teamCap(team: Team, trucks: Truck[]): number {
  return truckCap(trucks.find(t => t.id === team.truckId));
}

export function buildFleet(): { teams: Team[]; drivers: Driver[]; crew: Crew[]; trucks: Truck[] } {
  const teams: Team[] = [];
  const drivers: Driver[] = [];
  const crew: Crew[] = [];
  const trucks: Truck[] = [];

  MINT_ROSTER.forEach((r, i) => {
    const label = r[0], plate = r[1], model = r[2], ton = r[3], drv = r[4], c1 = r[5], c2 = r[6];
    const tid = 'T' + i, did = 'DRV' + i, c1id = 'CR' + i + 'A', c2id = 'CR' + i + 'B', trid = 'TRK' + i;
    const capFrac = ton === 3 ? 0.75 : (ton === 5 ? 1 : (ton === 1 ? 0.25 : (ton / 5)));
    const lp = ton <= 1 ? 12 : (ton <= 3 ? 16 : (ton <= 5 ? 20 : 28));
    
    trucks.push({ id: trid, plate: plate, model: model + ' ' + ton + '-ton', tonnage: ton, capFrac: capFrac, lPer100: lp, outsourced: false });
    drivers.push({ id: did, name: drv, phone: '', role: 'driver', outsourced: false });
    crew.push({ id: c1id, name: c1, outsourced: false });
    crew.push({ id: c2id, name: c2, outsourced: false });
    teams.push({ id: tid, label: label, colorIdx: i % TPAL.length, area: 'Dubai', driverId: did, crew1Id: c1id, crew2Id: c2id, truckId: trid });
  });

  const outsourceList: [string, number][] = [['Asad', 3], ['Ibrar', 5]];
  outsourceList.forEach(([nm, n]) => {
    for (let i = 1; i <= n; i++) {
      const tr = { id: 'TR-' + nm.toUpperCase() + '-' + i, plate: nm.toUpperCase().slice(0, 3) + '-0' + i, model: nm + ' 3-ton (own crew)', tonnage: 3, capFrac: 0.75, lPer100: 16, outsourced: true };
      trucks.push(tr);
      teams.push({ id: 'TO-' + nm + '-' + i, label: nm + ' ' + i, colorIdx: teams.length % TPAL.length, area: 'Dubai', driverId: null, crew1Id: null, crew2Id: null, truckId: tr.id, outsourced: true, supplier: nm });
    }
  });

  for (let i = 1; i <= 10; i++) {
    trucks.push({ id: 'TR-MUS-' + i, plate: 'MUS-' + String(i).padStart(2, '0'), model: 'Mustafa 10-ton (no crew)', tonnage: 10, capFrac: 2, lPer100: 28, outsourced: true, rate: '' });
  }

  return { teams, drivers, crew, trucks };
}

// Convert time window string to minutes since midnight, e.g. "09:00" -> 540
export function toM(s: string | null | undefined): number | null {
  if (!s) return null;
  const p = String(s).trim().split(':');
  if (p.length < 2) return null;
  const h = parseInt(p[0], 10), m = parseInt(p[1], 10);
  return (isNaN(h) || isNaN(m)) ? null : h * 60 + m;
}

// Convert minutes to string "HH:MM"
export function toS(m: number | null | undefined): string {
  if (m === null || m === undefined || isNaN(m)) return '--:--';
  const n = ((m % 1440) + 1440) % 1440;
  return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0');
}

// Format duration, e.g. 90 -> "1h 30m"
export function fmtDur(mins: number): string {
  if (mins < 60) return mins + 'm';
  const h = Math.floor(mins / 60), m = mins % 60;
  return h + 'h' + (m ? ' ' + m + 'm' : '');
}

export function twS(tw: string | null | undefined): number | null {
  return toM((tw || '').split('-')[0].trim());
}

export function parseDt(s: string | null | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

export function fmtLong(s: string): string {
  const d = parseDt(s);
  if (!d) return s;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

export function fmtShort(s: string): string {
  const d = parseDt(s);
  if (!d) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function jobBuffer(j: Job, defaultBuf: number): number {
  return (typeof j.buffer_mins === 'number' && !isNaN(j.buffer_mins)) ? j.buffer_mins : defaultBuf;
}

export function jobTrucks(j: Job): number {
  return Math.max(1, parseInt(j.trucks as any, 10) || 1);
}

export function jobCrew(j: Job): number {
  const c = parseInt(j.crew as any, 10);
  return isNaN(c) ? 2 : c;
}

export function dowOf(ds: string): number {
  return new Date(ds + 'T00:00:00').getDay(); // 0=Sun ... 6=Sat
}

export function resAvailable(r: Driver | Crew | Truck | null | undefined, ds: string): boolean {
  if (!r) return true;
  if (r.active === false) return false;
  if (r.offDay != null && String(r.offDay) !== '' && Number(r.offDay) === dowOf(ds)) return false;
  if (Array.isArray(r.leave)) {
    for (const lv of r.leave) {
      if (lv && lv.from && ds >= lv.from && ds <= (lv.to || lv.from)) return false;
    }
  }
  return true;
}

export function teamDayAvailable(team: Team, ds: string, drivers: Driver[], trucks: Truck[]): boolean {
  if (!team) return false;
  if (team.outsourced) return true;
  const drv = drivers.find(d => d.id === team.driverId);
  const trk = trucks.find(t => t.id === team.truckId);
  if (team.driverId && !resAvailable(drv, ds)) return false;
  if (team.truckId && !resAvailable(trk, ds)) return false;
  return true;
}

export function teamOffReason(team: Team, ds: string, drivers: Driver[], trucks: Truck[]): string {
  if (!team || team.outsourced) return '';
  const drv = drivers.find(d => d.id === team.driverId);
  const trk = trucks.find(t => t.id === team.truckId);
  if (team.driverId && !resAvailable(drv, ds)) return 'driver off';
  if (team.truckId && !resAvailable(trk, ds)) return 'truck off';
  return '';
}

export function teamShortCrew(team: Team, ds: string, crew: Crew[]): number {
  if (!team || team.outsourced) return 0;
  let n = 0;
  const c1 = crew.find(c => c.id === team.crew1Id);
  const c2 = crew.find(c => c.id === team.crew2Id);
  if (team.crew1Id && !resAvailable(c1, ds)) n++;
  if (team.crew2Id && !resAvailable(c2, ds)) n++;
  return n;
}

export function isSplitParent(j: Job): boolean {
  return !j._portionOf && jobTrucks(j) > 1 && j.split !== false;
}

export function isPortion(j: Job): boolean {
  return !!j._portionOf;
}
