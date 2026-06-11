import { Job, Team, Truck, Driver, Crew, FuelConfig } from "./types";
import { loadFrac, isSplitParent, jobTrucks, jobCrew, teamCap, teamDayAvailable, twS, toS, jobBuffer, normSize, initials, uid, teamFuelWeight, loadMins } from "./utils";
import { tmins, hubMins, kmAddr, hubKm, kmz, outsourceTripCost, dz, zmins } from "./routing";

const CONVOY_GRACE = 20;
const OFFLOAD_MINS = 15;

export function syncPortions(jobs: Job[], defaultBuf: number): Job[] {
  // drop orphaned portions (parent removed, cancelled, or no longer splittable)
  let updatedJobs = jobs.filter(j => {
    if (!j._portionOf) return true;
    const p = jobs.find(x => x._id === j._portionOf);
    return p && jobTrucks(p) > 1 && p.split !== false && p.status !== 'cancelled';
  });

  const parents = updatedJobs.filter(p => isSplitParent(p) && p.status !== 'cancelled');
  
  parents.forEach(p => {
    const N = jobTrucks(p);
    let parts = updatedJobs.filter(j => j._portionOf === p._id);
    
    if (parts.length > N) {
      const rm = parts.slice(N);
      updatedJobs = updatedJobs.filter(j => !rm.includes(j));
    } else if (parts.length < N) {
      for (let i = parts.length; i < N; i++) {
        updatedJobs.push({
          _id: uid(),
          _portionOf: p._id,
          order_no: p.order_no,
          client: p.client,
          address: p.address,
          notes: p.notes || '',
          phone: p.phone || '',
          venue_type: p.venue_type || '',
          date: p.date,
          time_window: p.time_window,
          type: p.type,
          size: 'XL',
          trucks: 1,
          crew: Math.max(1, Math.round(jobCrew(p) / N)),
          setup_mins: p.setup_mins,
          buffer_mins: p.buffer_mins,
          _customSetup: p._customSetup,
          _customBuf: p._customBuf,
          linked_order: '',
          continuity: '',
          split_note: '',
          team_id: null,
          status: 'active',
          _tr: undefined,
          _buf: undefined,
          _bufOk: true,
          _backhaul: false
        });
      }
    }
    
    // refresh shared fields + portion indices
    const baseT = twS(p.time_window);
    const su = p.setup_mins || 60;
    const step = N > 1 ? Math.max(5, Math.floor(su / N)) : 0;
    
    updatedJobs.filter(j => j._portionOf === p._id).forEach((pt, i) => {
      pt.address = p.address;
      pt.client = p.client;
      pt.type = p.type;
      pt.date = p.date;
      const convoyObj = (p as any).convoy || {};
      const _ce = convoyObj['P:' + i] || {};
      
      pt.time_window = _ce.arrive ? _ce.arrive : ((baseT != null) ? toS(baseT + i * step) : p.time_window);
      const _arr = twS(pt.time_window);
      const _isLead = (i === 0);
      const _lv = (_ce.leave != null) ? _ce.leave : !_isLead;
      const _free = (_ce.freeAt && twS(_ce.freeAt) != null) ? twS(_ce.freeAt) : (_lv && _arr != null ? _arr + OFFLOAD_MINS : null);
      
      pt.setup_mins = _isLead ? su : (_lv ? ((_free != null && _arr != null && _free > _arr) ? (_free - _arr) : OFFLOAD_MINS) : Math.max(10, su - i * step));
      pt.buffer_mins = p.buffer_mins;
      pt._portionIdx = i;
      pt._portionCount = N;
      pt.order_no = p.order_no;
      pt.items = `— load ${i + 1}/${N}`;
      pt.status = p.status;
      pt.phone = p.phone || '';
      pt.notes = p.notes || '';
      pt.venue_type = p.venue_type || '';
    });
  });

  return updatedJobs;
}

export function computeRuns(jobs: Job[], cap: number): any[] {
  const runs: any[] = [];
  let cur: any = null;
  
  const start = () => {
    cur = { jobs: [], delLoad: 0, colLoad: 0, hasCol: false, trucks: 1, crew: 2 };
    runs.push(cur);
  };
  
  for (const j of jobs) {
    const isC = j.type.toLowerCase() === 'collection';
    const need = jobTrucks(j);
    
    if (need > 1) {
      const run = { jobs: [j], delLoad: isC ? 0 : 1, colLoad: isC ? 1 : 0, hasCol: isC, trucks: need, crew: jobCrew(j), multi: true };
      runs.push(run);
      cur = null;
      continue;
    }
    
    const f = loadFrac(j.size);
    if (!cur) start();
    
    if (isC) {
      if (cur.jobs.length && cur.colLoad + f > cap + 1e-6) start();
      cur.colLoad += f;
      cur.hasCol = true;
      cur.jobs.push(j);
    } else {
      if (cur.jobs.length && (cur.hasCol || cur.delLoad + f > cap + 1e-6)) start();
      cur.delLoad += f;
      cur.jobs.push(j);
    }
  }
  return runs;
}

export function allocateConvoyHelpers(jobs: Job[], trucks: Truck[], teams: Team[], drivers: Driver[], crew: Crew[], ds: string): void {
  const convoys = jobs.filter(j => j.date === ds && j.status !== 'cancelled' && jobTrucks(j) > 1 && j.split === false)
    .sort((a, b) => (twS(a.time_window) ?? 9999) - (twS(b.time_window) ?? 9999));
    
  const usageTruck: Record<string, [number, number][]> = {};
  const usageTeam: Record<string, [number, number][]> = {};
  
  const usageDelay = (arr: [number, number][], s: number) => {
    let d = 0;
    (arr || []).forEach(([a, b]) => {
      if (a < s + CONVOY_GRACE && b > s) d = Math.max(d, b - s);
    });
    return d;
  };

  function teamDelay(team: Team, s: number, e: number, site: string): number | null {
    let late = usageDelay(usageTeam[team.id], s);
    if (late > CONVOY_GRACE) return null;
    
    for (const j2 of jobs) {
      if (j2.date !== ds || j2.status === 'cancelled' || j2.team_id !== team.id) continue;
      const js = twS(j2.time_window);
      if (js == null) continue;
      const je = js + (j2.setup_mins || 60);
      if (js >= e) continue;
      if (js >= s) return null;
      const arr = je + tmins(j2.address, site);
      if (arr > s + CONVOY_GRACE) return null;
      late = Math.max(late, Math.max(0, arr - s));
    }
    return late;
  }

  function truckDelay(tr: Truck, s: number): number | null {
    const late = usageDelay(usageTruck[tr.id], s);
    return late > CONVOY_GRACE ? null : late;
  }

  convoys.forEach(j => {
    const convoyEdits = (j as any).convoy || {};
    const portion = Math.max(0.1, loadFrac(j.size));
    const N = jobTrucks(j);
    
    const cover = (tr: Truck | null | undefined) => {
      if (!tr) return 0;
      return Math.max(0, Math.floor((teamCap({ truckId: tr.id } as Team, trucks) + 1e-9) / portion));
    };
    
    const leaderTeam = teams.find(z => z.id === j.team_id);
    const leaderTr = leaderTeam ? trucks.find(t => t.id === leaderTeam.truckId) : null;
    let need = N - cover(leaderTr);
    
    const usedTr: Record<string, number> = {};
    const s = twS(j.time_window) ?? 0;
    const setupEnd = s + (j.setup_mins || 60) + hubMins(j.address);
    const e = setupEnd;
    
    const arrOf = (key: string, def: number) => {
      const c = convoyEdits[key];
      if (c && c.arrive) {
        const a = twS(c.arrive);
        if (a != null) return a;
      }
      return def;
    };
    
    const effLeave = (key: string, isLeader: boolean) => {
      const c = convoyEdits[key];
      return (c && c.leave != null) ? c.leave : !isLeader;
    };
    
    const effFree = (key: string, isLeader: boolean, arriveM: number) => {
      const c = convoyEdits[key];
      if (c && c.freeAt) {
        const f = twS(c.freeAt);
        if (f != null) return f;
      }
      return effLeave(key, isLeader) ? (arriveM + OFFLOAD_MINS) : null;
    };
    
    const winEnd = (key: string, isLeader: boolean, arriveM: number) => {
      const f = effFree(key, isLeader, arriveM);
      return (effLeave(key, isLeader) && f != null) ? f : setupEnd;
    };
    
    const helpers: any[] = [];
    const cands = teams.filter(tm => tm.id !== j.team_id && teamDayAvailable(tm, ds, drivers, trucks) && cover(trucks.find(t => t.id === tm.truckId)) > 0)
      .map(tm => ({ tm, late: teamDelay(tm, s, e, j.address), cov: cover(trucks.find(t => t.id === tm.truckId)) }))
      .filter((c): c is { tm: Team; late: number; cov: number } => c.late !== null)
      .sort((a, b) => ((a.tm.outsourced ? 1 : 0) - (b.tm.outsourced ? 1 : 0)) || (a.late - b.late));
      
    for (const c of cands) {
      if (need <= 0) break;
      const tr = trucks.find(t => t.id === c.tm.truckId);
      const key = 'T:' + c.tm.id;
      helpers.push({ kind: 'team', tid: c.tm.id, label: c.tm.label, truck: tr, late: Math.round(c.late), cover: c.cov, key: key });
      if (tr) usedTr[tr.id] = 1;
      const _a = arrOf(key, s + c.late);
      (usageTeam[c.tm.id] = usageTeam[c.tm.id] || []).push([_a, winEnd(key, false, _a)]);
      need -= c.cov;
    }
    
    const tcands = trucks.filter(tr => tr.outsourced && !usedTr[tr.id] && cover(tr) > 0)
      .map(tr => ({ tr, late: truckDelay(tr, s), cov: cover(tr) }))
      .filter((c): c is { tr: Truck; late: number; cov: number } => c.late !== null)
      .sort((a, b) => (b.cov - a.cov) || (a.late - b.late));
      
    for (const c of tcands) {
      if (need <= 0) break;
      const key = 'K:' + c.tr.id;
      helpers.push({ kind: 'truck', label: c.tr.plate, truck: c.tr, late: Math.round(c.late), cover: c.cov, key: key });
      usedTr[c.tr.id] = 1;
      const _a = arrOf(key, s + c.late);
      (usageTruck[c.tr.id] = usageTruck[c.tr.id] || []).push([_a, winEnd(key, false, _a)]);
      need -= c.cov;
    }
    
    (j as any)._helpers = helpers;
    (j as any)._helperShort = Math.max(0, need);
    (j as any)._helperInhouse = helpers.filter(h => h.kind === 'team').length;
    (j as any)._helperOut = helpers.filter(h => h.kind === 'truck').length;
    (j as any)._leaderUnfit = cover(leaderTr) < 1;
    
    const roster: any[] = [];
    if (leaderTeam) {
      const aL = arrOf('L', s);
      roster.push({ key: 'L', role: 'leader', label: leaderTeam.label, truck: leaderTr, cover: cover(leaderTr), arrive: aL, leave: effLeave('L', true), freeAt: effFree('L', true, aL), dcab: !!(leaderTr && leaderTr.doubleCab) });
    }
    helpers.forEach(h => {
      const aH = arrOf(h.key, s + h.late);
      roster.push({ key: h.key, role: 'helper', label: h.label, truck: h.truck, cover: h.cover, arrive: aH, leave: effLeave(h.key, false), freeAt: effFree(h.key, false, aH), dcab: !!(h.truck && h.truck.doubleCab) });
    });
    (j as any)._convoyRoster = roster;
    (j as any)._setupEnd = setupEnd;
  });
}

export function recalcDate(jobs: Job[], teams: Team[], trucks: Truck[], drivers: Driver[], crew: Crew[], defaultBuf: number, fuelConfig: FuelConfig, ds: string): any[] {
  allocateConvoyHelpers(jobs, trucks, teams, drivers, crew, ds);
  const views: any[] = [];
  
  for (const team of teams) {
    const teamJobs = jobs.filter(j => j.date === ds && j.team_id === team.id && j.status !== 'cancelled')
      .sort((a, b) => (twS(a.time_window) ?? 9999) - (twS(b.time_window) ?? 9999));
      
    if (!teamJobs.length) continue;
    
    const _ovr = [...new Set(teamJobs.map(j => (j as any).truckOverride).filter(Boolean))];
    const _effTruck = _ovr.length === 1 ? trucks.find(t => t.id === _ovr[0]) : trucks.find(t => t.id === team.truckId);
    const cap = _ovr.length ? teamCap({ truckId: _effTruck?.id } as Team, trucks) : teamCap(team, trucks);
    const runs = computeRuns(teamJobs, cap);
    let km = 0, warns = 0, totalOut = 0, totalBack = 0;
    
    runs.forEach(run => {
      const rj = run.jobs;
      run.departMin = hubMins(rj[0].address);
      run.returnMin = hubMins(rj[rj.length - 1].address);
      run.departKm = hubKm(rj[0].address);
      run.returnKm = hubKm(rj[rj.length - 1].address);
      let rkm = run.departKm + run.returnKm;
      
      rj.forEach((j: any, i: number) => {
        if (i === 0) {
          j._tr = null; j._buf = null; j._bufOk = true; j._trKm = null;
        } else {
          const prev = rj[i - 1];
          const pe = (twS(prev.time_window) ?? 0) + (prev.setup_mins || 60);
          const cs = twS(j.time_window) ?? 0;
          const dr = tmins(prev.address, j.address);
          const sp = cs - pe - dr;
          const need = jobBuffer(j, defaultBuf);
          j._tr = dr; j._buf = sp; j._bufOk = sp >= need; j._need = need;
          j._trKm = kmAddr(prev.address, j.address);
          if (!j._bufOk) warns++;
          rkm += j._trKm;
        }
      });
      run.km = rkm; km += rkm;
      run.over = !run.multi && ((run.delLoad > cap + 1e-6) || (run.colLoad > cap + 1e-6));
      run._truck = (run.jobs.find((j: any) => j.truckOverride) && trucks.find(t => t.id === run.jobs.find((j: any) => j.truckOverride).truckOverride)) || trucks.find(t => t.id === team.truckId) || null;
      totalOut += run.delLoad; totalBack += run.colLoad;
    });
    
    let clashes = 0, _ld = 0;
    teamJobs.forEach((j: any, i: number) => {
      if (i === 0) {
        j._teamClash = false; j._teamClashMin = 0; _ld = nextLoad(0, j, cap); return;
      }
      const prev = teamJobs[i - 1];
      const need = (twS(prev.time_window) ?? 0) + (prev.setup_mins || 60) + transitMins(prev, j, _ld, cap);
      const short = need - (twS(j.time_window) ?? 0);
      j._teamClash = short > 1e-6; j._teamClashMin = Math.max(0, Math.round(short));
      if (j._teamClash) clashes++;
      _ld = nextLoad(_ld, j, cap);
    });
    
    const byZone: Record<string, { d: number; c: number; jobs: Job[] }> = {};
    teamJobs.forEach(j => {
      const z = dz(j.address);
      byZone[z] = byZone[z] || { d: 0, c: 0, jobs: [] };
      if (j.type.toLowerCase() === 'collection') byZone[z].c++; else byZone[z].d++;
      byZone[z].jobs.push(j);
    });
    teamJobs.forEach((j: any) => j._backhaul = false);
    let backhauls = 0;
    
    Object.entries(byZone).forEach(([z, info]) => {
      if (info.d > 0 && info.c > 0 && zmins('dic', z) >= 30) {
        info.jobs.forEach((j: any) => j._backhaul = true);
        backhauls++;
      }
    });
    
    const last = teamJobs[teamJobs.length - 1];
    const st = (teamJobs[0].time_window || '').split('-')[0].trim() || '--:--';
    const et = toS((twS(last.time_window) ?? 0) + (last.setup_mins || 60));
    
    views.push({
      team,
      jobs: teamJobs,
      runs,
      nRuns: runs.length,
      st, et, km, warns,
      out: totalOut,
      back: totalBack,
      totalOut, totalBack,
      cap,
      backhauls,
      clashes
    });
  }
  return views;
}

export function isColJob(j: Job): boolean {
  return String(j && j.type || '').toLowerCase() === 'collection';
}

export function nextLoad(load: number, j: Job, cap?: number): number {
  const resolvedCap = cap == null ? 1 : cap;
  if (!isColJob(j)) return 0;
  const cf = loadFrac(j.size);
  return (load + cf > resolvedCap + 1e-6) ? cf : load + cf;
}

export function transitMins(p: Job, c: Job, load: number, cap?: number): number {
  const resolvedCap = cap == null ? 1 : cap;
  const direct = tmins(p.address, c.address);
  let warehouse = false;
  
  if (!isColJob(c)) {
    warehouse = isColJob(p) || (loadFrac(p.size) + loadFrac(c.size) > resolvedCap + 1e-6);
  } else {
    warehouse = (load + loadFrac(c.size) > resolvedCap + 1e-6);
  }
  
  return warehouse ? Math.max(direct, hubMins(p.address) + loadMins(c.size) + hubMins(c.address)) : direct;
}

export function clashShortfall(jobsList: Job[], job: Job, cap?: number): number {
  const resolvedCap = cap == null ? 1 : cap;
  const ns = twS(job.time_window);
  if (ns == null) return 0;
  
  const arr = jobsList.filter(x => twS(x.time_window) != null).concat([job])
    .sort((a, b) => (twS(a.time_window) ?? 0) - (twS(b.time_window) ?? 0));
    
  let worst = 0;
  let _ld = arr.length ? nextLoad(0, arr[0], resolvedCap) : 0;
  
  for (let i = 1; i < arr.length; i++) {
    const p = arr[i - 1], cu = arr[i];
    const deficit = ((twS(p.time_window) ?? 0) + (p.setup_mins || 60) + transitMins(p, cu, _ld, resolvedCap)) - (twS(cu.time_window) ?? 0);
    if (deficit > worst) worst = deficit;
    _ld = nextLoad(_ld, cu, resolvedCap);
  }
  return worst;
}

export function teamClashCount(jobsList: Job[], cap?: number): number {
  const resolvedCap = cap == null ? 1 : cap;
  const arr = jobsList.filter(x => twS(x.time_window) != null)
    .sort((a, b) => (twS(a.time_window) ?? 0) - (twS(b.time_window) ?? 0));
    
  let c = 0;
  let _ld = arr.length ? nextLoad(0, arr[0], resolvedCap) : 0;
  
  for (let i = 1; i < arr.length; i++) {
    const p = arr[i - 1], cu = arr[i];
    if ((twS(cu.time_window) ?? 0) < (twS(p.time_window) ?? 0) + (p.setup_mins || 60) + transitMins(p, cu, _ld, resolvedCap) - 1e-6) c++;
    _ld = nextLoad(_ld, cu, resolvedCap);
  }
  return c;
}

export function optimiseAssignment(teams: Team[], inPlay: Job[], trucks: Truck[], fuelConfig: FuelConfig, defaultBuf: number): void {
  const CLASH = 100000, BUF = 6, TRIP = 8, ACTIVATE = 45;
  const _t0 = Date.now(), BUDGET = 1500;
  const timeUp = () => Date.now() - _t0 > BUDGET;
  
  function tcost(tm: Team & { jobsList: Job[]; cap: number }): number {
    const list = tm.jobsList;
    if (!list.length) return 0;
    const cap = tm.cap || 1;
    const arr = list.filter(x => twS(x.time_window) != null).sort((a, b) => (twS(a.time_window) ?? 0) - (twS(b.time_window) ?? 0));
    let clash = 0, buf = 0;
    let _ld = arr.length ? nextLoad(0, arr[0], cap) : 0;
    
    for (let i = 1; i < arr.length; i++) {
      const p = arr[i - 1], c = arr[i];
      const slack = (twS(c.time_window) ?? 0) - ((twS(p.time_window) ?? 0) + (p.setup_mins || 60) + transitMins(p, c, _ld, cap));
      if (slack < -1e-6) clash++;
      else {
        const nb = jobBuffer(c, defaultBuf);
        if (slack < nb) buf += (nb - slack);
      }
      _ld = nextLoad(_ld, c, cap);
    }
    
    const sorted = list.slice().sort((a, b) => (twS(a.time_window) ?? 9999) - (twS(b.time_window) ?? 9999));
    const runs = computeRuns(sorted, cap);
    let km = 0, overC = 0;
    
    runs.forEach(r => {
      const rj = r.jobs;
      km += hubKm(rj[0].address) + hubKm(rj[rj.length - 1].address);
      for (let i = 1; i < rj.length; i++) km += kmAddr(rj[i - 1].address, rj[i].address);
      if (!r.multi && (r.delLoad > cap + 1e-6 || r.colLoad > cap + 1e-6)) overC++;
      if (r.multi && cap < loadFrac(rj[0].size) - 1e-6) overC++;
    });
    
    const hireC = tm.outsourced ? runs.reduce((x, r) => x + Math.round(outsourceTripCost(r.jobs[0].address) * 0.9), 0) : 0;
    const fw = tm.outsourced ? 1 : teamFuelWeight(tm, trucks, fuelConfig);
    const _dcabPen = (runs.some(r => r.multi) && !((trucks.find(t => t.id === tm.truckId) || {} as Truck).doubleCab)) ? 25 : 0;
    
    return CLASH * clash + km * fw + BUF * buf + TRIP * runs.length + overC * 300 + hireC + (list.length ? ACTIVATE : 0) + _dcabPen;
  }
  
  const teamWrappers = teams.map(t => ({
    ...t,
    jobsList: inPlay.filter(j => j.team_id === t.id),
    cap: teamCap(t, trucks),
    _c: 0
  }));
  
  teamWrappers.forEach(t => t._c = tcost(t));
  
  const total = () => teamWrappers.reduce((s, t) => s + t._c, 0);
  const byNo: Record<string, Job> = {};
  inPlay.forEach(x => { if (x.order_no) byNo[x.order_no] = x; });
  const partner = (j: Job) => {
    if (!j || !j.linked_order) return null;
    const p = byNo[j.linked_order];
    return (p && p !== j) ? p : null;
  };
  
  function localSearch() {
    let guard = 0;
    while (guard++ < 6000) {
      if (timeUp()) return;
      let moved = false;
      
      outer:
      for (const A of teamWrappers) {
        for (const j of A.jobsList) {
          if (j._lockTeam) continue;
          const p0 = partner(j);
          if (p0 && p0._lockTeam) continue;
          const p = (p0 && A.jobsList.includes(p0)) ? p0 : null;
          
          for (const B of teamWrappers) {
            if (B === A) continue;
            const ajl = A.jobsList, bjl = B.jobsList;
            A.jobsList = ajl.filter(x => x !== j && x !== p);
            B.jobsList = p ? bjl.concat([j, p]) : bjl.concat([j]);
            const na = tcost(A), nb = tcost(B);
            
            if ((na + nb) - (A._c + B._c) < -1e-6) {
              A._c = na; B._c = nb;
              j.team_id = B.id;
              if (p) p.team_id = B.id;
              moved = true;
              break outer;
            }
            A.jobsList = ajl; B.jobsList = bjl;
          }
        }
      }
      
      if (moved) continue;
      let sw = false;
      
      swap:
      for (let ai = 0; ai < teamWrappers.length; ai++) {
        for (let bi = ai + 1; bi < teamWrappers.length; bi++) {
          const A = teamWrappers[ai], B = teamWrappers[bi];
          for (const ja of A.jobsList) {
            for (const jb of B.jobsList) {
              const pa = partner(ja), pb = partner(jb);
              if (ja._lockTeam || jb._lockTeam || (pa && A.jobsList.includes(pa)) || (pb && B.jobsList.includes(pb))) continue;
              
              A.jobsList = A.jobsList.filter(x => x !== ja).concat([jb]);
              B.jobsList = B.jobsList.filter(x => x !== jb).concat([ja]);
              const na = tcost(A), nb = tcost(B);
              
              if ((na + nb) - (A._c + B._c) < -1e-6) {
                A._c = na; B._c = nb;
                ja.team_id = B.id; jb.team_id = A.id;
                sw = true;
                break swap;
              }
              A.jobsList = A.jobsList.filter(x => x !== jb).concat([ja]);
              B.jobsList = B.jobsList.filter(x => x !== ja).concat([jb]);
            }
          }
        }
      }
      if (!sw) break;
    }
  }
  
  const snap = () => inPlay.map(j => j.team_id);
  const restore = (s: (string | null)[]) => {
    teamWrappers.forEach(t => t.jobsList = []);
    inPlay.forEach((j, i) => {
      j.team_id = s[i];
      const t = teamWrappers.find(x => x.id === j.team_id) || teamWrappers[0];
      t.jobsList.push(j);
    });
    teamWrappers.forEach(t => t._c = tcost(t));
  };
  
  localSearch();
  let best = snap(), bestCost = total();
  let seed = 20260603;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  
  const restarts = inPlay.length > 70 ? 8 : 22;
  for (let r = 0; r < restarts && !timeUp(); r++) {
    const k = 2 + Math.floor(rnd() * 3);
    for (let m = 0; m < k; m++) {
      const j = inPlay[Math.floor(rnd() * inPlay.length)];
      if (!j || j._lockTeam) continue;
      const p0 = partner(j);
      if (p0 && p0._lockTeam) continue;
      
      const A = teamWrappers.find(x => x.id === j.team_id);
      const B = teamWrappers[Math.floor(rnd() * teamWrappers.length)];
      if (A && B && A !== B) {
        const p = p0 && A.jobsList.includes(p0) ? p0 : null;
        A.jobsList = A.jobsList.filter(x => x !== j && x !== p);
        B.jobsList.push(j); j.team_id = B.id;
        if (p) { B.jobsList.push(p); p.team_id = B.id; }
      }
    }
    teamWrappers.forEach(t => t._c = tcost(t));
    localSearch();
    const c = total();
    if (c < bestCost - 1e-9) {
      bestCost = c; best = snap();
    } else {
      restore(best);
    }
  }
  restore(best);
}

export function packDate(
  jobs: Job[],
  teams: Team[],
  trucks: Truck[],
  drivers: Driver[],
  crew: Crew[],
  defaultBuf: number,
  fuelConfig: FuelConfig,
  ds: string
): Job[] {
  if (!teams.length) return jobs;
  
  let updatedJobs = syncPortions(jobs, defaultBuf);
  const activeJobs = updatedJobs.filter(j => j.date === ds && j.status !== 'cancelled' && !isSplitParent(j));
  if (!activeJobs.length) return updatedJobs;
  
  activeJobs.forEach(j => {
    j.continuity = ''; j.split_note = ''; j.team_id = null; j._lockTeam = false; j._unsched = false;
  });
  
  const teamWrappers = teams.filter(t => teamDayAvailable(t, ds, drivers, trucks))
    .map(t => ({ t, cap: teamCap(t, trucks), out: 0, back: 0, zones: new Set<string>(), count: 0, jobsList: [] as Job[] }));
    
  if (!teamWrappers.length) return updatedJobs;

  function place(j: Job) {
    const isC = j.type.toLowerCase() === 'collection';
    const frac = loadFrac(j.size);
    const zone = dz(j.address);
    let bestFit: typeof teamWrappers[0] | null = null;
    let bestTime: typeof teamWrappers[0] | null = null;
    let bsF = -1e9, bsT = -1e9;
    let leastClashTm: typeof teamWrappers[0] | null = null;
    let leastClash = Infinity, lcScore = -1e9;
    
    teamWrappers.forEach(tm => {
      let score = 0;
      if (tm.zones.has(zone)) score += 1000;
      else {
        let near = 1e9;
        tm.zones.forEach(z => { near = Math.min(near, zmins(z, zone)); });
        score -= (near === 1e9 ? 40 : near);
      }
      
      score -= (tm.out + tm.back) * 12;
      score -= tm.count * 3;
      if (tm.t.outsourced) score -= 180;
      
      const dir = isC ? tm.back : tm.out;
      const loadFits = dir + frac <= tm.cap + 1e-6;
      const short = clashShortfall(tm.jobsList, j, tm.cap);
      const timeFits = short <= 1e-6;
      
      if (timeFits && score > bsT) { bsT = score; bestTime = tm; }
      if (timeFits && loadFits && score > bsF) { bsF = score; bestFit = tm; }
      if (short < leastClash - 1e-6 || (Math.abs(short - leastClash) <= 1e-6 && score > lcScore)) {
        leastClash = short; lcScore = score; leastClashTm = tm;
      }
    });
    
    const best = bestFit || bestTime || leastClashTm || teamWrappers[0];
    j.team_id = best.t.id;
    if (isC) best.back += frac; else best.out += frac;
    best.zones.add(zone); best.count++; best.jobsList.push(j);
  }
  
  // 1) linked pairs first, kept together on one team
  const handled = new Set<string>();
  const byOrderNo: Record<string, Job> = {};
  activeJobs.forEach(j => { if (j.order_no) byOrderNo[j.order_no] = j; });
  
  activeJobs.filter(j => j.linked_order && byOrderNo[j.linked_order]).forEach(j => {
    if (handled.has(j._id)) return;
    const lk = byOrderNo[j.linked_order!];
    if (!lk || lk.date !== j.date || handled.has(lk._id)) return;
    const del = j.type.toLowerCase() === 'collection' ? lk : j;
    const col = del === j ? lk : j;
    
    place(del);
    const tm = teamWrappers.find(x => x.t.id === del.team_id);
    if (tm && tm.t.outsourced) {
      handled.add(del._id);
      return;
    }
    
    if (tm) {
      col.team_id = del.team_id;
      tm.back += loadFrac(col.size);
      tm.zones.add(dz(col.address));
      tm.count++;
      tm.jobsList.push(col);
      del.continuity = 'same_team';
      col.continuity = 'same_team';
      handled.add(j._id);
      handled.add(lk._id);
    }
  });
  
  // 1b) CROSS-DATE pairs
  activeJobs.filter(j => !handled.has(j._id) && j.linked_order && !byOrderNo[j.linked_order]).forEach(j => {
    const p = updatedJobs.find(x => !x._portionOf && x.order_no === j.linked_order && x.status !== 'cancelled' && x.team_id && x.date !== ds && !isSplitParent(x));
    if (!p) return;
    const tm = teamWrappers.find(x => x.t.id === p.team_id);
    if (!tm || tm.t.outsourced) return;
    
    const isC = j.type.toLowerCase() === 'collection';
    const f = loadFrac(j.size);
    j.team_id = tm.t.id;
    if (isC) tm.back += f; else tm.out += f;
    tm.zones.add(dz(j.address)); tm.count++; tm.jobsList.push(j);
    j._lockTeam = true; handled.add(j._id);
  });
  
  // 2) place remaining jobs in START-TIME ORDER
  const rest = activeJobs.filter(j => !handled.has(j._id)).sort((a, b) => {
    const sa = twS(a.time_window), sb = twS(b.time_window);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    if (sa !== sb) return sa - sb;
    const ca = a.type.toLowerCase() === 'collection', cb = b.type.toLowerCase() === 'collection';
    if (ca !== cb) return ca ? 1 : -1;
    return loadFrac(b.size) - loadFrac(a.size);
  });
  rest.forEach(place);
  
  // 3) OPTIMISE
  optimiseAssignment(teams, activeJobs, trucks, fuelConfig, defaultBuf);
  
  // 4a) REPATRIATION PASS
  let repGuard = 0, repMoved = true;
  while (repMoved && repGuard++ < 80) {
    repMoved = false;
    for (const tm of teamWrappers) {
      if (!tm.t.outsourced) continue;
      for (const j of [...tm.jobsList]) {
        if (j._lockTeam) continue;
        let home: typeof teamWrappers[0] | null = null;
        for (const ht of teamWrappers) {
          if (ht.t.outsourced) continue;
          if (loadFrac(j.size) > (ht.cap || 1) + 1e-6) continue;
          if (clashShortfall(ht.jobsList, j, ht.cap) <= 1e-6) { home = ht; break; }
        }
        if (home) {
          tm.jobsList = tm.jobsList.filter(x => x !== j);
          home.jobsList.push(j);
          j.team_id = home.t.id;
          repMoved = true;
        }
      }
    }
  }
  
  // 4) HONESTY PASS
  teamWrappers.forEach(tm => {
    let guard = 0;
    while (guard++ < 40) {
      const tj = tm.jobsList.filter(x => twS(x.time_window) != null).sort((a, b) => (twS(a.time_window) ?? 0) - (twS(b.time_window) ?? 0));
      let dropped = false;
      let _ld = tj.length ? nextLoad(0, tj[0], tm.cap) : 0;
      
      for (let i = 1; i < tj.length; i++) {
        const p = tj[i - 1], c = tj[i];
        const _need = (twS(p.time_window) ?? 0) + (p.setup_mins || 60) + transitMins(p, c, _ld, tm.cap);
        _ld = nextLoad(_ld, c, tm.cap);
        if ((twS(c.time_window) ?? 0) + 1e-6 < _need) {
          const drop = (c._lockTeam && !p._lockTeam) ? p : c;
          drop.team_id = null; drop._unsched = true;
          tm.jobsList = tm.jobsList.filter(x => x !== drop);
          dropped = true; break;
        }
      }
      if (!dropped) break;
    }
  });
  
  // recompute continuity against final team assignments
  activeJobs.forEach(j => { j.continuity = ''; j.split_note = ''; });
  activeJobs.filter(j => j.linked_order && byOrderNo[j.linked_order]).forEach(j => {
    const lk = byOrderNo[j.linked_order!];
    if (!lk || lk.date !== j.date) return;
    
    if (!lk.team_id || !j.team_id) {
      // one leg unscheduled
    } else if (lk.team_id === j.team_id) {
      j.continuity = 'same_team'; lk.continuity = 'same_team';
    } else {
      const col = j.type.toLowerCase() === 'collection' ? j : lk;
      const del = col === j ? lk : j;
      col.continuity = 'split_crew'; del.continuity = 'split_crew';
      const dT = teams.find(t => t.id === del.team_id);
      col.split_note = (dT && dT.outsourced)
        ? `Collected in-house to save an outsource trip — coordinate handover with ${dT.label}`
        : 'Other leg handled by a different team — coordinate handover';
    }
  });
  
  // sync team area to its dominant zone label
  teams.forEach(t => {
    const tj = updatedJobs.filter(j => j.date === ds && j.team_id === t.id && j.status !== 'cancelled');
    if (tj.length) {
      t.area = dz(tj[0].address).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    }
  });

  return updatedJobs;
}
