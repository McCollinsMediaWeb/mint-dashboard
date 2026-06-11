import React from "react";
import { Job, Team, Driver, Crew, Truck, AppDefaults, FuelConfig } from "@/lib/types";
import { recalcDate } from "@/lib/optimizer";
import { fmtLong, twS, toS, fmtDur, normSize, loadMins, jobTrucks } from "@/lib/utils";
import { outsourceTripCost } from "@/lib/routing";
import { HUB } from "@/lib/constants";

interface PrintSheetProps {
  jobs: Job[];
  teams: Team[];
  drivers: Driver[];
  crew: Crew[];
  trucks: Truck[];
  defaults: AppDefaults;
  fuelConfig: FuelConfig;
  selDate: string;
}

export default function PrintSheet({
  jobs,
  teams,
  drivers,
  crew,
  trucks,
  defaults,
  fuelConfig,
  selDate
}: PrintSheetProps) {
  if (!selDate) return null;

  const views = recalcDate(jobs, teams, trucks, drivers, crew, defaults.buf, fuelConfig, selDate);

  const teamSubLine = (team: Team) => {
    const drv = drivers.find(d => d.id === team.driverId);
    const cr1 = crew.find(c => c.id === team.crew1Id);
    const cr2 = crew.find(c => c.id === team.crew2Id);
    const trk = trucks.find(t => t.id === team.truckId);
    
    const parts: string[] = [];
    parts.push(drv ? drv.name : "No driver");
    
    const crNames = [cr1, cr2].filter(Boolean).map(c => c!.name.split(" ")[0]);
    parts.push(crNames.length > 0 ? crNames.join(", ") : "No crew");
    parts.push(trk ? `${trk.plate} (${trk.tonnage || 5}t)` : "No truck (assume 5t)");
    
    return parts.join(" · ");
  };

  const getOutsourceDetails = () => {
    let n = 0;
    let c = 0;

    jobs
      .filter(j => j.date === selDate && j.status !== "cancelled" && jobTrucks(j) > 1 && j.split === false)
      .forEach(j => {
        (j._helpers || []).forEach((h: any) => {
          if (h.kind === "truck") {
            n++;
            c += outsourceTripCost(j.address);
          } else if (h.kind === "team") {
            const ht = teams.find(x => x.id === h.tid);
            if (ht && ht.outsourced) {
              n++;
              c += outsourceTripCost(j.address);
            }
          }
        });
      });

    views.forEach(v => {
      if (v.team.outsourced) {
        v.runs.forEach((r: any) => {
          n++;
          c += outsourceTripCost(r.jobs[0].address);
        });
      }
    });

    return n > 0 ? ` · outsource: ${n} trip${n > 1 ? "s" : ""} — AED ${c}` : "";
  };

  return (
    <div id="print-sheet">
      <h1>MINT EVENT RENTALS — DAY SHEET</h1>
      <div className="ps-meta">
        {fmtLong(selDate)} · Hub: {HUB.name} · {views.length} team{views.length !== 1 ? "s" : ""} on the road
        {getOutsourceDetails()} · printed {new Date().toLocaleString("en-GB")}
      </div>

      {views.length === 0 ? (
        <p>No jobs scheduled for this date.</p>
      ) : (
        views.map(v => (
          <div key={v.team.id} className="ps-team">
            <div className="ps-thdr">
              TEAM {v.team.label.toUpperCase()} — {v.jobs.length} jobs · {v.nRuns} leg{v.nRuns > 1 ? "s" : ""} · start {v.st} → wrap {v.et} · ~{v.km} km
            </div>
            <div className="ps-sub">{teamSubLine(v.team)}</div>
            
            {v.runs.map((run: any, ri: number) => {
              const dT = twS(run.jobs[0].time_window);
              const lg = run.multi
                ? loadMins(run.jobs[0].size)
                : run.jobs.reduce((x: number, j: Job) => x + (j.type.toLowerCase() !== "collection" ? loadMins(j.size) : 0), 0);

              const loadAndDepartInfo = () => {
                const loadStr = (dT != null && lg > 0) ? `start loading by ${toS(dT - run.departMin - lg)} (${fmtDur(lg)}) · ` : "";
                const departStr = `depart ${HUB.short}${dT != null ? ` by ${toS(dT - run.departMin)}` : ""}`;
                return loadStr + departStr;
              };

              return (
                <div key={ri}>
                  <div className="ps-run">
                    {run.multi ? `CONVOY ${ri + 1} — ${run.trucks} trucks · ${run.crew} crew` : `LEG ${ri + 1}`} — {loadAndDepartInfo()} (drive ~{fmtDur(run.departMin)} · ~{run.departKm} km)
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th style={{ width: "46px" }}>Time</th>
                        <th style={{ width: "36px" }}>Type</th>
                        <th>Client / phone</th>
                        <th>Address</th>
                        <th>Items</th>
                        <th style={{ width: "30px" }}>Size</th>
                        <th style={{ width: "52px" }}>Setup</th>
                        <th>Site notes</th>
                        <th style={{ width: "24px" }}>✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {run.jobs.map((j: Job) => (
                        <tr key={j._id}>
                          <td>{toS(twS(j.time_window))}</td>
                          <td>{j.type.toLowerCase() === "collection" ? "COLL" : "DEL"}</td>
                          <td>
                            {j.client}
                            {j.phone ? (
                              <>
                                <br />
                                {j.phone}
                              </>
                            ) : null}
                          </td>
                          <td>
                            {j.address}
                            {j.venue_type ? (
                              <>
                                <br />
                                <i>{j.venue_type}</i>
                              </>
                            ) : null}
                          </td>
                          <td>{j.items || ""}</td>
                          <td>{normSize(j.size)}</td>
                          <td>{fmtDur(j.setup_mins || 30)}</td>
                          <td>
                            {j.notes || ""}
                            {j.split_note ? (
                              <>
                                <br />
                                {j.split_note}
                              </>
                            ) : null}
                          </td>
                          <td></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {run.multi && (
                    <div className="ps-conv">
                      👑 Leader: {v.team.label}
                      {(run.jobs[0]._helpers || []).map((x: any, xi: number) => (
                        <span key={xi}>
                          {" "}· Helper {xi + 1}: {x.label} ({x.kind === "team" ? "in-house" : "outsource"})
                          {x.late > 0 ? ` arrives ~${fmtDur(x.late)} later` : ""}
                        </span>
                      ))}
                      {run.jobs[0]._helperShort > 0 ? ` · ⚠ SHORT ${run.jobs[0]._helperShort} TRUCK(S)` : null}
                    </div>
                  )}
                  <div className="ps-hub">
                    Return to {HUB.short} (drive ~{fmtDur(run.returnMin)} · ~{run.returnKm} km)
                    {ri < v.runs.length - 1 ? " — offload & reload for next leg" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
