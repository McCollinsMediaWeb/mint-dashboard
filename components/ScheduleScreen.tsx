import React, { useState, useEffect, useRef } from "react";
import { Job, Team, Truck, Driver, Crew, Venue, AppDefaults, FuelConfig, ShowPreferences } from "@/lib/types";
import { todayStr, localISO, toS, twS, isSplitParent, isPortion, fmtDur, jobBuffer, jobTrucks, jobCrew, teamCap, teamOffReason, teamShortCrew, teamDayAvailable, teamLead, initials, teamFuelWeight, truckLPer100, normSize, coreNo, esc, resAvailable, loadMins } from "@/lib/utils";
import { recalcDate, packDate } from "@/lib/optimizer";
import { dz, hubMins, tmins, zmins, hubKm, outsourceTripCost, fuelPerKm, kmOf } from "@/lib/routing";
import { parseCSV, normOrder, genSampleOrders } from "@/lib/csv";
import CalendarPanel from "./CalendarPanel";
import AddOrderForm from "./AddOrderForm";
import SuggestionsModal from "./SuggestionsModal";
import OutCostModal from "./OutCostModal";
import { buildSuggestions, Suggestion } from "@/lib/suggestions";
import { TPAL, HUB, SIZE } from "@/lib/constants";

const OFFLOAD_MINS = 15;

interface ScheduleScreenProps {
  jobs: Job[];
  teams: Team[];
  trucks: Truck[];
  drivers: Driver[];
  crew: Crew[];
  venues: Venue[];
  defaults: AppDefaults;
  fuelConfig: FuelConfig;
  crewRate: number;
  showPrefs: ShowPreferences;
  selDate: string;
  setSelDate: (date: string) => void;
  onUpdateJobs: (updatedJobs: Job[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  onOpenOrderDetails: (jobId: string) => void;
}

export default function ScheduleScreen({
  jobs,
  teams,
  trucks,
  drivers,
  crew,
  venues,
  defaults,
  fuelConfig,
  crewRate,
  showPrefs,
  selDate,
  setSelDate,
  onUpdateJobs,
  onUndo,
  canUndo,
  onOpenOrderDetails
}: ScheduleScreenProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [wkOff, setWkOff] = useState(0);
  const [showLegend, setShowLegend] = useState(false);
  const [tlView, setTlView] = useState(false);
  const [activeTid, setActiveTid] = useState<string | null>(null);
  const [convoyOpen, setConvoyOpen] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [sugModalOpen, setSugModalOpen] = useState(false);
  const [outCostModalOpen, setOutCostModalOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close more menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Compute views for selected date
  const views = selDate ? recalcDate(jobs, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate) : [];
  const dateJobs = jobs.filter(j => j.date === selDate && !isSplitParent(j));
  const activeJobs = dateJobs.filter(j => j.status !== 'cancelled');

  // Sync activeTid to first team if not selected
  useEffect(() => {
    if (views.length > 0 && (!activeTid || !views.find(v => v.team.id === activeTid))) {
      setActiveTid(views[0].team.id);
    }
  }, [views, activeTid]);

  // Handle suggestion modal open
  const handleOpenSuggestions = () => {
    if (!selDate) return;
    const sugs = buildSuggestions(jobs, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
    setSuggestions(sugs);
    setSugModalOpen(true);
  };

  const handleApplySuggestion = (sug: Suggestion) => {
    let updated = [...jobs];
    
    if (sug.kind === "shift" && sug.jid && sug.mins !== undefined) {
      updated = updated.map(j => {
        if (j._id === sug.jid) {
          const t = twS(j.time_window);
          if (t != null) {
            const newTw = toS(t + sug.mins!);
            const upd = { ...j, time_window: newTw };
            if (isSplitParent(upd)) {
              // portions will update in packDate
            }
            return upd;
          }
        }
        return j;
      });
    } else if (sug.kind === "reteam" && sug.jids && sug.team) {
      updated = updated.map(j => {
        if (sug.jids!.includes(j._id)) {
          return { ...j, team_id: sug.team! };
        }
        return j;
      });
    } else if (sug.kind === "datemove" && sug.jid && sug.target) {
      updated = updated.map(j => {
        if (j._id === sug.jid) {
          return { ...j, date: sug.target!, team_id: null };
        }
        return j;
      });
    } else if (sug.kind === "tosplit" && sug.jid) {
      updated = updated.map(j => {
        if (j._id === sug.jid) {
          return { ...j, split: true };
        }
        return j;
      });
    } else if (sug.kind === "consolidate" && sug.jids && sug.team) {
      updated = updated.map(j => {
        if (sug.jids!.includes(j._id)) {
          let updatedJob = { ...j, team_id: sug.team! };
          if (sug.shiftJid && j._id === sug.shiftJid && sug.mins !== undefined) {
            const t = twS(j.time_window);
            if (t != null) {
              updatedJob.time_window = toS(t + sug.mins!);
            }
          }
          return updatedJob;
        }
        return j;
      });
    } else if (sug.kind === "crewswap" && sug.jid && sug.team) {
      updated = updated.map(j => {
        if (j._id === sug.jid) {
          return { ...j, team_id: sug.team! };
        }
        return j;
      });
    }

    // Pack affected dates
    sug.dates.forEach(d => {
      updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, d);
    });

    onUpdateJobs(updated);
    setSugModalOpen(false);
  };

  // Autopack triggers
  const handleAutopack = () => {
    setIsProcessing(true);
    setTimeout(() => {
      let updated = [...jobs];
      updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
      onUpdateJobs(updated);
      setIsProcessing(false);
    }, 400);
  };

  // Import CSV handler
  const handleCSVImport = (text: string) => {
    setIsProcessing(true);
    setTimeout(() => {
      const rawOrders = parseCSV(text);
      if (rawOrders.length === 0) {
        setIsProcessing(false);
        alert("Could not parse any valid opportunity lines from this CSV.");
        return;
      }
      const defDate = selDate || todayStr();
      let normalized = rawOrders.map(o => normOrder(o, defDate, venues, defaults));
      
      // Auto pack
      const dates = Array.from(new Set(normalized.map(j => j.date))).sort();
      dates.forEach(d => {
        normalized = packDate(normalized, teams, trucks, drivers, crew, defaults.buf, fuelConfig, d);
      });

      if (dates.length > 0) {
        setSelDate(dates[0]);
      }
      
      onUpdateJobs(normalized);
      setIsProcessing(false);
    }, 400);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      if (ev.target?.result) {
        handleCSVImport(ev.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadDemo = () => {
    setIsProcessing(true);
    setMoreMenuOpen(false);
    setTimeout(() => {
      const demoRaw = genSampleOrders();
      let normalized = demoRaw.map(o => normOrder(o, "2026-06-11", venues, defaults));
      
      const dates = Array.from(new Set(normalized.map(j => j.date))).sort();
      dates.forEach(d => {
        normalized = packDate(normalized, teams, trucks, drivers, crew, defaults.buf, fuelConfig, d);
      });

      setSelDate("2026-06-11");
      onUpdateJobs(normalized);
      setIsProcessing(false);
    }, 400);
  };

  const handleClearAll = () => {
    setMoreMenuOpen(false);
    if (confirm("Are you sure you want to clear ALL scheduled orders?")) {
      onUpdateJobs([]);
    }
  };

  // Gantt Timeline metrics
  const minT = useRef(6 * 60);
  const maxT = useRef(21 * 60);

  const calculateTimelineDimensions = () => {
    let currentMin = 6 * 60;
    let currentMax = 21 * 60;
    
    views.forEach(v => v.runs.forEach((r: any) => {
      const a0 = twS(r.jobs[0].time_window);
      if (a0 != null) {
        currentMin = Math.min(currentMin, a0 - r.departMin);
      }
      const last = r.jobs[r.jobs.length - 1];
      const le = twS(last.time_window);
      if (le != null) {
        currentMax = Math.max(currentMax, le + (last.setup_mins || 60) + r.returnMin);
      }
    }));

    const unsch = jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id);
    unsch.forEach(j => {
      const t = twS(j.time_window);
      if (t != null) {
        currentMin = Math.min(currentMin, t);
        currentMax = Math.max(currentMax, t + (j.setup_mins || 60));
      }
    });

    minT.current = Math.floor(currentMin / 60) * 60;
    maxT.current = Math.ceil(currentMax / 60) * 60;
  };

  if (selDate) calculateTimelineDimensions();

  const HPX = 56;
  const W = ((maxT.current - minT.current) / 60) * HPX;
  const X = (t: number) => ((t - minT.current) / 60) * HPX;

  const renderTimelineBar = (t0: number | null, t1: number | null, cls: string, label: string, title: string, jid?: string) => {
    if (t0 == null || t1 == null || t1 <= t0) return null;
    return (
      <div 
        className={`tl-bar ${cls}`} 
        style={{ left: `${X(t0)}px`, width: `${Math.max(5, X(t1) - X(t0) - 1)}px` }} 
        title={title}
        onClick={() => jid && onOpenOrderDetails(jid)}
      >
        {label}
      </div>
    );
  };

  const renderGanttTimeline = (helperDuty: Record<string, Job[]>) => {
    const hours: React.ReactNode[] = [];
    for (let t = minT.current; t <= maxT.current; t += 60) {
      hours.push(
        <div key={t} className="tl-h" style={{ left: `${X(t)}px` }}>
          {toS(t)}
        </div>
      );
    }

    const unsch = jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id);

    const renderTeamRow = (t: Team) => {
      const v = views.find(x => x.team.id === t.id);
      const rowBars: React.ReactNode[] = [];
      let cnt = 0;

      if (v) {
        v.runs.forEach((r: any, rIdx: number) => {
          const a0 = twS(r.jobs[0].time_window);
          if (a0 != null) {
            rowBars.push(renderTimelineBar(a0 - r.departMin, a0, 'tl-tr', '', `drive from ${HUB.short} ~${fmtDur(r.departMin)}`, `drive-start-${rIdx}`));
          }
          r.jobs.forEach((j: any, i: number) => {
            const a = twS(j.time_window);
            if (a == null) return;
            const e = a + (j.setup_mins || 60);
            cnt++;
            const barCls = j.type.toLowerCase() === 'collection' ? 'tl-col' : (jobTrucks(j) > 1 ? 'tl-cv' : (isPortion(j) ? 'tl-pt' : 'tl-del'));
            const barTitle = `${j.order_no} · ${j.client} · ${toS(a)}–${toS(e)} · ${normSize(j.size)}${jobTrucks(j) > 1 ? ` · convoy ×${jobTrucks(j)}` : ''}${isPortion(j) ? ` · load ${(j._portionIdx || 0) + 1}/${j._portionCount}` : ''}`;
            
            rowBars.push(renderTimelineBar(a, e, barCls, coreNo(j.order_no), barTitle, j._id));
            if (i < r.jobs.length - 1 && j._tr != null) {
              rowBars.push(renderTimelineBar(e, e + j._tr, 'tl-tr', '', `drive ~${fmtDur(j._tr)}`, `drive-next-${i}`));
            }
          });
          const last = r.jobs[r.jobs.length - 1];
          const le = twS(last.time_window);
          if (le != null) {
            rowBars.push(renderTimelineBar(le + (last.setup_mins || 60), le + (last.setup_mins || 60) + r.returnMin, 'tl-tr', '', `return to ${HUB.short} ~${fmtDur(r.returnMin)}`, `drive-return-${rIdx}`));
          }
        });
      }

      (helperDuty[t.id] || []).forEach(j => {
        const a = twS(j.time_window);
        if (a == null) return;
        cnt++;
        rowBars.push(renderTimelineBar(a, a + (j.setup_mins || 60), 'tl-hp', coreNo(j.order_no), `HELPER on ${j.order_no} (${j.client}) — lending truck + crew`, j._id));
      });

      return (
        <div key={t.id} className={`tl-row${t.outsourced ? ' tl-out' : ''}`}>
          <div className="tl-lbl">
            <span className="tdot" style={{ background: TPAL[t.colorIdx % TPAL.length].dot, width: "7px", height: "7px", borderRadius: "50%", display: "inline-block", marginRight: "6px" }}></span>
            {t.label}
            {t.outsourced ? ' ⟂' : ''}
            <em>{cnt === 0 ? 'free' : cnt}</em>
          </div>
          <div className="tl-lane" style={{ width: `${W}px`, minWidth: `${W}px` }}>
            {rowBars}
          </div>
        </div>
      );
    };

    return (
      <div className="tl-wrap">
        <div className="tl-scroll">
          <div className="tl-row" style={{ height: "20px", borderBottom: "1px solid var(--b2)" }}>
            <div className="tl-lbl"></div>
            <div className="tl-lane" style={{ width: `${W}px`, minWidth: `${W}px`, background: "none", position: "relative" }}>
              {hours}
            </div>
          </div>
          {unsch.length > 0 && (
            <div className="tl-row">
              <div className="tl-lbl" style={{ color: "var(--red)" }}>⚠ unscheduled</div>
              <div className="tl-lane" style={{ width: `${W}px`, minWidth: `${W}px` }}>
                {unsch.map(j => {
                  const a = twS(j.time_window);
                  if (a == null) return null;
                  return renderTimelineBar(a, a + (j.setup_mins || 60), 'tl-un', coreNo(j.order_no), `UNSCHEDULED: ${j.order_no} · ${j.client}`, j._id);
                })}
              </div>
            </div>
          )}
          {teams.filter(t => !t.outsourced).map(t => renderTeamRow(t))}
          {teams.some(t => t.outsourced) && (
            <>
              <div className="tl-sep">outsource crews — paid per leg</div>
              {teams.filter(t => t.outsourced).map(t => renderTeamRow(t))}
            </>
          )}
        </div>
      </div>
    );
  };

  // Recalculating convoy duty helper references
  const helperDuty: Record<string, Job[]> = {};
  jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && jobTrucks(j) > 1 && j.split === false).forEach(j => {
    (j._helpers || []).forEach((h: any) => {
      if (h.kind === 'team' && h.tid) {
        helperDuty[h.tid] = helperDuty[h.tid] || [];
        helperDuty[h.tid].push(j);
      }
    });
  });

  const getWeekAheadStrip = () => {
    const datesList: string[] = [];
    const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const start = new Date(selDate + 'T00:00:00');
    start.setDate(start.getDate() + wkOff);
    
    for (let i = 0; i < 14; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      datesList.push(localISO(d));
    }

    return (
      <div className="wkstrip" style={{ marginBottom: "10px" }}>
        <div className="wknav">
          <button className="wkbtn" title="3 days back" onClick={() => setWkOff(prev => prev - 3)}>‹ 3d</button>
          <button className="wkbtn" title="Jump to today" onClick={() => { setWkOff(0); setSelDate(todayStr()); }}>Today</button>
          <button className="wkbtn" title="3 days forward" onClick={() => setWkOff(prev => prev + 3)}>3d ›</button>
        </div>
        {datesList.map(ds => {
          const dObj = new Date(ds + 'T00:00:00');
          const lbl = `${DOW[dObj.getDay()]} ${dObj.getDate()}/${dObj.getMonth() + 1}`;
          
          const dayJobsList = jobs.filter(j => j.date === ds && j.status !== 'cancelled' && !isSplitParent(j));
          const totalOrders = jobs.filter(j => j.date === ds && j.status !== 'cancelled' && !isPortion(j)).length;

          if (dayJobsList.length === 0) {
            return (
              <div 
                key={ds}
                className={`wday empty ${ds === selDate ? 'cur' : ''}`}
                onClick={() => setSelDate(ds)}
              >
                <div className="wd-d">{lbl}</div>
                <div className="wd-n">—</div>
                <div className="wd-s">free</div>
              </div>
            );
          }

          // Calculate metrics for summary strip
          const dsViews = recalcDate(jobs, teams, trucks, drivers, crew, defaults.buf, fuelConfig, ds);
          const dsTrips = dsViews.reduce((s, v) => s + v.nRuns, 0);
          const dsClash = dsViews.reduce((s, v) => s + (v.clashes || 0), 0);
          const dsUsed = dsViews.length;
          const dsExtraTrucks = jobs.filter(j => j.date === ds && j.status !== 'cancelled' && jobTrucks(j) > 1 && j.split === false)
            .reduce((s, j) => s + (jobTrucks(j) - 1), 0);
          const dsUnsched = dayJobsList.filter(j => !j.team_id).length;

          const stripCls = (dsClash > 0 || dsUnsched > 0) ? 'red' : (dsUsed >= teams.length ? 'red' : (dsUsed >= Math.ceil(teams.length * 0.7) ? 'amber' : 'ok'));

          return (
            <div 
              key={ds}
              className={`wday ${stripCls} ${ds === selDate ? 'cur' : ''}`}
              onClick={() => setSelDate(ds)}
            >
              <div className="wd-d">{lbl}</div>
              <div className="wd-n">{totalOrders} orders · {dsTrips} legs</div>
              <div className="wd-s">
                {dsUsed}/{teams.length} teams
                {dsExtraTrucks > 0 ? ` +${dsExtraTrucks}🚛` : ''}
                {(dsClash > 0 || dsUnsched > 0) ? ' ⚠' : ''}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const getKPIBar = () => {
    const warns = views.reduce((s, v) => s + v.warns, 0);
    const backs = views.reduce((s, v) => s + v.backhauls, 0);
    const trips = views.reduce((s, v) => s + v.nRuns, 0);
    const clashTotal = views.reduce((s, v) => s + (v.clashes || 0), 0);

    const kmTotal = views.reduce((s, v) => s + v.km, 0);
    const inhouseKm = views.reduce((s, v) => s + (v.team.outsourced ? 0 : v.km), 0);
    const _dr = fuelConfig.dieselAED || 0;
    
    const fuelCost = Math.round(views.reduce((s, v) => {
      if (v.team.outsourced) return s;
      const tr = trucks.find(t => t.id === v.team.truckId);
      return s + v.km * truckLPer100(tr, fuelConfig) / 100 * _dr;
    }, 0));
    
    const avgPerKm = inhouseKm ? (fuelCost / inhouseKm) : 0;
    
    const fillNum = views.reduce((s, v) => s + v.runs.reduce((x: number, r: any) => x + (r.multi ? r.trucks : Math.max(r.delLoad, r.colLoad)), 0), 0);
    const fillDen = views.reduce((s, v) => s + v.runs.reduce((x: number, r: any) => x + (r.multi ? r.trucks : (v.cap || 1)), 0), 0);
    const fillPct = fillDen ? Math.round(fillNum / fillDen * 100) : 0;

    let outHires = 0;
    let outCost = 0;
    const outSet = new Set<string>();

    jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && jobTrucks(j) > 1 && j.split === false).forEach(j => {
      (j._helpers || []).forEach((h: any) => {
        if (h.kind === 'truck') {
          outHires++; outCost += outsourceTripCost(j.address); outSet.add(h.label);
        } else if (h.kind === 'team') {
          const ht = teams.find(x => x.id === h.tid);
          if (ht && ht.outsourced) {
            outHires++; outCost += outsourceTripCost(j.address); outSet.add(h.label);
          }
        }
      });
    });

    views.forEach(v => {
      if (v.team.outsourced) {
        v.runs.forEach((r: any) => {
          outHires++; outCost += outsourceTripCost(r.jobs[0].address); outSet.add(v.team.label);
        });
      }
    });

    const doneCnt = activeJobs.filter(j => (j as any).prog === 'done').length;
    const dispCnt = activeJobs.filter(j => (j as any).prog === 'dispatched' || (j as any).prog === 'onsite').length;
    const bufOnly = Math.max(0, warns - clashTotal);

    // Busiest moment crew calculation
    const getPeakCrewOn = () => {
      const slots: Record<number, number> = {};
      activeJobs.forEach(j => {
        const ts = twS(j.time_window);
        if (ts == null) return;
        const te = ts + (j.setup_mins || 60);
        const cw = jobCrew(j);
        
        for (let t = ts; t < te; t += 5) {
          slots[t] = (slots[t] || 0) + cw;
        }
      });
      let peak = 0;
      Object.values(slots).forEach(v => {
        if (v > peak) peak = v;
      });
      return peak;
    };

    const crewAvailOn = () => {
      return crew.filter(c => !c.outsourced && resAvailable(c, selDate)).length;
    };

    const peakCrew = getPeakCrewOn();
    const availableCrew = crewAvailOn();
    const shortCrew = Math.max(0, peakCrew - availableCrew);
    const manpowerCost = shortCrew * (crewRate || 0);

    const inUseTeams = new Set([
      ...views.filter(v => !v.team.outsourced).map(v => v.team.id),
      ...Object.keys(helperDuty).filter(id => {
        const t = teams.find(x => x.id === id);
        return t && !t.outsourced;
      })
    ]).size;

    return (
      <div className="res-bar">
        <i className="ti ti-gauge"></i>
        <span><strong>{dateJobs.length}</strong> orders</span>
        <span>· <strong>{activeJobs.filter(j => j.type.toLowerCase() === 'delivery').length}</strong> del</span>
        <span>· <strong>{activeJobs.filter(j => j.type.toLowerCase() === 'collection').length}</strong> col</span>
        <span>· <strong>{trips}</strong> leg{trips !== 1 ? 's' : ''}</span>
        <span>· ~<strong>{kmTotal}</strong> km</span>
        <span>· fill <strong>{fillPct}%</strong></span>
        <span>· trucks <strong>{inUseTeams}</strong> in-house{outSet.size ? ` + <strong>${outSet.size}</strong> outsource` : ''}</span>
        {outCost > 0 && <span>· outsource <strong>AED {outCost}</strong></span>}
        <span title="Peak crew need vs in-house crew available today.">
          · crew need <strong>{peakCrew}</strong> · have <strong>{availableCrew}</strong>
          {shortCrew > 0 && <span style={{ color: "var(--red)" }}> · order {shortCrew} (~AED {manpowerCost})</span>}
        </span>
        <span title="Diesel cost estimated.">
          · in-house fuel ~<strong>AED {fuelCost}</strong> <span style={{ color: "var(--t3)" }}>(avg AED {avgPerKm.toFixed(2)}/km)</span>
        </span>
        <span>· done <strong>{doneCnt}/{activeJobs.length}</strong>{dispCnt > 0 && <span style={{ color: "var(--blue)" }}> ({dispCnt} out)</span>}</span>
        
        <span style={{ marginLeft: "auto", display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id).length > 0 && (
            <span className="bdg b-warn" title="Unscheduled jobs need attention.">⚠ {jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id).length} unscheduled</span>
          )}
          {clashTotal > 0 && (
            <span className="bdg b-warn" title="Time clashes in timeline.">⚠ {clashTotal} time clash{clashTotal > 1 ? 'es' : ''}</span>
          )}
          {bufOnly > 0 && (
            <span className="bdg b-col" title="Tight buffer gaps.">{bufOnly} tight buffer{bufOnly > 1 ? 's' : ''}</span>
          )}
          {outHires > 0 && (
            <span className="bdg b-split" style={{ cursor: "pointer" }} onClick={() => setOutCostModalOpen(true)}>
              {outHires} outsource trip{outHires > 1 ? 's' : ''} · AED {outCost} ▸
            </span>
          )}
          {backs > 0 && (
            <span className="bdg b-back">⇄ {backs} backhaul{backs > 1 ? 's' : ''}</span>
          )}
        </span>
      </div>
    );
  };

  const renderActiveTeamPanel = () => {
    const v = views.find(vw => vw.team.id === activeTid);
    const team = teams.find(t => t.id === activeTid);
    if (!team) return null;
    const tp = TPAL[team.colorIdx % TPAL.length];

    if (!v) {
      // Free or helper duty
      const duties = jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && jobTrucks(j) > 1 && j.split === false && (j._helpers || []).some((h: any) => h.kind === 'team' && h.tid === team.id));
      
      return (
        <div className="tc">
          <div className="tc-hdr">
            <div className="tc-left">
              <div className="tc-av" style={{ background: tp.bg, color: tp.fg }}>{initials(team.label)}</div>
              <div>
                <div className="tc-name">{team.label}</div>
                <div className="tc-sub">{teamLead(team, crew, drivers)} · {trucks.find(t => t.id === team.truckId)?.plate}</div>
              </div>
            </div>
            <div className="tc-mets">
              {duties.length > 0 ? (
                <div className="tc-m" style={{ color: "var(--purple)" }}>
                  <i className="ti ti-truck" style={{ fontSize: "12px" }}></i> on convoy helper duty
                </div>
              ) : (
                <div className="tc-m" style={{ color: "var(--green)" }}>
                  <i className="ti ti-circle-check" style={{ fontSize: "12px" }}></i> free all day
                </div>
              )}
            </div>
          </div>
          {duties.length > 0 ? (
            <>
              {duties.map((j, dIdx) => {
                const lead = teams.find(t => t.id === j.team_id);
                const me = (j._helpers || []).find((h: any) => h.tid === team.id) || {};
                const s = twS(j.time_window);
                const eta = me.late > 0 ? ` · arrives ~${fmtDur(me.late)} after leader` : ' · departs with leader';
                return (
                  <div key={dIdx} className="conv-row" style={{ display: "block", borderBottom: "1px solid var(--b1)" }}>
                    <div className="conv-inner" style={{ padding: "8px 14px" }}>
                      <span className="conv-tag help" style={{ marginRight: "6px" }}>HELPER</span>
                      <span>
                        Lending truck + crew to <strong>{lead?.label}</strong>&apos;s convoy —{" "}
                        <span className="od-link" onClick={() => onOpenOrderDetails(j._id)}>{j.order_no}</span>{" "}
                        {j.client} · {j.address} · {s != null ? toS(s) : 'TBC'}{eta}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="empty-date" style={{ padding: "14px 16px" }}>
                <p style={{ fontSize: "11px", color: "var(--t3)" }}>No orders of its own today — truck + crew committed to convoy helper duty.</p>
              </div>
            </>
          ) : (
            <div className="empty-date" style={{ padding: "26px 16px" }}>
              <i className="ti ti-coffee"></i>
              <p>No jobs for {team.label} on this date.</p>
              <p style={{ fontSize: "11px", color: "var(--t3)", marginTop: "4px" }}>Available for new orders, reassignments, or convoy helper duty.</p>
            </div>
          )}
        </div>
      );
    }

    const anyOver = v.runs.some((r: any) => r.over);
    
    // Team chip builder
    const renderTeamChip = (id: string | null) => {
      const t = teams.find(x => x.id === id);
      if (!t) return <span style={{ color: "var(--t3)" }}>— unassigned</span>;
      return (
        <span className="team-chip">
          <span className="tdot" style={{ background: TPAL[t.colorIdx % TPAL.length].dot, width: "6px", height: "6px", borderRadius: "50%", display: "inline-block", marginRight: "4px" }}></span>
          {t.label}
        </span>
      );
    };

    return (
      <div className="tc">
        <div className="tc-hdr">
          <div className="tc-left">
            <div className="tc-av" style={{ background: tp.bg, color: tp.fg }}>{initials(v.team.label)}</div>
            <div>
              <div className="tc-name">{v.team.label}</div>
              <div className="tc-sub">{teamLead(v.team, crew, drivers)} · {trucks.find(t => t.id === v.team.truckId)?.plate}</div>
            </div>
          </div>
          <div className="tc-mets">
            <div className="tc-m"><i className="ti ti-clock" style={{ fontSize: "12px" }}></i><strong>{v.st}</strong> — <strong>{v.et}</strong></div>
            <div className="tc-m"><i className="ti ti-road" style={{ fontSize: "12px" }}></i>~<strong>{v.km} km</strong></div>
            <div className="tc-m"><i className="ti ti-rotate-2" style={{ fontSize: "12px" }}></i><strong>{v.nRuns}</strong> leg{v.nRuns > 1 ? 's' : ''}</div>
            {anyOver && <div className="tc-m w"><i className="ti ti-alert-square-rounded" style={{ fontSize: "12px" }}></i>oversize load</div>}
            {v.warns > 0 && <div className="tc-m w"><i className="ti ti-alert-triangle" style={{ fontSize: "12px" }}></i>{v.warns} warning{v.warns > 1 ? 's' : ''}</div>}
          </div>
        </div>

        <table className="jt">
          <thead>
            <tr>
              <th style={{ width: "106px" }}>Time</th>
              <th>Client &amp; location</th>
              <th style={{ width: "86px" }}>Size · 🚛/👥</th>
              <th style={{ width: "66px" }}>Setup</th>
              <th style={{ width: "66px" }}>Buffer</th>
              <th style={{ width: "118px" }}>Status</th>
              <th style={{ width: "132px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {v.runs.map((run: any, ri: number) => {
              const oP = Math.round(run.delLoad / (v.cap || 1) * 100);
              const bP = Math.round(run.colLoad / (v.cap || 1) * 100);
              const cj = run.multi ? run.jobs[0] : null;
              const inh = cj ? (cj._helperInhouse || 0) : 0;
              const outc = cj ? (cj._helperOut || 0) : 0;
              
              const rowsList: React.ReactNode[] = [];

              // Run header
              rowsList.push(
                <tr key={`run-hdr-${ri}`} className="run-row">
                  <td colSpan={7}>
                    <div className="run-inner">
                      <span className="run-badge">{run.multi ? `CONVOY ${ri + 1}` : `LEG ${ri + 1}`}</span>
                      {run.multi ? (
                        <span>👑 Leader <strong>{v.team.label}</strong> · 🚛 <strong>{run.trucks} trucks</strong> (1 lead + {run.trucks - 1} helpers: {inh} in, {outc} out) · 👥 <strong>{run.crew} crew</strong></span>
                      ) : (
                        <span>Load out <strong>{oP}%</strong>{run.colLoad > 0 && <> · collect back <strong>{bP}%</strong></>}{run.over && <span style={{ color: "var(--red)" }}> ▲ exceeds truck capacity</span>}</span>
                      )}
                    </div>
                  </td>
                </tr>
              );

              // Departure line
              const depT = twS(run.jobs[0].time_window);
              const legLoad = run.multi ? loadMins(run.jobs[0].size) : run.jobs.reduce((x: number, j: Job) => x + (j.type.toLowerCase() !== 'collection' ? loadMins(j.size) : 0), 0);
              const depBy = depT != null ? toS(depT - run.departMin) : null;
              const loadBy = (depT != null && legLoad > 0) ? toS(depT - run.departMin - legLoad) : null;

              rowsList.push(
                <tr key={`hub-dep-${ri}`} className="hub-row">
                  <td colSpan={7}>
                    <div className="hub-inner">
                      <i className="ti ti-building-warehouse" style={{ fontSize: "13px" }}></i>
                      {esc(HUB.short)}: {loadBy && <>start loading <strong style={{ color: "var(--amber)" }}>by {loadBy}</strong> ({fmtDur(legLoad)}) · </>}
                      {run.multi && `${run.trucks} trucks `}depart{depBy && <> <strong style={{ color: "var(--amber)" }}>by {depBy}</strong></>} → ~{fmtDur(run.departMin)} · ~{run.departKm} km to {run.multi ? 'site' : 'first stop'}
                    </div>
                  </td>
                </tr>
              );

              // Job rows
              run.jobs.forEach((j: Job, jIdx: number) => {
                const isColl = j.type.toLowerCase() === 'collection';
                const clashFlag = j.status !== 'cancelled' && (j as any)._teamClash === true;
                const hw = j.status !== 'cancelled' && ((j as any)._bufOk === false || clashFlag);

                // Add travel time row
                if (j.status !== 'cancelled' && (j as any)._tr !== null && (j as any)._tr !== undefined) {
                  const ok = (j as any)._bufOk !== false;
                  const clash = (j as any)._buf < 0;
                  
                  rowsList.push(
                    <tr key={`travel-${ri}-${jIdx}`} className="tr-row">
                      <td colSpan={7}>
                        <div className="tr-inner">
                          <i className="ti ti-arrow-narrow-down" style={{ fontSize: "12px" }}></i>
                          ~{fmtDur((j as any)._tr)} · ~{(j as any)._trKm ?? kmOf((j as any)._tr)} km{" "}
                          <span className={ok ? 'tr-ok' : 'tr-warn'}>
                            {ok ? `✓ ${fmtDur((j as any)._buf)} buffer` : (clash ? `✗ TIME CLASH — ${fmtDur(-(j as any)._buf)} short` : `⚠ ${fmtDur((j as any)._buf)} spare (need ${fmtDur((j as any)._need)})`)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Badges
                const renderBadges = () => {
                  return (
                    <div className="jbdg">
                      <span className="tlab">{isColl ? 'COLL' : 'DEL'}</span>
                      {j.status === 'cancelled' && <span className="bdg b-dead">CANCELLED</span>}
                      {j.status !== 'cancelled' && (
                        <>
                          {jobTrucks(j) > 1 && <span className="bdg b-multi">👑 CONVOY LEAD ×{jobTrucks(j)}</span>}
                          {isPortion(j) && <span className="bdg b-part" title="Convoy load portion">LOAD {(j._portionIdx || 0) + 1}/{j._portionCount}</span>}
                          {j._backhaul && <span className="bdg b-back">BACKHAUL ⇄</span>}
                          {j.continuity === 'same_team' && <span className="bdg b-same">SAME TEAM ✓</span>}
                          {j.continuity === 'split_crew' && <span className="bdg b-split">SPLIT CREW</span>}
                          {clashFlag && <span className="bdg b-warn">TIME CLASH ✗ {fmtDur((j as any)._teamClashMin)}</span>}
                          {!clashFlag && hw && <span className="bdg b-warn">BUFFER ⚠</span>}
                        </>
                      )}
                      {j.status !== 'cancelled' && (
                        <select
                          className={`prog-sel p-${(j as any).prog || 'pending'}`}
                          value={(j as any).prog || ""}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = jobs.map(x => x._id === j._id ? { ...x, prog: val } : x);
                            onUpdateJobs(updated);
                          }}
                          title="Job progress"
                        >
                          <option value="">Pending</option>
                          <option value="dispatched">Dispatched</option>
                          <option value="onsite">On site</option>
                          <option value="done">Done ✓</option>
                        </select>
                      )}
                    </div>
                  );
                };

                const lockRes = j.status === 'cancelled' || isPortion(j);

                rowsList.push(
                  <tr key={j._id} className={`jr ${j.status === 'cancelled' ? 'cancelled' : ''} ${hw ? 'hw' : ''} ${(j as any).prog === 'done' ? 'done' : ''}`}>
                    <td>
                      <input 
                        className="tw-inp" 
                        type="time" 
                        value={j.time_window || ""}
                        disabled={j.status === 'cancelled'}
                        onChange={e => {
                          const val = e.target.value;
                          let updated = jobs.map(x => x._id === j._id ? { ...x, time_window: val } : x);
                          if (isSplitParent(j)) {
                            // portions sync automatically in packDate
                          }
                          updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                          onUpdateJobs(updated);
                        }}
                      />
                    </td>
                    <td>
                      <div className="jcli">
                        {j.client}
                        {showPrefs.orderNo && j.order_no && (
                          <span className="jno" onClick={() => onOpenOrderDetails(j._id)} title="Open details">
                            {j.order_no}
                          </span>
                        )}
                      </div>
                      <div className="jadr">
                        {j.address}
                        {showPrefs.venue && j.venue_type && (
                          <> · <i className="ti ti-building" style={{ fontSize: "10px" }}></i> {j.venue_type}</>
                        )}
                      </div>
                      {showPrefs.phone && j.phone && (
                        <div className="jadr"><i className="ti ti-phone" style={{ fontSize: "10px" }}></i> {j.phone}</div>
                      )}
                      {showPrefs.items && j.items && (
                        <div className="jitm">{j.items}</div>
                      )}
                      {showPrefs.notes && j.notes && (
                        <div className="jnote"><i className="ti ti-note" style={{ fontSize: "10px" }}></i> {j.notes}</div>
                      )}
                      {j.split_note && <div className="jnote">{j.split_note}</div>}
                    </td>
                    <td>
                      <select 
                        className="sz-sel" 
                        value={normSize(j.size)}
                        disabled={lockRes}
                        onChange={e => {
                          const val = normSize(e.target.value);
                          let updated = jobs.map(x => x._id === j._id ? { ...x, size: val } : x);
                          updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                          onUpdateJobs(updated);
                        }}
                      >
                        <option value="XS">XS · 10%</option>
                        <option value="S">S · 25%</option>
                        <option value="M">M · 50%</option>
                        <option value="L">L · 75%</option>
                        <option value="XL">XL · 100%</option>
                      </select>
                      {!isPortion(j) ? (
                        <div className="rqrow">
                          <span title="Trucks">
                            🚛
                            <input 
                              className="rq-inp" 
                              type="number" 
                              min="1" 
                              value={jobTrucks(j)}
                              disabled={j.status === 'cancelled'}
                              onChange={e => {
                                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                let updated = jobs.map(x => x._id === j._id ? { ...x, trucks: val } : x);
                                updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                                onUpdateJobs(updated);
                              }}
                            />
                          </span>
                          <span title="Crew">
                            👥
                            <input 
                              className="rq-inp" 
                              type="number" 
                              min="0" 
                              value={jobCrew(j)}
                              disabled={j.status === 'cancelled'}
                              onChange={e => {
                                const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                                let updated = jobs.map(x => x._id === j._id ? { ...x, crew: val } : x);
                                updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                                onUpdateJobs(updated);
                              }}
                            />
                          </span>
                        </div>
                      ) : (
                        <div className="rqrow"><span style={{ color: "var(--t3)" }}>part of {j.order_no}</span></div>
                      )}
                    </td>
                    <td>
                      <input 
                        className="su-inp" 
                        type="number" 
                        min="5"
                        value={j.setup_mins || 60}
                        disabled={j.status === 'cancelled'}
                        onChange={e => {
                          const val = Math.max(5, parseInt(e.target.value, 10) || 60);
                          let updated = jobs.map(x => x._id === j._id ? { ...x, setup_mins: val, _customSetup: true } : x);
                          updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                          onUpdateJobs(updated);
                        }}
                      />
                      <span className="su-u">{fmtDur(j.setup_mins || 60)}</span>
                    </td>
                    <td>
                      <input 
                        className="su-inp" 
                        type="number" 
                        min="0"
                        value={jobBuffer(j, defaults.buf)}
                        disabled={j.status === 'cancelled'}
                        onChange={e => {
                          const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                          let updated = jobs.map(x => x._id === j._id ? { ...x, buffer_mins: val, _customBuf: true } : x);
                          updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                          onUpdateJobs(updated);
                        }}
                      />
                      <span className="su-u">{fmtDur(jobBuffer(j, defaults.buf))}</span>
                    </td>
                    <td>{renderBadges()}</td>
                    <td>
                      <div className="jact">
                        {j.status === 'cancelled' ? (
                          <button className="btn xs g-green" onClick={() => {
                            const updated = jobs.map(x => x._id === j._id ? { ...x, status: 'active' } : x);
                            onUpdateJobs(updated);
                          }}>
                            <i className="ti ti-arrow-back-up"></i> Restore
                          </button>
                        ) : (
                          <>
                            <button className="btn xs g-blue" onClick={() => onOpenOrderDetails(j._id)} title="Edit details">
                              <i className="ti ti-calendar-event"></i>
                            </button>
                            <button className="btn xs" onClick={() => {
                              const promptVal = prompt("Enter team label to assign this order to, or cancel to auto-pack:");
                              if (promptVal === null) return;
                              const targetTeam = teams.find(t => t.label.toLowerCase() === promptVal.toLowerCase());
                              let updated = jobs.map(x => x._id === j._id ? { ...x, team_id: targetTeam ? targetTeam.id : null } : x);
                              updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                              onUpdateJobs(updated);
                            }} title="Reassign">
                              <i className="ti ti-arrows-exchange"></i>
                            </button>
                            <button className="btn xs g-red" onClick={() => {
                              if (confirm("Cancel this order leg?")) {
                                let updated = jobs.map(x => x._id === j._id ? { ...x, status: 'cancelled' } : x);
                                updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);
                                onUpdateJobs(updated);
                              }
                            }} title="Cancel">
                              <i className="ti ti-x"></i>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              });

              // Helper detail convoy lines
              if (run.multi) {
                const leadTruck = trucks.find(t => t.id === v.team.truckId);
                const helpers = cj._helpers || [];
                const short = cj._helperShort || 0;

                rowsList.push(
                  <tr key={`convoy-lead-${ri}`} className="conv-row">
                    <td colSpan={7}>
                      <div className="conv-inner">
                        <span className="conv-tag lead" style={{ marginRight: "6px" }}>👑 LEADER</span>
                        <strong>{v.team.label}</strong> — {leadTruck ? `${leadTruck.plate} (${leadTruck.tonnage || 5}t)` : "own truck"} + crew · directs convoy
                      </div>
                    </td>
                  </tr>
                );

                helpers.forEach((h: any, hi: number) => {
                  const desc = h.kind === 'team'
                    ? `<strong>${h.label}</strong> — in-house team (truck + crew)${h.truck ? ` · ${h.truck.plate}` : ''}`
                    : `🚛 <strong>${h.label}</strong> (${h.truck ? h.truck.tonnage || 5 : 5}t) · outsource — AED ${outsourceTripCost(cj.address)} this leg`;
                  const eta = h.late > 0 ? ` · <span class="tr-warn">arrives ~${fmtDur(h.late)} after leader</span>` : ' — arrives with leader';
                  
                  rowsList.push(
                    <tr key={`convoy-helper-${ri}-${hi}`} className="conv-row">
                      <td colSpan={7}>
                        <div className="conv-inner">
                          <span className="conv-tag help" style={{ marginRight: "6px" }}>HELPER {hi + 1}</span>
                          <span dangerouslySetInnerHTML={{ __html: desc + eta }}></span>
                        </div>
                      </td>
                    </tr>
                  );
                });

                if (short > 0) {
                  rowsList.push(
                    <tr key={`convoy-short-${ri}`} className="conv-row">
                      <td colSpan={7}>
                        <div className="conv-inner" style={{ color: "var(--red)" }}>
                          <i className="ti ti-alert-triangle"></i> Short <strong style={{ color: "var(--red)" }}>{short}</strong> helper truck(s) — pool exhausted.
                        </div>
                      </td>
                    </tr>
                  );
                }
              }

              // Return to warehouse line
              const moreRuns = ri < v.runs.length - 1;
              rowsList.push(
                <tr key={`hub-return-${ri}`} className="hub-row">
                  <td colSpan={7}>
                    <div className="hub-inner">
                      <i className="ti ti-building-warehouse" style={{ fontSize: "13px" }}></i>
                      Return to {HUB.short} → ~{fmtDur(run.returnMin)} · ~{run.returnKm} km
                      {!run.multi && run.colLoad > 0 && <span style={{ color: "var(--teal)" }}> · truck loaded with collections</span>}
                      {moreRuns && <span style={{ color: "var(--amber)" }}> — offload &amp; reload for next leg</span>}
                    </div>
                  </td>
                </tr>
              );

              return rowsList;
            })}

            {/* Cancelled team jobs */}
            {jobs.filter(j => j.date === selDate && j.team_id === v.team.id && j.status === 'cancelled').map(j => (
              <tr key={j._id} className="jr cancelled">
                <td>{j.time_window}</td>
                <td>
                  <div className="jcli">
                    {j.client}{" "}
                    <span className="jno" onClick={() => onOpenOrderDetails(j._id)}>{j.order_no}</span>
                  </div>
                  <div className="jadr">{j.address}</div>
                </td>
                <td colSpan={4}>
                  <span className="bdg b-dead">CANCELLED</span>
                </td>
                <td>
                  <button className="btn xs g-green" onClick={() => {
                    const updated = jobs.map(x => x._id === j._id ? { ...x, status: 'active' } : x);
                    onUpdateJobs(updated);
                  }}>
                    <i className="ti ti-arrow-back-up"></i> Restore
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const getConvoyRoster = (j: Job) => {
    if (j.split === false) return j._convoyRoster || [];
    const convoyEdits = (j as any).convoy || {};
    const parts = jobs.filter(x => x._portionOf === j._id).sort((a, b) => (a._portionIdx || 0) - (b._portionIdx || 0));
    
    return parts.map((pt, i) => {
      const idx = pt._portionIdx != null ? pt._portionIdx : i;
      const key = 'P:' + idx;
      const team = pt.team_id ? teams.find(t => t.id === pt.team_id) : null;
      const truck = team ? trucks.find(t => t.id === team.truckId) : null;
      const c = convoyEdits[key] || {};
      const isLead = (i === 0);
      const arr = twS(pt.time_window);
      const lv = (c.leave != null) ? c.leave : !isLead;
      const free = (c.freeAt && twS(c.freeAt) != null) ? twS(c.freeAt) : (lv && arr != null ? arr + OFFLOAD_MINS : null);
      
      return {
        key: key,
        role: isLead ? 'leader' : 'helper',
        label: team ? team.label : 'unassigned',
        truck: truck,
        cover: 1,
        arrive: arr,
        leave: lv,
        freeAt: free,
        dcab: !!(truck && truck.doubleCab)
      };
    });
  };

  const renderConvoysPanel = () => {
    const cvs = jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && jobTrucks(j) > 1 && !isPortion(j))
      .sort((a, b) => (twS(a.time_window) ?? 9999) - (twS(b.time_window) ?? 9999));
      
    if (cvs.length === 0) return null;

    return (
      <div className="conv-sec">
        <div 
          className="conv-head" 
          onClick={() => setConvoyOpen(!convoyOpen)}
          style={{ cursor: "pointer", userSelect: "none" }}
        >
          <i className={`ti ti-chevron-${convoyOpen ? 'down' : 'right'}`}></i> Convoys today ({cvs.length}) <span className="conv-sub">— set arrival, mark offload-and-leave, and free-from times</span>
        </div>
        
        {convoyOpen && cvs.map(j => {
          const r = getConvoyRoster(j);
          const modeTxt = j.split === false ? 'arrive together' : 'separate trucks';
          const arrTxt = twS(j.time_window) != null ? toS(twS(j.time_window)) : 'TBC';
          
          return (
            <div key={j._id} className="conv-card">
              <div className="conv-card-h">
                <strong>{j.order_no}</strong> · {j.client} · {dz(j.address).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} · arrives {arrTxt} · {jobTrucks(j)} loads · {modeTxt}
                {j._helperShort ? <span style={{ color: "var(--red)" }}> · ⚠ short {j._helperShort}</span> : ""}
              </div>
              <table className="conv-t">
                <thead>
                  <tr>
                    <th></th>
                    <th>Truck</th>
                    <th>Arrive on site</th>
                    <th style={{ textAlign: "center" }}>Offload &amp; leave</th>
                    <th>Free from</th>
                  </tr>
                </thead>
                <tbody>
                  {r.map((t: any) => (
                    <tr key={t.key}>
                      <td>{t.role === 'leader' ? '👑' : '•'}</td>
                      <td>
                        {t.label}
                        {t.truck ? (
                          <span className="conv-t-cap"> {t.truck.tonnage || 5}t{t.cover > 1 ? ` ·×${t.cover}` : ''}</span>
                        ) : (
                          <span className="conv-t-cap" style={{ color: "var(--red)" }}> no truck</span>
                        )}
                        {t.dcab ? (
                          <span className="conv-t-cap" style={{ color: "var(--purple)" }}> 🚐 dbl-cab</span>
                        ) : (
                          t.role === 'leader' ? <span className="conv-t-cap" style={{ color: "var(--amber)" }}> not a dbl-cab</span> : ""
                        )}
                      </td>
                      <td>
                        <input 
                          className="finp" 
                          type="time" 
                          value={t.arrive != null ? toS(t.arrive) : ""}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = jobs.map(x => {
                              if (x._id === j._id) {
                                if (t.key === 'L') {
                                  return { ...x, time_window: val };
                                } else {
                                  const cvObj = (x as any).convoy || {};
                                  return {
                                    ...x,
                                    convoy: {
                                      ...cvObj,
                                      [t.key]: {
                                        ...cvObj[t.key],
                                        arrive: val || null
                                      }
                                    }
                                  };
                                }
                              }
                              return x;
                            });
                            onUpdateJobs(updated);
                          }}
                        />
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          checked={!!t.leave}
                          onChange={e => {
                            const val = e.target.checked;
                            const updated = jobs.map(x => {
                              if (x._id === j._id) {
                                const cvObj = (x as any).convoy || {};
                                return {
                                  ...x,
                                  convoy: {
                                    ...cvObj,
                                    [t.key]: {
                                      ...cvObj[t.key],
                                      leave: val
                                    }
                                  }
                                };
                              }
                              return x;
                            });
                            onUpdateJobs(updated);
                          }}
                        />
                      </td>
                      <td>
                        <input 
                          className="finp" 
                          type="time" 
                          disabled={!t.leave}
                          value={t.freeAt != null ? toS(t.freeAt) : ""}
                          onChange={e => {
                            const val = e.target.value;
                            const updated = jobs.map(x => {
                              if (x._id === j._id) {
                                const cvObj = (x as any).convoy || {};
                                return {
                                  ...x,
                                  convoy: {
                                    ...cvObj,
                                    [t.key]: {
                                      ...cvObj[t.key],
                                      freeAt: val || null
                                    }
                                  }
                                };
                              }
                              return x;
                            });
                            onUpdateJobs(updated);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  // WhatsApp template builder
  const getWhatsAppMessage = (v: any) => {
    const driver = drivers.find(d => d.id === v.team.driverId);
    const cr1 = crew.find(c => c.id === v.team.crew1Id);
    const cr2 = crew.find(c => c.id === v.team.crew2Id);
    const truck = trucks.find(t => t.id === v.team.truckId);
    const dl = '─'.repeat(32);
    
    let m = `*🚚 MINT EVENT RENTALS*\n${new Date(selDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}\n${dl}\n`;
    m += `${v.team.label.toUpperCase()} | ${v.team.area}\n`;
    m += `${v.jobs.length} jobs · ${v.nRuns} leg${v.nRuns > 1 ? 's' : ''} | Start ${v.st} | Wrap ${v.et} | ~${v.km} km\n`;
    m += `👤 Driver: ${driver ? `${driver.name}  ${driver.phone || ''}` : ' Not assigned'}\n`;
    m += `👥 Crew:   ${[cr1, cr2].filter(Boolean).map(c => c!.name + (c!.phone ? ` (${c!.phone})` : '')).join(' · ') || 'Not assigned'}\n`;
    m += `E Truck:  ${truck ? `${truck.plate} — ${truck.model || ''} (${truck.tonnage || 5}t)` : 'Not assigned (assume 5t)'}\n`;
    m += `${dl}\n`;
    
    v.runs.forEach((run: any, ri: number) => {
      const oP = Math.round(run.delLoad / (v.cap || 1) * 100);
      const bP = Math.round(run.colLoad / (v.cap || 1) * 100);
      if (run.multi) {
        const cj = run.jobs[0];
        const helpers = cj._helpers || [];
        m += `\n*🚛 CONVOY ${ri + 1} — ${run.trucks} TRUCKS · ${run.crew} CREW*\n`;
        m += `   👑 Leader: ${v.team.label} (own truck + crew, directs convoy)\n`;
        helpers.forEach((h: any, hi: number) => {
          m += `   ➕ Helper ${hi + 1}: ${h.kind === 'team' ? `${h.label} (in-house team)` : `${h.label} (outsource truck)`}${h.late > 0 ? ` — arrives ~${fmtDur(h.late)} later` : ''}\n`;
        });
        if (cj._helperShort) m += `   ⚠️ Short ${cj._helperShort} helper truck(s) — add resources\n`;
      } else {
        m += `\n*🔁 LEG ${ri + 1} — load out ${oP}%${run.colLoad > 0 ? ` · collect back ${bP}%` : ''}*\n`;
      }
      const _dT = twS(run.jobs[0].time_window);
      const _lg = run.multi ? loadMins(run.jobs[0].size) : run.jobs.reduce((x: number, j: Job) => x + (j.type.toLowerCase() !== 'collection' ? loadMins(j.size) : 0), 0);
      m += `🏭 ${HUB.short}: ${(_dT != null && _lg > 0) ? `start loading by ${toS(_dT - run.departMin - _lg)} (${fmtDur(_lg)}) · ` : ''}${run.multi ? `${run.trucks} trucks ` : ''}depart${_dT != null ? ` by ${toS(_dT - run.departMin)}` : ''} (drive ~${fmtDur(run.departMin)})\n`;
      
      run.jobs.forEach((j: Job, i: number) => {
        const isColl = j.type.toLowerCase() === 'collection';
        m += `${isColl ? '📦' : '🟢'} ${i + 1}. ${j.type.toUpperCase()} [${normSize(j.size)} · ${SIZE[normSize(j.size)].lbl}]\n`;
        m += `   🕐 ${j.time_window || 'TBC'} (setup ${fmtDur(j.setup_mins || 60)})\n`;
        m += `   👤 ${j.client}${j.phone ? `  📞 ${j.phone}` : ''}\n   📍 ${j.address}${j.venue_type ? ` (${j.venue_type})` : ''}\n   🪑 ${j.items}\n`;
        if (j.notes) m += `   📝 ${j.notes}\n`;
        if (jobTrucks(j) > 1) m += `   🚛 Needs ${jobTrucks(j)} trucks · 👥 ${jobCrew(j)} crew (one order, split)\n`;
        if (j._backhaul) m += `   ⇄ Backhaul — keep truck loaded on return\n`;
        if (j.continuity === 'same_team' && j.linked_order) m += `   ✅ You handle the ${isColl ? 'delivery' : 'collection'} too (${j.linked_order})\n`;
        if (j.continuity === 'split_crew' && j.split_note) m += `   ⚠️ ${j.split_note}\n`;
        if ((j as any)._tr && i < run.jobs.length - 1) m += `   🚗 Drive to next: ~${fmtDur((j as any)._tr)}\n`;
      });
      m += `🏭 Return to ${HUB.short} (drive ~${fmtDur(run.returnMin)})${ri < v.runs.length - 1 ? ' — offload & reload' : ''}\n`;
    });
    m += `${dl}\nPlease confirm receipt ✅\nMint Event Rentals Operations`;
    return m;
  };

  const handleCopyTeamWA = (v: any) => {
    const text = getWhatsAppMessage(v);
    navigator.clipboard.writeText(text).then(() => {
      alert("WhatsApp text for team copied to clipboard!");
    });
  };

  const handleCopyAllWA = () => {
    const all = views.map(v => getWhatsAppMessage(v)).join('\n\n' + '═'.repeat(36) + '\n\n');
    navigator.clipboard.writeText(all).then(() => {
      alert("All WhatsApp rosters copied to clipboard!");
    });
  };

  return (
    <div id="scr-schedule" className="screen active">
      {addOpen && (
        <AddOrderForm
          venues={venues}
          teams={teams}
          defaultDelMins={defaults.del}
          defaultColMins={defaults.col}
          defaultBufMins={defaults.buf}
          selDate={selDate}
          onCancel={() => setAddOpen(false)}
          onAdd={(job, colJob) => {
            let updated = [...jobs, job];
            if (colJob) updated.push(colJob);
            updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, job.date);
            if (colJob && colJob.date !== job.date) {
              updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, colJob.date);
            }
            setSelDate(job.date);
            onUpdateJobs(updated);
            setAddOpen(false);
          }}
        />
      )}

      {jobs.length === 0 ? (
        <div id="scr-upload">
          <div 
            className="upload-zone" 
            id="drop-zone" 
            style={{ padding: "26px 24px", cursor: "default" }}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("drag"); }}
            onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove("drag"); }}
            onDrop={e => {
              e.preventDefault();
              e.currentTarget.classList.remove("drag");
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const reader = new FileReader();
                reader.onload = ev => {
                  if (ev.target?.result) {
                    handleCSVImport(ev.target.result as string);
                  }
                };
                reader.readAsText(file);
              }
            }}
          >
            <h2 style={{ marginBottom: "3px" }}>Welcome — your schedule is empty</h2>
            <p style={{ marginBottom: "14px" }}>Add your first order and the calendar, teams and assignments take it from there.</p>
            <button className="btn amber" id="btn-first-add" style={{ fontSize: "13px", padding: "9px 18px" }} onClick={() => setAddOpen(true)}>
              <i className="ti ti-plus"></i> Add your first order
            </button>
            <p style={{ marginTop: "14px", fontSize: "11px", color: "var(--t3)" }}>
              Optional: <button className="sample-lnk" style={{ margin: 0 }} onClick={() => fileInputRef.current?.click()}>import a CSV file</button> (or drop one here)
            </p>
          </div>
          <input type="file" ref={fileInputRef} id="file-input" accept=".csv" onChange={handleFileUpload} />
        </div>
      ) : isProcessing ? (
        <div id="scr-proc">
          <div className="proc">
            <div className="spin"></div>
            <p style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>Assigning teams…</p>
            <p style={{ fontSize: "12px", color: "var(--t3)", fontFamily: "'JetBrains Mono', monospace" }}>Grouping by area &amp; size, packing trucks, pairing backhauls</p>
          </div>
        </div>
      ) : (
        <div id="scr-dash" style={{ display: "block" }}>
          <div className="dash-layout">
            <CalendarPanel
              selDate={selDate}
              setSelDate={setSelDate}
              jobs={jobs}
              teams={teams}
            />

            <div className="sched">
              <div className="datebar">
                <div>
                  <h2 id="date-h">{selDate ? new Date(selDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : "Select a date"}</h2>
                  <p id="date-sub">{selDate ? `Start & return: ${HUB.short}` : "Click a day in the calendar"}</p>
                </div>
                <div className="datebar-r" ref={moreMenuRef}>
                  <button className="btn amber" onClick={() => setAddOpen(true)}>
                    <i className="ti ti-plus"></i> Add order
                  </button>
                  <button className="btn g-teal" onClick={handleAutopack}>
                    <i className="ti ti-wand"></i> Auto-assign
                  </button>
                  <button className="btn g-amber" onClick={handleOpenSuggestions} title="Simulated improvements">
                    <i className="ti ti-bulb"></i> Suggestions
                  </button>
                  <button className="btn" onClick={() => window.print()} title="Print day sheet">
                    <i className="ti ti-printer"></i>
                  </button>
                  <button 
                    className="btn" 
                    onClick={onUndo} 
                    disabled={!canUndo} 
                    style={{ opacity: canUndo ? 1 : 0.4 }} 
                    title="Undo last change"
                  >
                    <i className="ti ti-arrow-back-up"></i>
                  </button>
                  <button className="btn" onClick={() => {
                    const next = document.body.classList.contains("light") ? "dark" : "light";
                    document.body.classList.toggle("light", next === "light");
                  }} title="Switch theme">
                    <i className="ti ti-moon"></i>
                  </button>
                  <button className="btn" onClick={() => setShowLegend(!showLegend)} title="Badges legend">
                    <i className="ti ti-help"></i>
                  </button>
                  <button className="btn" onClick={() => setMoreMenuOpen(!moreMenuOpen)} title="More options">
                    <i className="ti ti-dots"></i>
                  </button>
                  
                  {moreMenuOpen && (
                    <div id="more-menu" style={{ display: "block", position: "absolute", right: 0, top: "34px", background: "var(--s2)", border: "1px solid var(--b2)", borderRadius: "6px", padding: "4px", zIndex: 30, minWidth: "200px" }}>
                      <button className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", background: "none" }} onClick={() => {
                        const fileData = JSON.stringify({ v: 1, jobs, teams, drivers, crew, trucks, venues, def: defaults, fuel: fuelConfig, crewRate });
                        const blob = new Blob([fileData], { type: "application/json" });
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = `mintops-backup-${selDate}.json`;
                        link.click();
                        setMoreMenuOpen(false);
                      }}>
                        <i className="ti ti-download"></i> Download backup
                      </button>
                      <button className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", background: "none" }} onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".json";
                        input.onchange = e => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          const r = new FileReader();
                          r.onload = ev => {
                            if (ev.target?.result) {
                              try {
                                const parsed = JSON.parse(ev.target.result as string);
                                if (parsed && Array.isArray(parsed.jobs)) {
                                  onUpdateJobs(parsed.jobs);
                                  alert("Backup restored successfully!");
                                } else {
                                  alert("Invalid backup format");
                                }
                              } catch(err) {
                                alert("Failed to parse JSON backup");
                              }
                            }
                          };
                          r.readAsText(file);
                        };
                        input.click();
                        setMoreMenuOpen(false);
                      }}>
                        <i className="ti ti-file-import"></i> Restore from backup…
                      </button>
                      <div style={{ height: "1px", background: "var(--b1)", margin: "4px 0" }}></div>
                      <button className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", background: "none" }} onClick={handleLoadDemo}>
                        <i className="ti ti-flask"></i> Load demo data
                      </button>
                      <button className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", background: "none", color: "var(--red)" }} onClick={handleClearAll}>
                        <i className="ti ti-trash"></i> Clear all orders
                      </button>
                      <div style={{ height: "1px", background: "var(--b1)", margin: "4px 0" }}></div>
                      <button className="btn" style={{ width: "100%", justifyContent: "flex-start", border: "none", background: "none" }} onClick={() => { fileInputRef.current?.click(); setMoreMenuOpen(false); }}>
                        <i className="ti ti-upload"></i> Import CSV file
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {selDate && (
                <div id="sched-body">
                  {getWeekAheadStrip()}
                  {getKPIBar()}

                  {showLegend && (
                    <div className="legend">
                      <div className="leg"><span className="tlab">DEL / COLL</span> job type</div>
                      <div className="leg"><span className="bdg b-multi">👑 CONVOY</span> big order — all trucks travel together</div>
                      <div className="leg"><span className="bdg b-part" title="Separate trucks">LOAD 2/4</span> separate trucks, within setup window</div>
                      <div className="leg"><span className="bdg b-back">BACKHAUL ⇄</span> no empty return</div>
                      <div className="leg"><span className="bdg b-same">SAME TEAM ✓</span> linked pair</div>
                      <div className="leg"><span className="bdg b-split">SPLIT CREW</span> different teams per leg</div>
                      <div className="leg"><span className="bdg b-warn">TIME CLASH / BUFFER</span> timing warnings</div>
                      <div className="leg"><span className="bdg b-dead">CANCELLED</span> cancelled orders</div>
                    </div>
                  )}

                  {jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id).length > 0 && (
                    <div style={{ border: "1px solid rgba(240,82,82,.5)", background: "var(--rd)", borderRadius: "var(--rsm)", marginBottom: "10px", overflow: "hidden" }}>
                      <div style={{ padding: "8px 12px", fontSize: "11px", color: "var(--red)" }}>
                        <i className="ti ti-alert-triangle"></i> <strong>{jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id).length}</strong> job(s) could not be physically scheduled. Try <strong>Suggestions</strong>, shift timing, or assign manually.
                      </div>
                      <table className="jt">
                        <tbody>
                          {jobs.filter(j => j.date === selDate && j.status !== 'cancelled' && !isSplitParent(j) && !j.team_id).map(u => (
                            <tr key={u._id} className="jr hw">
                              <td>{u.time_window}</td>
                              <td>
                                <div className="jcli">
                                  {u.client}
                                  <span className="jno" onClick={() => onOpenOrderDetails(u._id)}>{u.order_no}</span>
                                </div>
                                <div className="jadr">{u.address}</div>
                              </td>
                              <td colSpan={5} style={{ color: "var(--red)", fontSize: "11px", padding: "8px 12px" }}>
                                same-team rule clash or timing conflict.
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "6px", marginBottom: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <button className={`btn sm ${!tlView ? 'g-amber' : ''}`} onClick={() => setTlView(false)}>
                      <i className="ti ti-list"></i> List
                    </button>
                    <button className={`btn sm ${tlView ? 'g-amber' : ''}`} onClick={() => setTlView(true)}>
                      <i className="ti ti-chart-bar"></i> Timeline
                    </button>
                    {tlView && (
                      <span style={{ fontSize: "10px", color: "var(--t3)" }}>
                        blue del · amber col · purple convoy · teal load · dashed = helper duty · grey = driving
                      </span>
                    )}
                  </div>

                  {tlView ? (
                    renderGanttTimeline(helperDuty)
                  ) : (
                    <>
                      <div className="ttabs">
                        {teams.map(t => {
                          const v = views.find(x => x.team.id === t.id);
                          const p = TPAL[t.colorIdx % TPAL.length];
                          const isA = t.id === activeTid;
                          const offWhy = teamOffReason(t, selDate, drivers, trucks);
                          
                          if (!v) {
                            const duty = helperDuty[t.id];
                            if (duty) {
                              return (
                                <button key={t.id} className={`ttab ${isA ? 'active' : ''}`} onClick={() => setActiveTid(t.id)}>
                                  <span className="tdot" style={{ background: p.dot }}></span>{t.label}
                                  <span style={{ fontSize: "10px", color: "var(--purple)" }}> (helper)</span>
                                </button>
                              );
                            }
                            if (offWhy) {
                              return (
                                <button key={t.id} className={`ttab empty ${isA ? 'active' : ''}`} onClick={() => setActiveTid(t.id)} style={{ opacity: 0.55 }}>
                                  <span className="tdot" style={{ background: p.dot }}></span><span style={{ textDecoration: "line-through" }}>{t.label}</span>
                                  <span style={{ fontSize: "10px", color: "var(--red)" }}> (off · {offWhy})</span>
                                </button>
                              );
                            }
                            return (
                              <button key={t.id} className={`ttab empty ${isA ? 'active' : ''}`} onClick={() => setActiveTid(t.id)}>
                                <span className="tdot" style={{ background: p.dot }}></span>{t.label}
                                <span style={{ fontSize: "10px", opacity: 0.6 }}> (free)</span>
                              </button>
                            );
                          }
                          const shortC = teamShortCrew(t, selDate, crew);
                          const over = v.runs.some((r: any) => r.over);
                          return (
                            <button key={t.id} className={`ttab ${isA ? 'active' : ''}`} onClick={() => setActiveTid(t.id)}>
                              <span className="tdot" style={{ background: p.dot }}></span>{t.label}{t.outsourced ? <span style={{ fontSize: "9px", color: "var(--purple)" }}> ⟂</span> : ''}
                              {v.nRuns > 1 && <span style={{ fontSize: "10px", color: "var(--amber)" }}> ×{v.nRuns}</span>}
                              {over && <span style={{ fontSize: "10px", color: "var(--red)" }}> ▲</span>}
                              {v.warns > 0 && <span style={{ fontSize: "10px", color: "var(--red)" }}> ⚠</span>}
                              {v.backhauls > 0 && <span style={{ fontSize: "10px", color: "var(--teal)" }}> ⇄</span>}
                              {shortC > 0 && <span style={{ fontSize: "10px", color: "var(--amber)" }} title="Short crew"> ⚠ short</span>}
                              <span style={{ fontSize: "10px", opacity: 0.6 }}> ({v.jobs.length})</span>
                            </button>
                          );
                        })}
                      </div>

                      <div id="active-panel">
                        {renderActiveTeamPanel()}
                      </div>

                      {renderConvoysPanel()}

                      <div className="wa-panel" style={{ marginTop: "14px" }}>
                        <div className="wa-hdr">
                          <h3>WhatsApp Roster — {selDate ? new Date(selDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : ""}</h3>
                          <select className="wa-sel" value={activeTid || ""} onChange={e => setActiveTid(e.target.value)}>
                            {views.map(v => (
                              <option key={v.team.id} value={v.team.id}>{v.team.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="wa-body" style={{ maxHeight: "250px", overflowY: "auto" }}>
                          {views.find(v => v.team.id === activeTid) ? (
                            getWhatsAppMessage(views.find(v => v.team.id === activeTid))
                          ) : (
                            "No jobs scheduled for selected team today."
                          )}
                        </div>
                        <div className="wa-ftr">
                          <button className="btn" onClick={() => {
                            const v = views.find(vw => vw.team.id === activeTid);
                            if (v) handleCopyTeamWA(v);
                          }}>
                            <i className="ti ti-copy"></i> Copy team
                          </button>
                          <button className="btn" onClick={handleCopyAllWA}>
                            <i className="ti ti-copy"></i> Copy all
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <SuggestionsModal
        isOpen={sugModalOpen}
        onClose={() => setSugModalOpen(false)}
        suggestions={suggestions}
        onApplySuggestion={handleApplySuggestion}
      />

      <OutCostModal
        isOpen={outCostModalOpen}
        onClose={() => setOutCostModalOpen(false)}
        jobs={jobs}
        teams={teams}
        trucks={trucks}
        date={selDate}
        onOpenOrder={onOpenOrderDetails}
      />
    </div>
  );
}
