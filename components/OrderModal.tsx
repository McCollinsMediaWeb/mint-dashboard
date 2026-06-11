import React from "react";
import { Job, Team, Truck } from "@/lib/types";
import { coreNo, normSize, jobTrucks, jobCrew, isSplitParent, fmtDur, jobBuffer } from "@/lib/utils";
import { TPAL } from "@/lib/constants";

interface OrderModalProps {
  isOpen: boolean;
  jobId: string | null;
  jobs: Job[];
  teams: Team[];
  trucks: Truck[];
  onClose: () => void;
  onUpdateJob: (jobId: string, updates: Partial<Job>) => void;
  onGotoDate: (date: string) => void;
}

export default function OrderModal({
  isOpen,
  jobId,
  jobs,
  teams,
  trucks,
  onClose,
  onUpdateJob,
  onGotoDate
}: OrderModalProps) {
  if (!isOpen || !jobId) return null;

  // Find job, if portion, get parent
  let targetJob = jobs.find(x => x._id === jobId);
  if (!targetJob) return null;
  if (targetJob._portionOf) {
    const parent = jobs.find(x => x._id === targetJob!._portionOf);
    if (parent) {
      targetJob = parent;
    }
  }

  const core = coreNo(targetJob.order_no);
  
  // Find both legs
  const del = jobs.find(x => !x._portionOf && x.order_no === "D-" + core) || 
              (targetJob.type.toLowerCase() !== "collection" ? targetJob : (targetJob.linked_order ? jobs.find(x => !x._portionOf && x.order_no === targetJob!.linked_order) : null));
              
  const col = jobs.find(x => !x._portionOf && x.order_no === "C-" + core) || 
              (targetJob.type.toLowerCase() === "collection" ? targetJob : (targetJob.linked_order ? jobs.find(x => !x._portionOf && x.order_no === targetJob!.linked_order && x.type.toLowerCase() === "collection") : null));

  const baseJob = del || col || targetJob;

  const renderTeamChip = (teamId: string | null) => {
    const t = teams.find(x => x.id === teamId);
    if (!t) return <span style={{ color: "var(--t3)" }}>— unassigned</span>;
    return (
      <span className="team-chip">
        <span className="tdot" style={{ background: TPAL[t.colorIdx % TPAL.length].dot, width: "7px", height: "7px", borderRadius: "50%", display: "inline-block", marginRight: "5px" }}></span>
        {t.label}
      </span>
    );
  };

  const progLbl: Record<string, string> = { "": "Pending", dispatched: "Dispatched", onsite: "On site", done: "Done ✓" };

  const renderLegHTML = (L: Job | undefined | null, label: string, color: string) => {
    if (!L) {
      return (
        <div className="od-leg">
          <div className="od-leg-h" style={{ color: color }}>{label}</div>
          <div className="od-missing">No {label.toLowerCase()} recorded for this order.</div>
        </div>
      );
    }

    const portionJobs = jobs.filter(x => x._portionOf === L._id);
    const assignedTeam = L.team_id ? teams.find(t => t.id === L.team_id) : null;
    const ownTruck = assignedTeam ? trucks.find(t => t.id === assignedTeam.truckId) : null;

    return (
      <div className="od-leg">
        <div className="od-leg-h" style={{ color: color }}>{label}</div>
        
        <div className="od-row">
          <span>Order no.</span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{L.order_no}</span>
        </div>
        <div className="od-row">
          <span>Date</span>
          <span>{L.date ? new Date(L.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : "—"}</span>
        </div>
        <div className="od-row">
          <span>Arrival</span>
          <span>{L.time_window || "TBC"}</span>
        </div>
        <div className="od-row">
          <span>Setup</span>
          <span>{fmtDur(L.setup_mins || 60)}</span>
        </div>
        <div className="od-row">
          <span>Buffer</span>
          <span>{fmtDur(jobBuffer(L, 30))}</span>
        </div>
        
        <div className="od-row">
          <span>Load</span>
          <span style={{ display: "flex", gap: "5px", alignItems: "center", flexWrap: "wrap" }}>
            <select 
              className="fsel" 
              style={{ fontSize: "11px", padding: "3px 6px" }}
              value={normSize(L.size)}
              onChange={e => onUpdateJob(L._id, { size: normSize(e.target.value) })}
            >
              <option value="XS">XS · 10%</option>
              <option value="S">S · 25%</option>
              <option value="M">M · 50%</option>
              <option value="L">L · 75%</option>
              <option value="XL">XL · 100%</option>
            </select>
            <input 
              className="finp" 
              style={{ fontSize: "11px", padding: "3px 6px", width: "52px" }}
              type="number" 
              min="1"
              value={jobTrucks(L)}
              onChange={e => onUpdateJob(L._id, { trucks: Math.max(1, parseInt(e.target.value, 10) || 1) })}
              title="Trucks needed"
            />
            <span style={{ fontSize: "10px", color: "var(--t3)" }}>trucks</span>
            <input 
              className="finp" 
              style={{ fontSize: "11px", padding: "3px 6px", width: "52px" }}
              type="number" 
              min="0"
              value={jobCrew(L)}
              onChange={e => onUpdateJob(L._id, { crew: Math.max(0, parseInt(e.target.value, 10) || 0) })}
              title="Total crew"
            />
            <span style={{ fontSize: "10px", color: "var(--t3)" }}>crew</span>
          </span>
        </div>

        {isSplitParent(L) ? (
          <>
            <div className="od-row">
              <span>Mode</span>
              <span>Separate trucks — all arrive within the setup window</span>
            </div>
            {portionJobs.map((pt, i) => (
              <div key={pt._id} className="od-row">
                <span>Load {i + 1}/{portionJobs.length}</span>
                <span>
                  {renderTeamChip(pt.team_id)} · {progLbl[pt.status === "cancelled" ? "cancelled" : (pt as any).prog || ""]}
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="od-row">
              <span>Team</span>
              <span>{renderTeamChip(L.team_id)}</span>
            </div>
            <div className="od-row">
              <span>Truck (override)</span>
              <span>
                <select 
                  className="fsel" 
                  style={{ fontSize: "11px", padding: "3px 6px", maxWidth: "200px" }}
                  value={(L as any).truckOverride || ""}
                  onChange={e => onUpdateJob(L._id, { truckOverride: e.target.value || undefined })}
                >
                  <option value="">
                    Team&apos;s own{ownTruck ? ` · ${ownTruck.plate} (${ownTruck.tonnage || 5}t)` : ""}
                  </option>
                  {trucks.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.plate} ({t.tonnage || 5}t)
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="od-row">
              <span>Crew note</span>
              <span>
                <input 
                  className="finp" 
                  style={{ fontSize: "11px", padding: "3px 6px", width: "100%", maxWidth: "240px" }}
                  value={(L as any).crewNote || ""}
                  onChange={e => onUpdateJob(L._id, { crewNote: e.target.value })}
                  placeholder="e.g. send Dalpat for setup"
                />
              </span>
            </div>
            {jobTrucks(L) > 1 && L.split === false && (
              <div className="od-row">
                <span>Convoy</span>
                <span>
                  👑 lead + {L._helpers && L._helpers.length > 0 ? L._helpers.map((h: any) => h.label + (h.kind === 'team' ? '' : ' (out)')).join(', ') : 'helpers TBD'}
                  {L._helperShort ? <span style={{ color: "var(--red)" }}> · short {L._helperShort}</span> : ""}
                </span>
              </div>
            )}
            <div className="od-row">
              <span>Status</span>
              <span>
                {L.status === 'cancelled' ? (
                  <span className="bdg b-dead">CANCELLED</span>
                ) : (
                  <select
                    className="sel"
                    style={{ fontSize: "11px", padding: "2px 4px" }}
                    value={(L as any).prog || ""}
                    onChange={e => onUpdateJob(L._id, { prog: e.target.value })}
                  >
                    <option value="">Pending</option>
                    <option value="dispatched">Dispatched</option>
                    <option value="onsite">On site</option>
                    <option value="done">Done ✓</option>
                  </select>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div id="ord-modal" className="open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="od-card">
        <div className="od-hdr">
          <div style={{ flex: 1 }}>
            <h3>
              {baseJob.client} <span className="jno" style={{ cursor: "default" }}>MQTN{core}</span>
            </h3>
            <div className="od-sub">
              <i className="ti ti-map-pin" style={{ fontSize: "11px" }}></i> {baseJob.address}
              {baseJob.venue_type && (
                <> · <i className="ti ti-building" style={{ fontSize: "11px" }}></i> {baseJob.venue_type}</>
              )}
              {baseJob.phone && (
                <>
                  <br />
                  <i className="ti ti-phone" style={{ fontSize: "11px" }}></i> {baseJob.phone}
                </>
              )}
              {baseJob.items && (
                <>
                  <br />
                  <i className="ti ti-packages" style={{ fontSize: "11px" }}></i> {baseJob.items}
                </>
              )}
              {baseJob.notes && (
                <>
                  <br />
                  <i className="ti ti-note" style={{ fontSize: "11px" }}></i> {baseJob.notes}
                </>
              )}
            </div>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: "15px" }}></i>
          </button>
        </div>

        <div className="od-body">
          {renderLegHTML(del, "Delivery", "var(--blue)")}
          {renderLegHTML(col, "Collection", "var(--amber)")}
        </div>

        <div className="od-ftr">
          {del && del.date && (
            <button className="btn g-blue" onClick={() => onGotoDate(del.date)}>
              <i className="ti ti-calendar"></i> Open delivery day
            </button>
          )}
          {col && col.date && (
            <button className="btn g-amber" onClick={() => onGotoDate(col.date)}>
              <i className="ti ti-calendar"></i> Open collection day
            </button>
          )}
          <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
