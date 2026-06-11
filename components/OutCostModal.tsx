import React from "react";
import { Job, Team, Truck } from "@/lib/types";
import { jobTrucks, jobBuffer, normSize, toS, twS } from "@/lib/utils";
import { dz, outsourceTripCost } from "@/lib/routing";

interface OutCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobs: Job[];
  teams: Team[];
  trucks: Truck[];
  date: string;
  onOpenOrder: (jobId: string) => void;
}

export default function OutCostModal({
  isOpen,
  onClose,
  jobs,
  teams,
  trucks,
  date,
  onOpenOrder
}: OutCostModalProps) {
  if (!isOpen) return null;

  const items: any[] = [];
  
  // 1) helper convoy outsourced trucks
  jobs.filter(j => j.date === date && j.status !== 'cancelled' && jobTrucks(j) > 1 && j.split === false).forEach(j => {
    (j._helpers || []).forEach((h: any) => {
      if (h.kind === 'truck') {
        items.push({ j, h, aed: outsourceTripCost(j.address) });
      } else if (h.kind === 'team') {
        const ht = teams.find(x => x.id === h.tid);
        if (ht && ht.outsourced) {
          items.push({ j, h: { label: h.label + ' (crew)', truck: h.truck }, aed: outsourceTripCost(j.address) });
        }
      }
    });
  });

  // 2) outsourced team runs
  // Recalculating runs to count cost for outsourced teams
  const activeTeams = teams.filter(t => t.outsourced);
  activeTeams.forEach(team => {
    const teamJobs = jobs.filter(j => j.date === date && j.team_id === team.id && j.status !== 'cancelled')
      .sort((a, b) => (twS(a.time_window) ?? 9999) - (twS(b.time_window) ?? 9999));
    if (!teamJobs.length) return;
    
    // Simple runs estimation
    const cap = 0.75; // Outsource defaults to 3t
    let currentRunJobs: Job[] = [];
    let currentRunLoad = 0;
    
    teamJobs.forEach((job, idx) => {
      const f = 0.25; // Default portion S
      if (currentRunJobs.length > 0 && currentRunLoad + f > cap) {
        items.push({
          j: currentRunJobs[0],
          h: { label: `${team.label} — own crew, leg ${items.filter(it => it.h.label.includes(team.label)).length + 1}`, truck: trucks.find(t => t.id === team.truckId) || null },
          aed: outsourceTripCost(currentRunJobs[0].address)
        });
        currentRunJobs = [job];
        currentRunLoad = f;
      } else {
        currentRunJobs.push(job);
        currentRunLoad += f;
      }
    });
    
    if (currentRunJobs.length > 0) {
      items.push({
        j: currentRunJobs[0],
        h: { label: `${team.label} — own crew, leg ${items.filter(it => it.h.label.includes(team.label)).length + 1}`, truck: trucks.find(t => t.id === team.truckId) || null },
        aed: outsourceTripCost(currentRunJobs[0].address)
      });
    }
  });

  const total = items.reduce((sum, item) => sum + item.aed, 0);

  const zoneLabel = (zone: string) => {
    return zone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const getShortDate = (dString: string) => {
    if (!dString) return "";
    return new Date(dString + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  return (
    <div id="sug-modal" className="open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="od-card" style={{ maxWidth: "680px" }}>
        <div className="od-hdr">
          <div style={{ flex: 1 }}>
            <h3>
              <i className="ti ti-truck" style={{ color: "var(--purple)", marginRight: "5px" }}></i> 
              Outsource Trucks — {getShortDate(date)}
            </h3>
            <div className="od-sub">
              One line per hired truck · AED 200 per Dubai trip · AED 350 per Abu Dhabi trip.
            </div>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: "15px" }}></i>
          </button>
        </div>

        <div className="od-body" style={{ display: "block" }}>
          {items.length > 0 ? (
            <table className="ot" style={{ minWidth: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Order</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Client</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Destination</th>
                  <th style={{ padding: "8px 12px", textAlign: "left" }}>Truck</th>
                  <th style={{ padding: "8px 12px", textAlign: "right" }}>AED</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: "8px 12px" }}>
                      <span className="od-link" onClick={() => { onClose(); onOpenOrder(x.j._id); }}>
                        {x.j.order_no}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>{x.j.client}</td>
                    <td style={{ padding: "8px 12px", color: "var(--t2)", fontSize: "11px" }}>
                      {zoneLabel(dz(x.j.address))} · {twS(x.j.time_window) != null ? toS(twS(x.j.time_window)) : "TBC"}
                    </td>
                    <td style={{ padding: "8px 12px", fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                      {x.h.label} ({x.h.truck ? x.h.truck.tonnage || 5 : 5}t)
                    </td>
                    <td style={{ padding: "8px 12px", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
                      {x.aed}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 600, borderTop: "1px solid var(--b2)", padding: "12px 12px 8px" }}>
                    Total
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 600, fontFamily: "'JetBrains Mono', monospace", borderTop: "1px solid var(--b2)", padding: "12px 12px 8px" }}>
                    AED {total}
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="od-missing" style={{ padding: "20px 16px" }}>
              No outsource trucks hired on this date.
            </div>
          )}
        </div>

        <div className="od-ftr">
          <button className="btn" style={{ marginLeft: "auto" }} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
