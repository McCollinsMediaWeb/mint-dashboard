import React, { useState } from "react";
import { Job, Team, AppDefaults, FuelConfig } from "@/lib/types";
import { fmtLong, twS, isSplitParent, isPortion, jobTrucks } from "@/lib/utils";
import { TPAL } from "@/lib/constants";
import { packDate } from "@/lib/optimizer";

interface AllOrdersScreenProps {
  jobs: Job[];
  teams: Team[];
  trucks: any[];
  drivers: any[];
  crew: any[];
  defaults: AppDefaults;
  fuelConfig: FuelConfig;
  onUpdateJobs: (updatedJobs: Job[]) => void;
  onOpenOrderDetails: (jobId: string) => void;
  setSelDate: (date: string) => void;
  setActiveTab: (tab: string) => void;
}

export default function AllOrdersScreen({
  jobs,
  teams,
  trucks,
  drivers,
  crew,
  defaults,
  fuelConfig,
  onUpdateJobs,
  onOpenOrderDetails,
  setSelDate,
  setActiveTab
}: AllOrdersScreenProps) {
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [team, setTeam] = useState("all");
  const [status, setStatus] = useState("active");
  const [sort, setSort] = useState("date_asc");

  // Filter list
  const lowerQ = q.trim().toLowerCase();
  const list = jobs.filter(j => {
    if (isPortion(j)) return false; // portions roll up under their parent order
    if (status === "active" && j.status === "cancelled") return false;
    if (type !== "all" && j.type.toLowerCase() !== type) return false;
    if (team === "none" && j.team_id) return false;
    if (team !== "all" && team !== "none" && j.team_id !== team) return false;
    
    if (lowerQ) {
      const hay = `${j.order_no || ""} ${j.client || ""} ${j.address || ""} ${j.items || ""}`.toLowerCase();
      if (!hay.includes(lowerQ)) return false;
    }
    return true;
  });

  // Group by date
  const groups: Record<string, Job[]> = {};
  list.forEach(j => {
    (groups[j.date] = groups[j.date] || []).push(j);
  });

  let dates = Object.keys(groups).sort();
  if (sort === "date_desc") {
    dates.reverse();
  }

  const handleTrucksChange = (jobId: string, valStr: string) => {
    const job = jobs.find(x => x._id === jobId);
    if (!job) return;

    let v = parseInt(valStr, 10);
    if (isNaN(v) || v < 1) v = 1;

    let updated = jobs.map(j => {
      if (j._id === jobId) {
        return { ...j, trucks: v };
      }
      return j;
    });

    // Repack date
    updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, job.date);
    onUpdateJobs(updated);
  };

  const handleConvoyChange = (jobId: string, valStr: string) => {
    const job = jobs.find(x => x._id === jobId);
    if (!job) return;

    const splitVal = valStr !== "0";

    let updated = jobs.map(j => {
      if (j._id === jobId) {
        return { ...j, split: splitVal };
      }
      return j;
    });

    // Repack date
    updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, job.date);
    onUpdateJobs(updated);
  };

  const handleOpenDay = (date: string) => {
    setSelDate(date);
    setActiveTab("schedule");
  };

  const handleDeleteOrder = (jobId: string) => {
    const job = jobs.find(x => x._id === jobId);
    if (!job) return;

    if (confirm(`Delete order ${job.order_no || "unnamed"} permanently?`)) {
      let updated = jobs.filter(x => x._id !== jobId && x._portionOf !== jobId);
      
      // Clean up linked order references
      if (job.order_no) {
        updated = updated.map(x => {
          if (x.linked_order === job.order_no) {
            return { ...x, linked_order: undefined };
          }
          return x;
        });
      }

      // Repack date to update route allocations and travel times
      updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, job.date);
      onUpdateJobs(updated);
    }
  };

  return (
    <div id="scr-orders" className="screen active">
      <div className="ord-bar">
        <h2>All deliveries &amp; collections</h2>
        <input
          className="ord-search"
          id="ord-q"
          placeholder="Search client, order, address…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="sel"
          id="ord-type"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="all">All types</option>
          <option value="delivery">Deliveries</option>
          <option value="collection">Collections</option>
        </select>
        <select
          className="sel"
          id="ord-team"
          value={team}
          onChange={(e) => setTeam(e.target.value)}
        >
          <option value="all">All teams</option>
          <option value="none">Unassigned</option>
          {teams.map(t => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="sel"
          id="ord-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">Active only</option>
          <option value="all">Inc. cancelled</option>
        </select>
        <select
          className="sel"
          id="ord-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="date_asc">Date ↑ (soonest)</option>
          <option value="date_desc">Date ↓ (latest)</option>
        </select>
      </div>

      <div id="orders-body">
        {dates.length === 0 ? (
          <div className="empty-date">
            <i className="ti ti-clipboard-off"></i>
            <p>No orders match.</p>
          </div>
        ) : (
          dates.map(d => {
            const dayJobs = groups[d].sort((a, b) => {
              const aMins = twS(a.time_window) ?? 9999;
              const bMins = twS(b.time_window) ?? 9999;
              return aMins - bMins;
            });

            const dC = dayJobs.filter(j => j.type.toLowerCase() === "delivery" && j.status !== "cancelled").length;
            const cC = dayJobs.filter(j => j.type.toLowerCase() === "collection" && j.status !== "cancelled").length;

            return (
              <div key={d} className="dgrp">
                <div className="dgrp-hdr">
                  <h3>{fmtLong(d)}</h3>
                  <span className="dgc">
                    {dC} deliveries · {cC} collections
                  </span>
                  <button
                    className="btn sm g-amber"
                    style={{ marginLeft: "auto" }}
                    onClick={() => handleOpenDay(d)}
                  >
                    <i className="ti ti-calendar"></i> Open day
                  </button>
                </div>
                <div className="ot-wrap">
                  <table className="ot">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Order</th>
                        <th>Client</th>
                        <th>Address</th>
                        <th>Size</th>
                        <th>Team</th>
                        <th>Status</th>
                        <th style={{ width: "60px", textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dayJobs.map(j => {
                        const isColl = j.type.toLowerCase() === "collection";
                        const splitP = isSplitParent(j);
                        let teamCell: React.ReactNode;
                        let stCell: React.ReactNode;

                        if (splitP) {
                          const parts = jobs.filter(x => x._portionOf === j._id);
                          const tset = Array.from(new Set(parts.map(x => x.team_id).filter(Boolean)))
                            .map(id => teams.find(t => t.id === id))
                            .filter((t): t is Team => !!t);

                          teamCell = tset.length > 0 ? (
                            tset.map(t => {
                              const p = TPAL[t.colorIdx % TPAL.length];
                              return (
                                <span key={t.id} className="team-chip" style={{ marginRight: "4px" }}>
                                  <span className="tdot" style={{ background: p.dot }}></span>
                                  {t.label}
                                </span>
                              );
                            })
                          ) : (
                            <span style={{ color: "var(--t3)" }}>—</span>
                          );

                          stCell = (
                            <span className="bdg b-part">
                              {jobTrucks(j)} LOADS → {tset.length} team{tset.length !== 1 ? "s" : ""}
                            </span>
                          );
                        } else {
                          const t = teams.find(x => x.id === j.team_id);
                          const p = t ? TPAL[t.colorIdx % TPAL.length] : null;
                          teamCell = t ? (
                            <span className="team-chip">
                              <span className="tdot" style={{ background: p ? p.dot : "transparent" }}></span>
                              {t.label}
                            </span>
                          ) : (
                            <span style={{ color: "var(--t3)" }}>—</span>
                          );

                          const progB = j.prog ? (
                            <span className={`bdg ${j.prog === "done" ? "b-same" : (j.prog === "onsite" ? "b-col" : "b-del")}`}>
                              {j.prog === "onsite" ? "ON SITE" : j.prog.toUpperCase()}
                            </span>
                          ) : null;

                          stCell = j.status === "cancelled" ? (
                            <span className="bdg b-dead">CANCELLED</span>
                          ) : (
                            <span style={{ display: "flex", gap: "4px", flexWrap: "wrap", alignItems: "center" }}>
                              {progB}
                              {jobTrucks(j) > 1 ? (
                                <span className="bdg b-multi">👑 CONVOY ×{jobTrucks(j)}</span>
                              ) : j._backhaul ? (
                                <span className="bdg b-back">BACKHAUL</span>
                              ) : j.continuity === "same_team" ? (
                                <span className="bdg b-same">LINKED</span>
                              ) : (
                                <span style={{ color: "var(--green)", fontSize: "11px" }}>Active</span>
                              )}
                            </span>
                          );
                        }

                        const ctrl = (!isPortion(j) && j.status !== "cancelled" && !isColl) ? (
                          <div style={{ display: "flex", gap: "5px", alignItems: "center", marginTop: "4px" }}>
                            <span style={{ fontSize: "10px", color: "var(--t3)" }}>🚛</span>
                            <input
                              className="rq-inp"
                              type="number"
                              min={1}
                              max={30}
                              value={jobTrucks(j)}
                              onChange={(e) => handleTrucksChange(j._id, e.target.value)}
                              title="Trucks for this order"
                              style={{ width: "42px" }}
                            />
                            {jobTrucks(j) > 1 && (
                              <select
                                className="sz-sel"
                                value={j.split !== false ? "1" : "0"}
                                onChange={(e) => handleConvoyChange(j._id, e.target.value)}
                                title="Split across teams or arrive together"
                              >
                                <option value="1">independent</option>
                                <option value="0">convoy</option>
                              </select>
                            )}
                          </div>
                        ) : null;

                        return (
                          <tr key={j._id} className={j.status === "cancelled" ? "cancelled" : ""}>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                              {j.time_window || "TBC"}
                            </td>
                            <td>
                              <span className="tlab">{isColl ? "COLL" : "DEL"}</span>
                            </td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px" }}>
                              <span
                                className="od-link"
                                onClick={() => onOpenOrderDetails(j._id)}
                                title="Open order details"
                              >
                                {j.order_no || ""}
                              </span>
                            </td>
                            <td>{j.client}</td>
                            <td style={{ color: "var(--t2)", fontSize: "11px" }}>{j.address}</td>
                            <td>
                              <span className={`szb sz-${j.size}`}>{j.size}</span>
                            </td>
                            <td>{teamCell}</td>
                            <td>
                              {stCell}
                              {ctrl}
                            </td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                className="icon-btn danger"
                                onClick={() => handleDeleteOrder(j._id)}
                                title="Delete order permanently"
                              >
                                <i className="ti ti-trash"></i>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
