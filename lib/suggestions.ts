import { Job, Team, Truck, Driver, Crew, FuelConfig } from "./types";
import { recalcDate, clashShortfall, isColJob, nextLoad, transitMins } from "./optimizer";
import { localISO, toS, twS, isPortion, fmtDur, coreNo, normSize, loadFrac, teamCap, teamLead, teamFuelWeight, truckLPer100, isSplitParent, jobTrucks } from "./utils";
import { dz, hubMins, tmins, zmins, hubKm, outsourceTripCost, fuelPerKm } from "./routing";

export interface Suggestion {
  delta: number;
  icon: string;
  title: string;
  tag: string;
  benefit: string;
  kind: string;
  jid?: string;
  jids?: string[];
  mins?: number;
  target?: string;
  team?: string;
  handover?: string;
  shiftJid?: string | null;
  dates: string[];
}

export function dayCostFor(
  jobs: Job[],
  teams: Team[],
  trucks: Truck[],
  drivers: Driver[],
  crew: Crew[],
  defaultBuf: number,
  fuelConfig: FuelConfig,
  ds: string
): { clash: number; km: number; buf: number; trips: number; hires: number; un: number; cost: number } {
  const views = recalcDate(jobs, teams, trucks, drivers, crew, defaultBuf, fuelConfig, ds);
  let clash = 0, km = 0, buf = 0, trips = 0, hires = 0;
  
  views.forEach(v => {
    clash += v.clashes || 0;
    km += v.km;
    trips += v.nRuns;
    if (v.team.outsourced) hires += v.nRuns;
  });
  
  jobs.filter(j => j.date === ds && j.status !== 'cancelled').forEach(j => {
    if ((j as any)._buf != null && (j as any)._buf >= 0 && (j as any)._need != null && (j as any)._buf < (j as any)._need) {
      buf += ((j as any)._need - (j as any)._buf);
    }
    if (jobTrucks(j) > 1 && j.split === false) {
      hires += ((j as any)._helperOut || 0);
    }
  });
  
  const un = jobs.filter(j => j.date === ds && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id).length;
  
  return {
    clash,
    km,
    buf,
    trips,
    hires,
    un,
    cost: clash * 500 + un * 400 + km + buf * 0.5 + trips * 8 + hires * 60
  };
}

export function sugBenefit(b: any, a: any): string | null {
  if (a.clash > b.clash) return null; // never trade INTO a clash
  const parts: string[] = [];
  
  if (b.clash > a.clash) parts.push(`fixes ${b.clash - a.clash} time clash${b.clash - a.clash > 1 ? 'es' : ''}`);
  if ((b.un || 0) > (a.un || 0)) parts.push(`puts ${b.un - a.un} unscheduled job${b.un - a.un > 1 ? 's' : ''} back on the plan`);
  
  const km = Math.round(b.km - a.km);
  if (km >= 5) parts.push(`saves ~${km} km of driving`);
  if (b.hires > a.hires) parts.push(`saves ${b.hires - a.hires} outsource hire${b.hires - a.hires > 1 ? 's' : ''}`);
  if (b.trips > a.trips) parts.push(`${b.trips - a.trips} fewer warehouse leg${b.trips - a.trips > 1 ? 's' : ''}`);
  
  const bm = Math.round(b.buf - a.buf);
  if (bm >= 10) parts.push(`adds ~${fmtDur(bm)} of breathing room between jobs`);
  
  return parts.length ? parts.join(' · ') : null;
}

export function buildSuggestions(
  jobs: Job[],
  teams: Team[],
  trucks: Truck[],
  drivers: Driver[],
  crew: Crew[],
  defaultBuf: number,
  fuelConfig: FuelConfig,
  ds: string
): Suggestion[] {
  const out: Suggestion[] = [];
  const snap = JSON.stringify(jobs);
  
  const agg = (arr: any[]) => arr.reduce((s, x) => ({
    clash: s.clash + x.clash,
    km: s.km + x.km,
    buf: s.buf + x.buf,
    trips: s.trips + x.trips,
    hires: s.hires + x.hires,
    un: s.un + (x.un || 0),
    cost: s.cost + x.cost
  }), { clash: 0, km: 0, buf: 0, trips: 0, hires: 0, un: 0, cost: 0 });
  
  const evalC = (dates: string[], mut: (tempJobs: Job[]) => void) => {
    const tempJobs1: Job[] = JSON.parse(snap);
    const before = agg(dates.map(d => dayCostFor(tempJobs1, teams, trucks, drivers, crew, defaultBuf, fuelConfig, d)));
    
    const tempJobs2: Job[] = JSON.parse(snap);
    mut(tempJobs2);
    const after = agg(dates.map(d => dayCostFor(tempJobs2, teams, trucks, drivers, crew, defaultBuf, fuelConfig, d)));
    
    return { delta: before.cost - after.cost, before, after };
  };

  const dayJobs = jobs.filter(j => j.date === ds && j.status !== 'cancelled');
  recalcDate(jobs, teams, trucks, drivers, crew, defaultBuf, fuelConfig, ds);

  // A) Ask customer to shift arrival time
  const seen = new Set<string>();
  dayJobs.filter(j => (j as any)._teamClash === true || ((j as any)._buf != null && (j as any)._need != null && (j as any)._buf < (j as any)._need))
    .slice(0, 8).forEach(pj => {
      let target = pj;
      if (isPortion(pj)) {
        const p = jobs.find(x => x._id === pj._portionOf);
        if (p) target = p;
      }
      if (seen.has(target._id)) return;
      seen.add(target._id);
      
      let best: any = null;
      [30, 60, -30, -60, 90].forEach(mins => {
        const r = evalC([ds], (tempJobs) => {
          const tJob = tempJobs.find(x => x._id === target._id);
          if (!tJob) return;
          const t = twS(tJob.time_window);
          if (t == null) return;
          const v = toS(t + mins);
          tJob.time_window = v;
          if (isSplitParent(tJob)) {
            tempJobs.filter(x => x._portionOf === tJob._id).forEach(p => p.time_window = v);
          }
        });
        const txt = sugBenefit(r.before, r.after);
        if (txt && r.delta > 4 && (!best || r.delta > best.delta)) {
          best = { delta: r.delta, txt, mins };
        }
      });
      
      if (best) {
        const t0 = toS(twS(target.time_window));
        const t1 = toS((twS(target.time_window) ?? 0) + best.mins);
        const villa = (target.venue_type || '').toLowerCase().includes('villa');
        out.push({
          delta: best.delta,
          icon: 'ti-clock-edit',
          title: `Ask ${target.client} to move ${target.type.toLowerCase()} ${target.order_no} from ${t0} to ${t1}`,
          tag: villa ? 'Villa — usually flexible' : 'Needs customer OK',
          benefit: best.txt,
          kind: 'shift',
          jid: target._id,
          mins: best.mins,
          dates: [ds]
        });
      }
    });

  // B) Send different team for whole order
  const pairsDone = new Set<string>();
  dayJobs.filter(j => !isPortion(j) && j.linked_order).slice(0, 8).forEach(j => {
    const p = jobs.find(x => !x._portionOf && x.order_no === j.linked_order && x.status !== 'cancelled');
    if (!p) return;
    const key = [j._id, p._id].sort().join('|');
    if (pairsDone.has(key)) return;
    pairsDone.add(key);
    
    const dates = Array.from(new Set([j.date, p.date]));
    let best: any = null;
    
    teams.forEach(t => {
      if (t.id === j.team_id) return;
      const r = evalC(dates, (tempJobs) => {
        const a = tempJobs.find(x => x._id === j._id);
        const b = tempJobs.find(x => x._id === p._id);
        if (a) a.team_id = t.id;
        if (b) b.team_id = t.id;
      });
      const txt = sugBenefit(r.before, r.after);
      if (txt && r.delta > 8 && (!best || r.delta > best.delta)) {
        best = { delta: r.delta, txt, team: t };
      }
    });
    
    if (best) {
      out.push({
        delta: best.delta,
        icon: 'ti-arrows-exchange',
        title: `Send ${best.team.label} instead for MQTN${coreNo(j.order_no)} (delivery + collection)`,
        tag: dates.length > 1 ? 'Checked both days' : 'Same team kept',
        benefit: best.txt,
        kind: 'reteam',
        jids: [j._id, p._id],
        team: best.team.id,
        dates
      });
    }
  });

  // C) Move far-emirate job to day with truck already there
  const week: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(ds + 'T00:00:00');
    d.setDate(d.getDate() + i);
    week.push(localISO(d));
  }
  
  dayJobs.filter(j => j.status !== 'cancelled' && !isPortion(j) && week.includes(j.date) && zmins('dic', dz(j.address)) >= 40)
    .slice(0, 6).forEach(j => {
      const zone = dz(j.address);
      const isColJ = j.type.toLowerCase() === 'collection';
      let pdDate: string | null = null;
      if (isColJ) {
        const pd = jobs.find(x => !x._portionOf && x.order_no === 'D-' + coreNo(j.order_no));
        pdDate = pd ? pd.date : null;
      }
      
      const targets = week.filter(d => d !== j.date &&
        (isColJ ? (!pdDate || d >= pdDate) : (d < j.date)) &&
        jobs.some(x => x._id !== j._id && x.date === d && x.status !== 'cancelled' && !isSplitParent(x) && dz(x.address) === zone)
      );
      
      let best: any = null;
      targets.slice(0, 3).forEach(td => {
        const r = evalC([j.date, td], (tempJobs) => {
          const a = tempJobs.find(x => x._id === j._id);
          if (!a) return;
          a.date = td;
          if (isSplitParent(a)) {
            tempJobs.filter(x => x._portionOf === a._id).forEach(pp => pp.date = td);
          }
        });
        const txt = sugBenefit(r.before, r.after);
        if (txt && r.delta > 30 && (!best || r.delta > best.delta)) {
          best = { delta: r.delta, txt, td };
        }
      });
      
      if (best) {
        const zoneLabel = zone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        out.push({
          delta: best.delta,
          icon: 'ti-calendar-due',
          title: `Move ${j.order_no} (${zoneLabel}) from ${new Date(j.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${new Date(best.td + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          tag: isColJ ? 'After the event — needs customer OK' : 'BEFORE the event — needs customer OK',
          benefit: `a truck is already going to ${zoneLabel} that day — ${best.txt}`,
          kind: 'datemove',
          jid: j._id,
          target: best.td,
          dates: [j.date, best.td]
        });
      }
    });

  // F) Unscheduled Delivery -> earlier
  const addD = (d0: string, n: number) => {
    const d = new Date(d0 + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return localISO(d);
  };
  
  jobs.filter(j => j.date === ds && j.status !== 'cancelled' && !isSplitParent(j) && (j as any)._unsched && j.type.toLowerCase() !== 'collection')
    .slice(0, 4).forEach(u => {
      for (const back of [1, 2]) {
        const td = addD(ds, -back);
        let target: Team | null = null;
        for (const t of teams) {
          const list = jobs.filter(x => x.date === td && x.status !== 'cancelled' && x.team_id === t.id);
          if (clashShortfall(list, Object.assign({}, u, { date: td }), teamCap(t, trucks)) <= 1e-6) {
            target = t;
            break;
          }
        }
        
        if (target) {
          out.push({
            delta: 370,
            icon: 'ti-calendar-minus',
            title: `Deliver ${u.order_no} on ${new Date(td + "T00:00:00").toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} instead — ${back} day${back > 1 ? 's' : ''} BEFORE the event`,
            tag: 'Event date unchanged — needs customer OK',
            benefit: `${target.label} has room on ${new Date(td + "T00:00:00").toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} — puts the job back on the plan. (Deliveries are never moved later.)`,
            kind: 'datemove',
            jid: u._id,
            target: td,
            dates: [ds, td]
          });
          break;
        }
      }
    });

  // E) Rescue unscheduled legs with time nudge
  jobs.filter(j => j.date === ds && j.status !== 'cancelled' && !isSplitParent(j) && (j as any)._unsched).slice(0, 4).forEach(u => {
    const t0 = twS(u.time_window);
    if (t0 == null) return;
    const mate = u.linked_order ? jobs.find(x => !x._portionOf && x.order_no === u.linked_order && x.team_id) : null;
    const mateTeam = mate ? teams.find(t => t.id === mate.team_id) : null;
    const candTeams = (mateTeam && !mateTeam.outsourced) ? [mateTeam] : teams;
    
    for (const mins of [30, 60, 90, -30, 120]) {
      const shifted = Object.assign({}, u, { time_window: toS(t0 + mins) });
      let target: Team | null = null;
      for (const t of candTeams) {
        const list = jobs.filter(x => x.date === ds && x.status !== 'cancelled' && x.team_id === t.id);
        if (clashShortfall(list, shifted, teamCap(t, trucks)) <= 1e-6) {
          target = t;
          break;
        }
      }
      
      if (target) {
        out.push({
          delta: 380,
          icon: 'ti-lifebuoy',
          title: `Ask ${u.client} to move ${u.order_no} from ${toS(t0)} to ${toS(t0 + mins)}`,
          tag: mate ? 'Same team kept — needs customer OK' : 'Unscheduled — needs a new time',
          benefit: `${target.label}${mate ? ' (who handled the other leg)' : ''} can then take it — puts the job back on the plan`,
          kind: 'shift',
          jid: u._id,
          mins: mins,
          dates: [ds]
        });
        break;
      }
    }
  });

  // D) Convoy hiring outsource while in-house is free -> switch to split
  dayJobs.filter(j => !isPortion(j) && jobTrucks(j) > 1 && j.split === false && ((j as any)._helperOut || 0) > 0).forEach(j => {
    const s = twS(j.time_window) ?? 0;
    const e = s + (j.setup_mins || 60) + hubMins(j.address);
    const freeT = teams.filter(t => t.id !== j.team_id && !jobs.some(x => x.date === ds && x.status !== 'cancelled' && x.team_id === t.id && (() => {
      const xs = twS(x.time_window);
      if (xs == null) return false;
      return xs < e && xs + (x.setup_mins || 60) > s;
    })())).length;
    
    if (freeT >= jobTrucks(j) - 1) {
      out.push({
        delta: ((j as any)._helperOut || 0) * 60,
        icon: 'ti-truck',
        title: `Let ${j.order_no}'s trucks arrive separately within its setup window (drop the convoy)`,
        tag: 'Only if loads may arrive separately',
        benefit: `${freeT} in-house teams are free at ${toS(s)} — saves ${(j as any)._helperOut} outsource hire${(j as any)._helperOut > 1 ? 's' : ''}`,
        kind: 'tosplit',
        jid: j._id,
        dates: [ds]
      });
    }
  });

  // G) Right-size: move small order to smaller truck
  const rsDone = new Set<string>();
  dayJobs.filter(j => !isPortion(j) && j.team_id).slice(0, 12).forEach(j => {
    const cur = teams.find(t => t.id === j.team_id);
    if (!cur || cur.outsourced) return;
    const curTr = trucks.find(t => t.id === cur.truckId);
    const curLp = truckLPer100(curTr, fuelConfig);
    const partnerJob = j.linked_order ? jobs.find(x => !x._portionOf && x.order_no === j.linked_order && x.status !== 'cancelled') : null;
    const legs = partnerJob ? [j, partnerJob] : [j];
    
    const key = legs.map(x => x._id).sort().join('|');
    if (rsDone.has(key)) return;
    rsDone.add(key);
    
    const dates = Array.from(new Set(legs.map(x => x.date)));
    let best: any = null;
    
    teams.forEach(t => {
      if (t.outsourced || t.id === cur.id) return;
      const tr = trucks.find(x => x.id === t.truckId);
      const lp = truckLPer100(tr, fuelConfig);
      if (lp >= curLp) return;
      if (legs.some(L => loadFrac(L.size) > teamCap(t, trucks) + 1e-6)) return;
      
      const r = evalC(dates, (tempJobs) => {
        legs.forEach(L => {
          const a = tempJobs.find(x => x._id === L._id);
          if (a) a.team_id = t.id;
        });
      });
      
      if (r.after.clash <= r.before.clash && r.after.un <= r.before.un && r.after.trips <= r.before.trips) {
        let km = 0;
        legs.forEach(L => { km += hubKm(L.address) * 2; });
        const aed = Math.round((curLp - lp) / 100 * km * (fuelConfig.dieselAED || 0));
        if (aed > 0 && (!best || lp < best.lp)) best = { team: t, lp, aed, tr };
      }
    });
    
    if (best) {
      out.push({
        delta: best.aed,
        icon: 'ti-truck-loading',
        title: `Use ${best.team.label} (${best.tr.tonnage || 5}t) for MQTN${coreNo(j.order_no)} — a smaller truck fits this load`,
        tag: 'Lower diesel · same-team kept',
        benefit: `small load for ${cur.label}'s ${(curTr || {} as Truck).tonnage || 5}t truck — ${best.team.label} is free and burns less fuel (~AED ${best.aed} less diesel)`,
        kind: 'reteam',
        jids: legs.map(x => x._id),
        team: best.team.id,
        dates
      });
    }
  });

  // H) Consolidate: two same-day near-time jobs on one truck
  const consDone = new Set<string>();
  const dj = dayJobs.filter(j => !isPortion(j) && j.team_id && twS(j.time_window) != null).slice(0, 12);
  
  for (let a = 0; a < dj.length; a++) {
    for (let b = a + 1; b < dj.length; b++) {
      const A = dj[a], B = dj[b];
      if (A.team_id === B.team_id) continue;
      const ta = twS(A.time_window)!, tb = twS(B.time_window)!;
      if (Math.abs(ta - tb) > 180) continue;
      
      const zA = dz(A.address), zB = dz(B.address);
      const farZ = ['abu_dhabi', 'sharjah', 'ajman'];
      if (farZ.includes(zA) && farZ.includes(zB) && zA !== zB) continue;
      
      const tA = teams.find(t => t.id === A.team_id), tB = teams.find(t => t.id === B.team_id);
      if (!tA || !tB) continue;
      
      const trA = trucks.find(x => x.id === tA.truckId), trB = trucks.find(x => x.id === tB.truckId);
      const host = teamCap(tA, trucks) >= teamCap(tB, trucks) ? tA : tB;
      const hostTr = trucks.find(x => x.id === host.truckId);
      if (loadFrac(A.size) + loadFrac(B.size) > teamCap(host, trucks) + 1e-6) continue;
      
      const other = (host.id === tA.id) ? B : A;
      const key = [A._id, B._id].sort().join('|');
      if (consDone.has(key)) continue;
      
      let best: any = null;
      for (const mins of [0, 30, -30, 60, -60, 90]) {
        const r = evalC([ds], (tempJobs) => {
          const x = tempJobs.find(z => z._id === A._id);
          const y = tempJobs.find(z => z._id === B._id);
          const o = tempJobs.find(z => z._id === other._id);
          if (x) x.team_id = host.id;
          if (y) y.team_id = host.id;
          if (mins !== 0 && o) {
            const t = twS(o.time_window);
            if (t != null) {
              const v = toS(t + mins);
              o.time_window = v;
              if (isSplitParent(o)) {
                tempJobs.filter(p => p._portionOf === o._id).forEach(p => p.time_window = v);
              }
            }
          }
        });
        if (r.after.clash <= r.before.clash && r.after.trips < r.before.trips) {
          if (!best || r.delta > best.delta) best = { delta: r.delta, mins, before: r.before, after: r.after };
        }
      }
      
      if (best) {
        consDone.add(key);
        const oT = twS(other.time_window)!;
        const title = best.mins !== 0
          ? `Ask ${other.client} to move ${other.order_no} from ${toS(oT)} to ${toS(oT + best.mins)} — then ${host.label} does ${A.order_no} & ${B.order_no} in one trip`
          : `Put ${A.order_no} & ${B.order_no} both on ${host.label} — one trip does both`;
          
        out.push({
          delta: (best.delta || 0) + 6,
          icon: 'ti-arrow-merge',
          title: title,
          tag: best.mins !== 0 ? 'Needs customer OK' : 'Same area — one truck',
          benefit: sugBenefit(best.before, best.after) || 'one truck handles both instead of two — 1 fewer warehouse leg',
          kind: 'consolidate',
          jids: [A._id, B._id],
          team: host.id,
          shiftJid: best.mins !== 0 ? other._id : null,
          mins: best.mins,
          dates: [ds]
        });
      }
    }
  }

  // I) Crew-swap handover: collection with nearby visiting team
  const csDone = new Set<string>();
  dayJobs.filter(j => !isPortion(j) && j.team_id && j.type.toLowerCase() === 'collection' && twS(j.time_window) != null)
    .slice(0, 10).forEach(col => {
      const zone = dz(col.address);
      const cur = teams.find(t => t.id === col.team_id);
      if (!cur) return;
      const del = jobs.find(x => !x._portionOf && x.order_no === 'D-' + coreNo(col.order_no));
      const delTeam = (del && teams.find(t => t.id === del.team_id)) || cur;
      const cands = teams.filter(t => !t.outsourced && t.id !== col.team_id &&
        jobs.some(x => x.date === ds && x.status !== 'cancelled' && x.team_id === t.id && !isSplitParent(x) && dz(x.address) === zone));
        
      let best: any = null;
      cands.forEach(t => {
        const tr = trucks.find(x => x.id === t.truckId);
        if (loadFrac(col.size) > teamCap(t, trucks) + 1e-6) return;
        const r = evalC([ds], (tempJobs) => {
          const a = tempJobs.find(x => x._id === col._id);
          if (a) a.team_id = t.id;
        });
        if (r.after.clash <= r.before.clash && r.after.trips <= r.before.trips && (r.before.km - r.after.km) >= 3) {
          if (!best || r.delta > best.delta) best = { team: t, delta: r.delta, before: r.before, after: r.after };
        }
      });
      
      if (best && !csDone.has(col._id)) {
        csDone.add(col._id);
        const lead = teamLead(delTeam, crew, drivers);
        const zoneLabel = zone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        out.push({
          delta: (best.delta || 0) + 4,
          icon: 'ti-users-group',
          title: `Give ${col.order_no} to ${best.team.label} (already in ${zoneLabel}) — send ${lead} along for continuity`,
          tag: 'Crew handover · saves a trip',
          benefit: sugBenefit(best.before, best.after) || `${best.team.label} is already going to ${zoneLabel} — saves ${cur.label} a separate trip`,
          kind: 'crewswap',
          jid: col._id,
          team: best.team.id,
          handover: lead,
          dates: [ds]
        });
      }
    });

  // Cleanup: restore jobs array
  const restored: Job[] = JSON.parse(snap);
  restored.forEach((job, idx) => {
    jobs[idx] = job;
  });

  out.sort((a, b) => b.delta - a.delta);
  return out.slice(0, 8);
}
