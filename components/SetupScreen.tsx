import React, { useState } from "react";
import { Job, Team, Driver, Crew, Truck, Venue, AppDefaults, FuelConfig, ShowPreferences } from "@/lib/types";
import { uid, initials, teamBadge, resAvailable, todayStr, teamDayAvailable, teamShortCrew, teamOffReason } from "@/lib/utils";
import { packDate } from "@/lib/optimizer";
import { buildFleet } from "@/lib/utils";
import { TPAL } from "@/lib/constants";

interface SetupScreenProps {
  jobs: Job[];
  teams: Team[];
  drivers: Driver[];
  crew: Crew[];
  trucks: Truck[];
  venues: Venue[];
  defaults: AppDefaults;
  fuelConfig: FuelConfig;
  crewRate: number;
  showPrefs: ShowPreferences;
  onUpdateJobs: (jobs: Job[]) => void;
  onUpdateTeams: (teams: Team[]) => void;
  onUpdateDrivers: (drivers: Driver[]) => void;
  onUpdateCrew: (crew: Crew[]) => void;
  onUpdateTrucks: (trucks: Truck[]) => void;
  onUpdateVenues: (venues: Venue[]) => void;
  onUpdateDefaults: (defaults: AppDefaults) => void;
  onUpdateFuelConfig: (fuelConfig: FuelConfig) => void;
  onUpdateCrewRate: (crewRate: number) => void;
  onUpdateShowPrefs: (showPrefs: ShowPreferences) => void;
}

export default function SetupScreen({
  jobs,
  teams,
  drivers,
  crew,
  trucks,
  venues,
  defaults,
  fuelConfig,
  crewRate,
  showPrefs,
  onUpdateJobs,
  onUpdateTeams,
  onUpdateDrivers,
  onUpdateCrew,
  onUpdateTrucks,
  onUpdateVenues,
  onUpdateDefaults,
  onUpdateFuelConfig,
  onUpdateCrewRate,
  onUpdateShowPrefs
}: SetupScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState("teams");

  // Form toggle states
  const [driverFormOpen, setDriverFormOpen] = useState(false);
  const [crewFormOpen, setCrewFormOpen] = useState(false);
  const [truckFormOpen, setTruckFormOpen] = useState(false);
  const [otruckFormOpen, setOtruckFormOpen] = useState(false);
  const [ocrewFormOpen, setOcrewFormOpen] = useState(false);
  const [venueFormOpen, setVenueFormOpen] = useState(false);

  // Form input states
  const [dForm, setDForm] = useState({ name: "", phone: "", lic: "", status: "available" });
  const [cForm, setCForm] = useState({ name: "", phone: "", role: "", status: "available" });
  const [tForm, setTForm] = useState({ plate: "", model: "", tonnage: 5, status: "available" });
  const [otForm, setOtForm] = useState({ plate: "", model: "", tonnage: 5, rate: "" });
  const [ocForm, setOcForm] = useState({ name: "", phone: "", role: "crew", company: "" });
  const [vForm, setVForm] = useState({ name: "", setup: 60 });

  // Counts
  const tCount = teams.length;
  const dCount = drivers.filter(d => !d.outsourced).length;
  const cCount = crew.filter(c => !c.outsourced).length;
  const trCount = trucks.filter(t => !t.outsourced).length;
  const oCount = drivers.filter(d => d.outsourced).length + crew.filter(c => c.outsourced).length + trucks.filter(t => t.outsourced).length;
  const vCount = venues.length;

  const teamStatus = (t: Team) => {
    const f = [t.driverId, t.crew1Id, t.crew2Id, t.truckId].filter(Boolean).length;
    if (f === 4) return { cls: "st-ready", label: "Ready ✓" };
    if (f > 0) return { cls: "st-part", label: `${f}/4 assigned` };
    return { cls: "st-empty", label: "Empty" };
  };

  const packAllDates = (updatedJobs: Job[], currentTeams: Team[], currentTrucks: Truck[], currentDrivers: Driver[], currentCrew: Crew[], currentDefaults: AppDefaults, currentFuel: FuelConfig) => {
    if (updatedJobs.length === 0) return updatedJobs;
    const dates = Array.from(new Set(updatedJobs.map(j => j.date)));
    let packed = [...updatedJobs];
    dates.forEach(d => {
      packed = packDate(packed, currentTeams, currentTrucks, currentDrivers, currentCrew, currentDefaults.buf, currentFuel, d);
    });
    return packed;
  };

  const triggerRepack = (
    newTeams: Team[],
    newTrucks: Truck[],
    newDrivers: Driver[],
    newCrew: Crew[],
    newDefaults: AppDefaults = defaults,
    newFuel: FuelConfig = fuelConfig
  ) => {
    const packed = packAllDates(jobs, newTeams, newTrucks, newDrivers, newCrew, newDefaults, newFuel);
    onUpdateJobs(packed);
  };

  // TEAM ACTIONS
  const handleLoadMintFleet = () => {
    if (confirm("Replace the team list with the default Mint trucks, drivers, and crew?")) {
      const fleet = buildFleet();
      onUpdateDrivers(fleet.drivers);
      onUpdateCrew(fleet.crew);
      onUpdateTrucks(fleet.trucks);
      onUpdateTeams(fleet.teams);
      triggerRepack(fleet.teams, fleet.trucks, fleet.drivers, fleet.crew);
    }
  };

  const handleAddTeam = () => {
    const used = new Set(teams.map(t => t.label));
    const LABELS = ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot", "Golf", "Hotel", "India", "Juliet", "Kilo", "Lima", "Mike", "November", "Oscar", "Papa", "Quebec", "Romeo", "Sierra", "Tango"];
    const nextLabel = LABELS.find(l => !used.has(l)) || `Team ${teams.length + 1}`;
    const colorIdx = teams.length % TPAL.length;

    const newTeam: Team = {
      id: "T" + uid(),
      label: nextLabel,
      colorIdx,
      area: "Dubai",
      driverId: null,
      crew1Id: null,
      crew2Id: null,
      truckId: null
    };

    const updated = [...teams, newTeam];
    onUpdateTeams(updated);
    triggerRepack(updated, trucks, drivers, crew);
  };

  const handleDeleteTeam = (id: string, label: string) => {
    if (confirm(`Delete team ${label}? Undo can reverse it.`)) {
      const updated = teams.filter(t => t.id !== id);
      onUpdateTeams(updated);
      triggerRepack(updated, trucks, drivers, crew);
    }
  };

  const handleTeamChange = (id: string, field: keyof Team, value: any) => {
    const updated = teams.map(t => {
      if (t.id === id) {
        return { ...t, [field]: value };
      }
      return t;
    });
    onUpdateTeams(updated);
    triggerRepack(updated, trucks, drivers, crew);
  };

  // RESOURCE ACTIONS (Driver, Crew, Truck)
  const handleSaveDriver = () => {
    if (!dForm.name.trim()) return;
    const newDrv: Driver = {
      id: "D" + uid(),
      name: dForm.name.trim(),
      phone: dForm.phone.trim(),
      role: "driver",
      outsourced: false,
      active: dForm.status === "available"
    };
    if (dForm.lic.trim()) {
      (newDrv as any).license = dForm.lic.trim();
    }
    const updated = [...drivers, newDrv];
    onUpdateDrivers(updated);
    setDForm({ name: "", phone: "", lic: "", status: "available" });
    setDriverFormOpen(false);
    triggerRepack(teams, trucks, updated, crew);
  };

  const handleSaveCrew = () => {
    if (!cForm.name.trim()) return;
    const newCr: Crew = {
      id: "C" + uid(),
      name: cForm.name.trim(),
      outsourced: false,
      active: cForm.status === "available"
    };
    if (cForm.phone.trim()) (newCr as any).phone = cForm.phone.trim();
    if (cForm.role.trim()) (newCr as any).role = cForm.role.trim();
    const updated = [...crew, newCr];
    onUpdateCrew(updated);
    setCForm({ name: "", phone: "", role: "", status: "available" });
    setCrewFormOpen(false);
    triggerRepack(teams, trucks, drivers, updated);
  };

  const handleSaveTruck = () => {
    if (!tForm.plate.trim()) return;
    const ton = tForm.tonnage;
    const capFrac = ton <= 1 ? 0.25 : (ton <= 3 ? 0.75 : (ton <= 5 ? 1 : 2));
    const lp = ton <= 1 ? 12 : (ton <= 3 ? 16 : (ton <= 5 ? 20 : 28));

    const newTrk: Truck = {
      id: "TR" + uid(),
      plate: tForm.plate.trim(),
      model: tForm.model.trim(),
      tonnage: ton,
      capFrac,
      lPer100: lp,
      outsourced: false,
      active: tForm.status === "available"
    };
    const updated = [...trucks, newTrk];
    onUpdateTrucks(updated);
    setTForm({ plate: "", model: "", tonnage: 5, status: "available" });
    setTruckFormOpen(false);
    triggerRepack(teams, updated, drivers, crew);
  };

  // Delete resources
  const handleDeleteDriver = (id: string, name: string) => {
    if (confirm(`Delete driver ${name} permanently?`)) {
      // Unassign from teams
      const updatedTeams = teams.map(t => t.driverId === id ? { ...t, driverId: null } : t);
      const updatedDrivers = drivers.filter(d => d.id !== id);
      onUpdateTeams(updatedTeams);
      onUpdateDrivers(updatedDrivers);
      triggerRepack(updatedTeams, trucks, updatedDrivers, crew);
    }
  };

  const handleDeleteCrew = (id: string, name: string) => {
    if (confirm(`Delete crew member ${name} permanently?`)) {
      const updatedTeams = teams.map(t => {
        let c1 = t.crew1Id;
        let c2 = t.crew2Id;
        if (t.crew1Id === id) c1 = null;
        if (t.crew2Id === id) c2 = null;
        return { ...t, crew1Id: c1, crew2Id: c2 };
      });
      const updatedCrew = crew.filter(c => c.id !== id);
      onUpdateTeams(updatedTeams);
      onUpdateCrew(updatedCrew);
      triggerRepack(updatedTeams, trucks, drivers, updatedCrew);
    }
  };

  const handleDeleteTruck = (id: string, plate: string) => {
    if (confirm(`Delete truck ${plate} permanently?`)) {
      const updatedTeams = teams.map(t => t.truckId === id ? { ...t, truckId: null } : t);
      const updatedTrucks = trucks.filter(t => t.id !== id);
      onUpdateTeams(updatedTeams);
      onUpdateTrucks(updatedTrucks);
      triggerRepack(updatedTeams, updatedTrucks, drivers, crew);
    }
  };

  // Edit resource inline
  const handleEditResource = (kind: "driver" | "crew" | "truck", id: string, field: string, val: any) => {
    if (kind === "driver") {
      const updated = drivers.map(d => {
        if (d.id === id) {
          if (field === "tonnage") {
            const v = parseInt(val, 10) || 5;
            const cap = v <= 1 ? 0.25 : (v <= 3 ? 0.75 : (v <= 5 ? 1 : 2));
            return { ...d, tonnage: v, capFrac: cap };
          }
          return { ...d, [field]: val };
        }
        return d;
      });
      onUpdateDrivers(updated);
      triggerRepack(teams, trucks, updated, crew);
    } else if (kind === "crew") {
      const updated = crew.map(c => c.id === id ? { ...c, [field]: val } : c);
      onUpdateCrew(updated);
      triggerRepack(teams, trucks, drivers, updated);
    } else if (kind === "truck") {
      const updated = trucks.map(t => {
        if (t.id === id) {
          if (field === "tonnage") {
            const v = parseInt(val, 10) || 5;
            const cap = v <= 1 ? 0.25 : (v <= 3 ? 0.75 : (v <= 5 ? 1 : 2));
            const lp = v <= 1 ? 12 : (v <= 3 ? 16 : (v <= 5 ? 20 : 28));
            return { ...t, tonnage: v, capFrac: cap, lPer100: lp };
          }
          return { ...t, [field]: val };
        }
        return t;
      });
      onUpdateTrucks(updated);
      triggerRepack(teams, updated, drivers, crew);
    }
  };

  // Resource leaves
  const handleAddLeave = (kind: "driver" | "crew" | "truck", id: string) => {
    const createLeaveObj = () => ({ from: todayStr(), to: todayStr() });
    if (kind === "driver") {
      const updated = drivers.map(d => {
        if (d.id === id) {
          const lv = Array.isArray(d.leave) ? [...d.leave, createLeaveObj()] : [createLeaveObj()];
          return { ...d, leave: lv };
        }
        return d;
      });
      onUpdateDrivers(updated);
      triggerRepack(teams, trucks, updated, crew);
    } else if (kind === "crew") {
      const updated = crew.map(c => {
        if (c.id === id) {
          const lv = Array.isArray(c.leave) ? [...c.leave, createLeaveObj()] : [createLeaveObj()];
          return { ...c, leave: lv };
        }
        return c;
      });
      onUpdateCrew(updated);
      triggerRepack(teams, trucks, drivers, updated);
    } else if (kind === "truck") {
      const updated = trucks.map(t => {
        if (t.id === id) {
          const lv = Array.isArray(t.leave) ? [...t.leave, createLeaveObj()] : [createLeaveObj()];
          return { ...t, leave: lv };
        }
        return t;
      });
      onUpdateTrucks(updated);
      triggerRepack(teams, updated, drivers, crew);
    }
  };

  const handleEditLeave = (kind: "driver" | "crew" | "truck", id: string, index: number, field: "from" | "to", val: string) => {
    if (kind === "driver") {
      const updated = drivers.map(d => {
        if (d.id === id && Array.isArray(d.leave)) {
          const lv = d.leave.map((l, idx) => idx === index ? { ...l, [field]: val } : l);
          return { ...d, leave: lv };
        }
        return d;
      });
      onUpdateDrivers(updated);
      triggerRepack(teams, trucks, updated, crew);
    } else if (kind === "crew") {
      const updated = crew.map(c => {
        if (c.id === id && Array.isArray(c.leave)) {
          const lv = c.leave.map((l, idx) => idx === index ? { ...l, [field]: val } : l);
          return { ...c, leave: lv };
        }
        return c;
      });
      onUpdateCrew(updated);
      triggerRepack(teams, trucks, drivers, updated);
    } else if (kind === "truck") {
      const updated = trucks.map(t => {
        if (t.id === id && Array.isArray(t.leave)) {
          const lv = t.leave.map((l, idx) => idx === index ? { ...l, [field]: val } : l);
          return { ...t, leave: lv };
        }
        return t;
      });
      onUpdateTrucks(updated);
      triggerRepack(teams, updated, drivers, crew);
    }
  };

  const handleDeleteLeave = (kind: "driver" | "crew" | "truck", id: string, index: number) => {
    if (kind === "driver") {
      const updated = drivers.map(d => {
        if (d.id === id && Array.isArray(d.leave)) {
          return { ...d, leave: d.leave.filter((_, idx) => idx !== index) };
        }
        return d;
      });
      onUpdateDrivers(updated);
      triggerRepack(teams, trucks, updated, crew);
    } else if (kind === "crew") {
      const updated = crew.map(c => {
        if (c.id === id && Array.isArray(c.leave)) {
          return { ...c, leave: c.leave.filter((_, idx) => idx !== index) };
        }
        return c;
      });
      onUpdateCrew(updated);
      triggerRepack(teams, trucks, drivers, updated);
    } else if (kind === "truck") {
      const updated = trucks.map(t => {
        if (t.id === id && Array.isArray(t.leave)) {
          return { ...t, leave: t.leave.filter((_, idx) => idx !== index) };
        }
        return t;
      });
      onUpdateTrucks(updated);
      triggerRepack(teams, updated, drivers, crew);
    }
  };

  // OUTSOURCE ACTIONS
  const handleSaveOtruck = () => {
    if (!otForm.plate.trim()) return;
    const ton = otForm.tonnage;
    const capFrac = ton <= 1 ? 0.25 : (ton <= 3 ? 0.75 : (ton <= 5 ? 1 : 2));
    const lp = ton <= 1 ? 12 : (ton <= 3 ? 16 : (ton <= 5 ? 20 : 28));

    const newTrk: Truck = {
      id: "TR" + uid(),
      plate: otForm.plate.trim(),
      model: otForm.model.trim(),
      tonnage: ton,
      capFrac,
      lPer100: lp,
      outsourced: true,
      rate: otForm.rate.trim() || undefined
    };
    const updated = [...trucks, newTrk];
    onUpdateTrucks(updated);
    setOtForm({ plate: "", model: "", tonnage: 5, rate: "" });
    setOtruckFormOpen(false);
    triggerRepack(teams, updated, drivers, crew);
  };

  const handleSaveOcrew = () => {
    if (!ocForm.name.trim()) return;
    const id = (ocForm.role === "driver" ? "D" : "C") + uid();
    if (ocForm.role === "driver") {
      const newDrv: Driver = {
        id,
        name: ocForm.name.trim(),
        phone: ocForm.phone.trim(),
        role: "driver",
        outsourced: true
      };
      if (ocForm.company.trim()) (newDrv as any).company = ocForm.company.trim();
      const updated = [...drivers, newDrv];
      onUpdateDrivers(updated);
      triggerRepack(teams, trucks, updated, crew);
    } else {
      const newCr: Crew = {
        id,
        name: ocForm.name.trim(),
        outsourced: true
      };
      if (ocForm.phone.trim()) (newCr as any).phone = ocForm.phone.trim();
      if (ocForm.company.trim()) (newCr as any).company = ocForm.company.trim();
      const updated = [...crew, newCr];
      onUpdateCrew(updated);
      triggerRepack(teams, trucks, drivers, updated);
    }
    setOcForm({ name: "", phone: "", role: "crew", company: "" });
    setOcrewFormOpen(false);
  };

  // VENUES ACTIONS
  const handleSaveVenue = () => {
    if (!vForm.name.trim() || vForm.setup < 5) return;
    const newVen: Venue = {
      id: "V" + uid(),
      name: vForm.name.trim(),
      setup: vForm.setup
    };
    const updated = [...venues, newVen];
    onUpdateVenues(updated);
    setVForm({ name: "", setup: 60 });
    setVenueFormOpen(false);
  };

  const handleDeleteVenue = (id: string) => {
    const updated = venues.filter(v => v.id !== id);
    onUpdateVenues(updated);
  };

  const handleEditVenue = (id: string, field: keyof Venue, val: any) => {
    const updated = venues.map(v => {
      if (v.id === id) {
        if (field === "setup") return { ...v, setup: parseInt(val, 10) || 60 };
        if (field === "colSetup") return { ...v, colSetup: parseInt(val, 10) || 30 };
        return { ...v, [field]: val };
      }
      return v;
    });
    onUpdateVenues(updated);
  };

  // PREFERENCES ACTIONS
  const handleApplyDefaults = () => {
    const updatedJobs = jobs.map(j => {
      const isC = j.type.toLowerCase() === "collection";
      const setup = isC ? defaults.col : defaults.del;
      return {
        ...j,
        setup_mins: j._customSetup ? j.setup_mins : setup,
        buffer_mins: j._customBuf ? j.buffer_mins : defaults.buf
      };
    });
    onUpdateJobs(updatedJobs);
    alert("Applied default times to orders without custom overrides.");
  };

  return (
    <div id="scr-teams" className="screen active">
      <div className="tm-tabs">
        <button
          className={`tm-tab ${activeSubTab === "teams" ? "active" : ""}`}
          onClick={() => setActiveSubTab("teams")}
        >
          <i className="ti ti-layout-grid"></i> Teams <span className="tcnt">{tCount}</span>
        </button>
        <button
          className={`tm-tab ${activeSubTab === "drivers" ? "active" : ""}`}
          onClick={() => setActiveSubTab("drivers")}
        >
          <i className="ti ti-steering-wheel"></i> Drivers <span className="tcnt">{dCount}</span>
        </button>
        <button
          className={`tm-tab ${activeSubTab === "crew" ? "active" : ""}`}
          onClick={() => setActiveSubTab("crew")}
        >
          <i className="ti ti-users"></i> Crew <span className="tcnt">{cCount}</span>
        </button>
        <button
          className={`tm-tab ${activeSubTab === "trucks" ? "active" : ""}`}
          onClick={() => setActiveSubTab("trucks")}
        >
          <i className="ti ti-truck"></i> Trucks <span className="tcnt">{trCount}</span>
        </button>
        <button
          className={`tm-tab ${activeSubTab === "outsource" ? "active" : ""}`}
          onClick={() => setActiveSubTab("outsource")}
        >
          <i className="ti ti-external-link"></i> Outsource <span className="tcnt">{oCount}</span>
        </button>
        <button
          className={`tm-tab ${activeSubTab === "venues" ? "active" : ""}`}
          onClick={() => setActiveSubTab("venues")}
        >
          <i className="ti ti-building"></i> Venues <span className="tcnt">{vCount}</span>
        </button>
        <button
          className={`tm-tab ${activeSubTab === "defaults" ? "active" : ""}`}
          onClick={() => setActiveSubTab("defaults")}
        >
          <i className="ti ti-adjustments"></i> Preferences
        </button>
      </div>

      {/* TEAMS SECTION */}
      {activeSubTab === "teams" && (
        <div id="sec-teams" className="tm-section active">
          <div className="tm-top">
            <h2>Assemble teams</h2>
            <button className="btn" onClick={handleLoadMintFleet} title="Load standard Mint fleet and replace current rosters">
              <i className="ti ti-truck"></i> Load Mint fleet
            </button>
            <button className="btn" onClick={handleAddTeam}>
              <i className="ti ti-plus"></i> Add team
            </button>
          </div>
          {teams.length === 0 ? (
            <div className="empty-msg">
              <i className="ti ti-layout-grid"></i>No teams yet. Click "Add team" to create one.
            </div>
          ) : (
            <div id="teams-list">
              {teams.map(team => {
                const p = TPAL[team.colorIdx % TPAL.length];
                const st = teamStatus(team);
                const driver = drivers.find(d => d.id === team.driverId);
                const cr1 = crew.find(c => c.id === team.crew1Id);
                const cr2 = crew.find(c => c.id === team.crew2Id);
                const truck = trucks.find(t => t.id === team.truckId);

                const drvOptions = drivers.filter(d => d.role !== "crew");
                const crew1Options = crew.filter(c => c.id !== team.crew2Id);
                const crew2Options = crew.filter(c => c.id !== team.crew1Id);

                return (
                  <div key={team.id} className="tcard">
                    <div className="tc2-hdr">
                      <div className="tc-av" style={{ background: p.bg, color: p.fg }}>
                        {teamBadge(team.label)}
                      </div>
                      <div className="tc2-info">
                        <div className="tc2-label">
                          {team.label}
                          {team.outsourced && (
                            <span className="bdg b-split" style={{ fontSize: "8px", padding: "0 4px", marginLeft: "6px" }}>
                              OUT{team.supplier ? ` · ${team.supplier}` : ""}
                            </span>
                          )}
                        </div>
                        <input
                          className="tc2-area"
                          placeholder="Area (e.g. Jumeirah)"
                          value={team.area}
                          onChange={(e) => handleTeamChange(team.id, "area", e.target.value)}
                        />
                      </div>
                      <span className={`tc2-status ${st.cls}`}>{st.label}</span>
                      <button className="icon-btn danger" onClick={() => handleDeleteTeam(team.id, team.label)} aria-label="Delete team">
                        <i className="ti ti-trash" style={{ fontSize: "13px" }}></i>
                      </button>
                    </div>
                    <div className="tc2-body">
                      {/* Driver slot */}
                      <div className={`slot${driver ? " filled" : ""}`}>
                        <div className="slot-lbl">
                          <i className="ti ti-steering-wheel" style={{ fontSize: "11px" }}></i> Driver
                        </div>
                        <select
                          className="slot-sel"
                          value={team.driverId || ""}
                          onChange={(e) => handleTeamChange(team.id, "driverId", e.target.value || null)}
                        >
                          <option value="">— Driver —</option>
                          {drvOptions.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name}{d.outsourced ? " ⟂" : ""}
                            </option>
                          ))}
                        </select>
                        {driver && (
                          <div className="slot-person">
                            <div className="slot-av" style={{ background: "rgba(96,165,250,.22)", color: "#60a5fa" }}>
                              {initials(driver.name)}
                            </div>
                            <div>
                              <div className="slot-nm">
                                {driver.name}
                                {driver.outsourced && <span className="bdg b-split" style={{ fontSize: "8px", padding: "0 4px", marginLeft: "4px" }}>OUT</span>}
                              </div>
                              <div className="slot-ph">{driver.phone || "No phone"}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Crew 1 slot */}
                      <div className={`slot${cr1 ? " filled" : ""}`}>
                        <div className="slot-lbl">
                          <i className="ti ti-user" style={{ fontSize: "11px" }}></i> Crew 1
                        </div>
                        <select
                          className="slot-sel"
                          value={team.crew1Id || ""}
                          onChange={(e) => handleTeamChange(team.id, "crew1Id", e.target.value || null)}
                        >
                          <option value="">— Crew 1 —</option>
                          {crew1Options.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.outsourced ? " ⟂" : ""}
                            </option>
                          ))}
                        </select>
                        {cr1 && (
                          <div className="slot-person">
                            <div className="slot-av" style={{ background: "rgba(62,207,142,.22)", color: "#3ecf8e" }}>
                              {initials(cr1.name)}
                            </div>
                            <div>
                              <div className="slot-nm">
                                {cr1.name}
                                {cr1.outsourced && <span className="bdg b-split" style={{ fontSize: "8px", padding: "0 4px", marginLeft: "4px" }}>OUT</span>}
                              </div>
                              <div className="slot-ph">{(cr1 as any).phone || "No phone"}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Crew 2 slot */}
                      <div className={`slot${cr2 ? " filled" : ""}`}>
                        <div className="slot-lbl">
                          <i className="ti ti-user" style={{ fontSize: "11px" }}></i> Crew 2
                        </div>
                        <select
                          className="slot-sel"
                          value={team.crew2Id || ""}
                          onChange={(e) => handleTeamChange(team.id, "crew2Id", e.target.value || null)}
                        >
                          <option value="">— Crew 2 —</option>
                          {crew2Options.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name}{c.outsourced ? " ⟂" : ""}
                            </option>
                          ))}
                        </select>
                        {cr2 && (
                          <div className="slot-person">
                            <div className="slot-av" style={{ background: "rgba(62,207,142,.22)", color: "#3ecf8e" }}>
                              {initials(cr2.name)}
                            </div>
                            <div>
                              <div className="slot-nm">
                                {cr2.name}
                                {cr2.outsourced && <span className="bdg b-split" style={{ fontSize: "8px", padding: "0 4px", marginLeft: "4px" }}>OUT</span>}
                              </div>
                              <div className="slot-ph">{(cr2 as any).phone || "No phone"}</div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Truck slot */}
                      <div className={`slot${truck ? " filled" : ""}`} style={{ gridColumn: "span 3" }}>
                        <div className="slot-lbl">
                          <i className="ti ti-truck" style={{ fontSize: "11px" }}></i> Truck
                        </div>
                        <select
                          className="slot-sel"
                          value={team.truckId || ""}
                          onChange={(e) => handleTeamChange(team.id, "truckId", e.target.value || null)}
                          style={{ maxWidth: "320px" }}
                        >
                          <option value="">— Truck —</option>
                          {trucks.map(t => (
                            <option key={t.id} value={t.id}>
                              {t.plate} {t.model} ({t.tonnage}t){t.outsourced ? " ⟂" : ""}
                            </option>
                          ))}
                        </select>
                        {truck && (
                          <div className="slot-truck">
                            <div className="slot-truck-ic"><i className="ti ti-truck"></i></div>
                            <div>
                              <div className="slot-nm">
                                {truck.plate} <span style={{ color: "var(--t3)", fontSize: "10px" }}>{truck.tonnage}t</span>
                                {truck.outsourced && <span className="bdg b-split" style={{ fontSize: "8px", padding: "0 4px", marginLeft: "4px" }}>OUT</span>}
                              </div>
                              <div className="slot-ph">{truck.model}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DRIVERS SECTION */}
      {activeSubTab === "drivers" && (
        <div id="sec-drivers" className="tm-section active">
          <div className="tm-top">
            <h2>In-house drivers</h2>
            <button className="btn" onClick={() => setDriverFormOpen(!driverFormOpen)}>
              <i className={driverFormOpen ? "ti ti-x" : "ti ti-plus"}></i> {driverFormOpen ? "Cancel" : "Add driver"}
            </button>
          </div>

          {driverFormOpen && (
            <div className="add-form" style={{ display: "block", marginBottom: "20px" }}>
              <div className="fg">
                <div className="fgrp">
                  <label>Full name</label>
                  <input
                    className="finp"
                    placeholder="Ahmed Al Rashidi"
                    value={dForm.name}
                    onChange={(e) => setDForm({ ...dForm, name: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Phone</label>
                  <input
                    className="finp"
                    placeholder="+971 50 123 4567"
                    value={dForm.phone}
                    onChange={(e) => setDForm({ ...dForm, phone: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>License no.</label>
                  <input
                    className="finp"
                    placeholder="DXB-12345"
                    value={dForm.lic}
                    onChange={(e) => setDForm({ ...dForm, lic: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Status</label>
                  <select
                    className="fsel"
                    value={dForm.status}
                    onChange={(e) => setDForm({ ...dForm, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="off">Off duty</option>
                  </select>
                </div>
              </div>
              <div className="fa">
                <button className="btn amber" onClick={handleSaveDriver}>
                  <i className="ti ti-check"></i> Save driver
                </button>
                <button className="btn" onClick={() => setDriverFormOpen(false)}>
                  <i className="ti ti-x"></i> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="cards-grid">
            {drivers.filter(d => !d.outsourced).map(d => {
              const active = d.active !== false;
              const isAssigned = teams.some(t => t.driverId === d.id);
              return (
                <div key={d.id} className={`rcard ${active ? "" : "inactive"}`}>
                  <div className="rc-head">
                    <input
                      className="finp rc-name"
                      value={d.name}
                      onChange={(e) => handleEditResource("driver", d.id, "name", e.target.value)}
                    />
                    <label className="rc-active">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => handleEditResource("driver", d.id, "active", e.target.checked)}
                      />
                      Active
                    </label>
                    <button className="icon-btn danger" onClick={() => handleDeleteDriver(d.id, d.name)}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                  <div className="rc-row">
                    <input
                      className="finp sm"
                      placeholder="Phone"
                      value={d.phone}
                      onChange={(e) => handleEditResource("driver", d.id, "phone", e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      className="finp sm"
                      placeholder="License"
                      value={(d as any).license || ""}
                      onChange={(e) => handleEditResource("driver", d.id, "license", e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="rc-row">
                    <select
                      className="fsel sm"
                      value={d.offDay === null || d.offDay === undefined ? "" : d.offDay}
                      onChange={(e) => handleEditResource("driver", d.id, "offDay", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                      style={{ flex: 1 }}
                    >
                      <option value="">No weekly off</option>
                      <option value="0">Sunday off</option>
                      <option value="1">Monday off</option>
                      <option value="2">Tuesday off</option>
                      <option value="3">Wednesday off</option>
                      <option value="4">Thursday off</option>
                      <option value="5">Friday off</option>
                      <option value="6">Saturday off</option>
                    </select>
                    <span style={{ fontSize: "10px", color: "var(--t3)", alignSelf: "center", whiteSpace: "nowrap" }}>
                      {isAssigned ? "· assigned" : "· spare"}
                    </span>
                  </div>
                  <div>
                    <div className="rc-leave-h">
                      <i className="ti ti-calendar-off" style={{ fontSize: "11px" }}></i> Leave / unavailable dates
                      <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => handleAddLeave("driver", d.id)}>
                        <i className="ti ti-plus" style={{ fontSize: "10px" }}></i> Add
                      </button>
                    </div>
                    {(d.leave || []).map((lv, idx) => (
                      <div key={idx} className="lv-row">
                        <input
                          className="finp sm"
                          type="date"
                          value={lv.from || ""}
                          onChange={(e) => handleEditLeave("driver", d.id, idx, "from", e.target.value)}
                        />
                        <span style={{ color: "var(--t3)", fontSize: "10px" }}>to</span>
                        <input
                          className="finp sm"
                          type="date"
                          value={lv.to || ""}
                          onChange={(e) => handleEditLeave("driver", d.id, idx, "to", e.target.value)}
                        />
                        <button className="icon-btn danger" onClick={() => handleDeleteLeave("driver", d.id, idx)}>
                          <i className="ti ti-x"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* CREW SECTION */}
      {activeSubTab === "crew" && (
        <div id="sec-crew" className="tm-section active">
          <div className="tm-top">
            <h2>In-house crew</h2>
            <button className="btn" onClick={() => setCrewFormOpen(!crewFormOpen)}>
              <i className={crewFormOpen ? "ti ti-x" : "ti ti-plus"}></i> {crewFormOpen ? "Cancel" : "Add crew member"}
            </button>
          </div>

          {crewFormOpen && (
            <div className="add-form" style={{ display: "block", marginBottom: "20px" }}>
              <div className="fg">
                <div className="fgrp">
                  <label>Full name</label>
                  <input
                    className="finp"
                    placeholder="Mohammad Hassan"
                    value={cForm.name}
                    onChange={(e) => setCForm({ ...cForm, name: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Phone</label>
                  <input
                    className="finp"
                    placeholder="+971 55 987 6543"
                    value={cForm.phone}
                    onChange={(e) => setCForm({ ...cForm, phone: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Role / skill</label>
                  <input
                    className="finp"
                    placeholder="Furniture handler"
                    value={cForm.role}
                    onChange={(e) => setCForm({ ...cForm, role: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Status</label>
                  <select
                    className="fsel"
                    value={cForm.status}
                    onChange={(e) => setCForm({ ...cForm, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="off">Off duty</option>
                  </select>
                </div>
              </div>
              <div className="fa">
                <button className="btn amber" onClick={handleSaveCrew}>
                  <i className="ti ti-check"></i> Save crew member
                </button>
                <button className="btn" onClick={() => setCrewFormOpen(false)}>
                  <i className="ti ti-x"></i> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="cards-grid">
            {crew.filter(c => !c.outsourced).map(c => {
              const active = c.active !== false;
              const isAssigned = teams.some(t => t.crew1Id === c.id || t.crew2Id === c.id);
              return (
                <div key={c.id} className={`rcard ${active ? "" : "inactive"}`}>
                  <div className="rc-head">
                    <input
                      className="finp rc-name"
                      value={c.name}
                      onChange={(e) => handleEditResource("crew", c.id, "name", e.target.value)}
                    />
                    <label className="rc-active">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => handleEditResource("crew", c.id, "active", e.target.checked)}
                      />
                      Active
                    </label>
                    <button className="icon-btn danger" onClick={() => handleDeleteCrew(c.id, c.name)}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                  <div className="rc-row">
                    <input
                      className="finp sm"
                      placeholder="Phone"
                      value={(c as any).phone || ""}
                      onChange={(e) => handleEditResource("crew", c.id, "phone", e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <input
                      className="finp sm"
                      placeholder="Role"
                      value={(c as any).role || ""}
                      onChange={(e) => handleEditResource("crew", c.id, "role", e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                  <div className="rc-row">
                    <select
                      className="fsel sm"
                      value={c.offDay === null || c.offDay === undefined ? "" : c.offDay}
                      onChange={(e) => handleEditResource("crew", c.id, "offDay", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                      style={{ flex: 1 }}
                    >
                      <option value="">No weekly off</option>
                      <option value="0">Sunday off</option>
                      <option value="1">Monday off</option>
                      <option value="2">Tuesday off</option>
                      <option value="3">Wednesday off</option>
                      <option value="4">Thursday off</option>
                      <option value="5">Friday off</option>
                      <option value="6">Saturday off</option>
                    </select>
                    <span style={{ fontSize: "10px", color: "var(--t3)", alignSelf: "center", whiteSpace: "nowrap" }}>
                      {isAssigned ? "· assigned" : "· spare"}
                    </span>
                  </div>
                  <div>
                    <div className="rc-leave-h">
                      <i className="ti ti-calendar-off" style={{ fontSize: "11px" }}></i> Leave / unavailable dates
                      <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => handleAddLeave("crew", c.id)}>
                        <i className="ti ti-plus" style={{ fontSize: "10px" }}></i> Add
                      </button>
                    </div>
                    {(c.leave || []).map((lv, idx) => (
                      <div key={idx} className="lv-row">
                        <input
                          className="finp sm"
                          type="date"
                          value={lv.from || ""}
                          onChange={(e) => handleEditLeave("crew", c.id, idx, "from", e.target.value)}
                        />
                        <span style={{ color: "var(--t3)", fontSize: "10px" }}>to</span>
                        <input
                          className="finp sm"
                          type="date"
                          value={lv.to || ""}
                          onChange={(e) => handleEditLeave("crew", c.id, idx, "to", e.target.value)}
                        />
                        <button className="icon-btn danger" onClick={() => handleDeleteLeave("crew", c.id, idx)}>
                          <i className="ti ti-x"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TRUCKS SECTION */}
      {activeSubTab === "trucks" && (
        <div id="sec-trucks" className="tm-section active">
          <div className="tm-top">
            <h2>In-house trucks</h2>
            <button className="btn" onClick={() => setTruckFormOpen(!truckFormOpen)}>
              <i className={truckFormOpen ? "ti ti-x" : "ti ti-plus"}></i> {truckFormOpen ? "Cancel" : "Add truck"}
            </button>
          </div>

          {truckFormOpen && (
            <div className="add-form" style={{ display: "block", marginBottom: "20px" }}>
              <div className="fg">
                <div className="fgrp">
                  <label>Plate number</label>
                  <input
                    className="finp"
                    placeholder="DXB A 12345"
                    value={tForm.plate}
                    onChange={(e) => setTForm({ ...tForm, plate: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Make / model</label>
                  <input
                    className="finp"
                    placeholder="Mitsubishi Canter"
                    value={tForm.model}
                    onChange={(e) => setTForm({ ...tForm, model: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Capacity</label>
                  <select
                    className="fsel"
                    value={tForm.tonnage}
                    onChange={(e) => setTForm({ ...tForm, tonnage: parseInt(e.target.value, 10) })}
                  >
                    <option value="1">1 ton</option>
                    <option value="3">3 ton</option>
                    <option value="5">5 ton (standard)</option>
                    <option value="10">10 ton</option>
                  </select>
                </div>
                <div className="fgrp">
                  <label>Status</label>
                  <select
                    className="fsel"
                    value={tForm.status}
                    onChange={(e) => setTForm({ ...tForm, status: e.target.value })}
                  >
                    <option value="available">Available</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="fa">
                <button className="btn amber" onClick={handleSaveTruck}>
                  <i className="ti ti-check"></i> Save truck
                </button>
                <button className="btn" onClick={() => setTruckFormOpen(false)}>
                  <i className="ti ti-x"></i> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="cards-grid">
            {trucks.filter(t => !t.outsourced).map(t => {
              const active = t.active !== false;
              const isAssigned = teams.some(tm => tm.truckId === t.id);
              return (
                <div key={t.id} className={`rcard ${active ? "" : "inactive"}`}>
                  <div className="rc-head">
                    <input
                      className="finp rc-name"
                      value={t.plate}
                      onChange={(e) => handleEditResource("truck", t.id, "plate", e.target.value)}
                    />
                    <label className="rc-active">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => handleEditResource("truck", t.id, "active", e.target.checked)}
                      />
                      Active
                    </label>
                    <button className="icon-btn danger" onClick={() => handleDeleteTruck(t.id, t.plate)}>
                      <i className="ti ti-trash"></i>
                    </button>
                  </div>
                  <div className="rc-row">
                    <input
                      className="finp sm"
                      placeholder="Make / model"
                      value={t.model || ""}
                      onChange={(e) => handleEditResource("truck", t.id, "model", e.target.value)}
                      style={{ flex: 2 }}
                    />
                    <select
                      className="fsel sm"
                      value={t.tonnage || 5}
                      onChange={(e) => handleEditResource("truck", t.id, "tonnage", e.target.value)}
                      style={{ flex: 1 }}
                      title="Truck size sets how much it can carry"
                    >
                      <option value="1">1 ton</option>
                      <option value="3">3 ton</option>
                      <option value="5">5 ton</option>
                      <option value="10">10 ton</option>
                    </select>
                    <input
                      className="finp sm"
                      type="number"
                      min="1"
                      step="0.5"
                      value={t.lPer100 || 20}
                      onChange={(e) => handleEditResource("truck", t.id, "lPer100", parseFloat(e.target.value) || 20)}
                      title="Diesel use: litres per 100 km"
                      style={{ flex: 1, maxWidth: "74px" }}
                    />
                    <span style={{ fontSize: "9px", color: "var(--t3)", alignSelf: "center" }}>L/100</span>
                    <label className="rc-active" title="Double-cabin crew carrier — used as the convoy leader">
                      <input
                        type="checkbox"
                        checked={!!t.doubleCab}
                        onChange={(e) => handleEditResource("truck", t.id, "doubleCab", e.target.checked)}
                      />
                      Dbl cab
                    </label>
                  </div>
                  <div className="rc-row">
                    <select
                      className="fsel sm"
                      value={t.offDay === null || t.offDay === undefined ? "" : t.offDay}
                      onChange={(e) => handleEditResource("truck", t.id, "offDay", e.target.value === "" ? null : parseInt(e.target.value, 10))}
                      style={{ flex: 1 }}
                    >
                      <option value="">No weekly off</option>
                      <option value="0">Sunday off</option>
                      <option value="1">Monday off</option>
                      <option value="2">Tuesday off</option>
                      <option value="3">Wednesday off</option>
                      <option value="4">Thursday off</option>
                      <option value="5">Friday off</option>
                      <option value="6">Saturday off</option>
                    </select>
                    <span style={{ fontSize: "10px", color: "var(--t3)", alignSelf: "center", whiteSpace: "nowrap" }}>
                      {isAssigned ? "· assigned" : "· spare"}
                    </span>
                  </div>
                  <div>
                    <div className="rc-leave-h">
                      <i className="ti ti-calendar-off" style={{ fontSize: "11px" }}></i> Leave / unavailable dates
                      <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => handleAddLeave("truck", t.id)}>
                        <i className="ti ti-plus" style={{ fontSize: "10px" }}></i> Add
                      </button>
                    </div>
                    {(t.leave || []).map((lv, idx) => (
                      <div key={idx} className="lv-row">
                        <input
                          className="finp sm"
                          type="date"
                          value={lv.from || ""}
                          onChange={(e) => handleEditLeave("truck", t.id, idx, "from", e.target.value)}
                        />
                        <span style={{ color: "var(--t3)", fontSize: "10px" }}>to</span>
                        <input
                          className="finp sm"
                          type="date"
                          value={lv.to || ""}
                          onChange={(e) => handleEditLeave("truck", t.id, idx, "to", e.target.value)}
                        />
                        <button className="icon-btn danger" onClick={() => handleDeleteLeave("truck", t.id, idx)}>
                          <i className="ti ti-x"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* OUTSOURCE SECTION */}
      {activeSubTab === "outsource" && (
        <div id="sec-outsource" className="tm-section active">
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "16px" }}>
            Third-party drivers, crew &amp; trucks. They appear in team slots tagged <span className="bdg b-split">OUT</span> and can be assigned just like in-house resources.
          </p>

          <div className="sub-h">
            Outsourced trucks
            <button className="btn sm" onClick={() => setOtruckFormOpen(!otruckFormOpen)} style={{ marginLeft: "auto" }}>
              <i className={otruckFormOpen ? "ti ti-x" : "ti ti-plus"}></i> {otruckFormOpen ? "Cancel" : "Add"}
            </button>
          </div>

          {otruckFormOpen && (
            <div className="add-form" style={{ display: "block", marginBottom: "20px" }}>
              <div className="fg">
                <div className="fgrp">
                  <label>Plate / ref</label>
                  <input
                    className="finp"
                    placeholder="OUT-TRK-01"
                    value={otForm.plate}
                    onChange={(e) => setOtForm({ ...otForm, plate: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Company</label>
                  <input
                    className="finp"
                    placeholder="Al Futtaim Logistics"
                    value={otForm.model}
                    onChange={(e) => setOtForm({ ...otForm, model: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Capacity</label>
                  <select
                    className="fsel"
                    value={otForm.tonnage}
                    onChange={(e) => setOtForm({ ...otForm, tonnage: parseInt(e.target.value, 10) })}
                  >
                    <option value="1">1 ton</option>
                    <option value="3">3 ton</option>
                    <option value="5">5 ton</option>
                    <option value="10">10 ton</option>
                  </select>
                </div>
                <div className="fgrp">
                  <label>Day rate (AED)</label>
                  <input
                    className="finp"
                    placeholder="e.g. 650"
                    value={otForm.rate}
                    onChange={(e) => setOtForm({ ...otForm, rate: e.target.value })}
                  />
                </div>
              </div>
              <div className="fa">
                <button className="btn amber" onClick={handleSaveOtruck}>
                  <i className="ti ti-check"></i> Save
                </button>
                <button className="btn" onClick={() => setOtruckFormOpen(false)}>
                  <i className="ti ti-x"></i> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="cards-grid" style={{ marginBottom: "30px" }}>
            {trucks.filter(t => t.outsourced).map(t => (
              <div key={t.id} className="rcard out">
                <div className="rc-head">
                  <input
                    className="finp rc-name"
                    value={t.plate}
                    onChange={(e) => handleEditResource("truck", t.id, "plate", e.target.value)}
                  />
                  <span className="ppill p-out" style={{ marginRight: "10px" }}>Outsourced</span>
                  <button className="icon-btn danger" onClick={() => handleDeleteTruck(t.id, t.plate)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
                <div className="rc-row">
                  <input
                    className="finp sm"
                    placeholder="Company"
                    value={t.model || ""}
                    onChange={(e) => handleEditResource("truck", t.id, "model", e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <select
                    className="fsel sm"
                    value={t.tonnage || 5}
                    onChange={(e) => handleEditResource("truck", t.id, "tonnage", e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="1">1 ton</option>
                    <option value="3">3 ton</option>
                    <option value="5">5 ton</option>
                    <option value="10">10 ton</option>
                  </select>
                  <input
                    className="finp sm"
                    placeholder="Rate"
                    value={t.rate || ""}
                    onChange={(e) => handleEditResource("truck", t.id, "rate", e.target.value)}
                    style={{ flex: 1, maxWidth: "80px" }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="sub-h">
            Outsourced crew &amp; drivers
            <button className="btn sm" onClick={() => setOcrewFormOpen(!ocrewFormOpen)} style={{ marginLeft: "auto" }}>
              <i className={ocrewFormOpen ? "ti ti-x" : "ti ti-plus"}></i> {ocrewFormOpen ? "Cancel" : "Add"}
            </button>
          </div>

          {ocrewFormOpen && (
            <div className="add-form" style={{ display: "block", marginBottom: "20px" }}>
              <div className="fg">
                <div className="fgrp">
                  <label>Full name</label>
                  <input
                    className="finp"
                    placeholder="Outsourced worker"
                    value={ocForm.name}
                    onChange={(e) => setOcForm({ ...ocForm, name: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Phone</label>
                  <input
                    className="finp"
                    placeholder="+971 5x xxx xxxx"
                    value={ocForm.phone}
                    onChange={(e) => setOcForm({ ...ocForm, phone: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Role</label>
                  <select
                    className="fsel"
                    value={ocForm.role}
                    onChange={(e) => setOcForm({ ...ocForm, role: e.target.value })}
                  >
                    <option value="crew">Crew / handler</option>
                    <option value="driver">Driver</option>
                  </select>
                </div>
                <div className="fgrp">
                  <label>Company</label>
                  <input
                    className="finp"
                    placeholder="Agency name"
                    value={ocForm.company}
                    onChange={(e) => setOcForm({ ...ocForm, company: e.target.value })}
                  />
                </div>
              </div>
              <div className="fa">
                <button className="btn amber" onClick={handleSaveOcrew}>
                  <i className="ti ti-check"></i> Save
                </button>
                <button className="btn" onClick={() => setOcrewFormOpen(false)}>
                  <i className="ti ti-x"></i> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="cards-grid">
            {drivers.filter(d => d.outsourced).map(d => (
              <div key={d.id} className="rcard out">
                <div className="rc-head">
                  <input
                    className="finp rc-name"
                    value={d.name}
                    onChange={(e) => handleEditResource("driver", d.id, "name", e.target.value)}
                  />
                  <span className="ppill p-out" style={{ marginRight: "10px" }}>Out-Driver</span>
                  <button className="icon-btn danger" onClick={() => handleDeleteDriver(d.id, d.name)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
                <div className="rc-row">
                  <input
                    className="finp sm"
                    placeholder="Phone"
                    value={d.phone}
                    onChange={(e) => handleEditResource("driver", d.id, "phone", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="finp sm"
                    placeholder="Company"
                    value={(d as any).company || ""}
                    onChange={(e) => handleEditResource("driver", d.id, "company", e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            ))}

            {crew.filter(c => c.outsourced).map(c => (
              <div key={c.id} className="rcard out">
                <div className="rc-head">
                  <input
                    className="finp rc-name"
                    value={c.name}
                    onChange={(e) => handleEditResource("crew", c.id, "name", e.target.value)}
                  />
                  <span className="ppill p-out" style={{ marginRight: "10px" }}>Out-Crew</span>
                  <button className="icon-btn danger" onClick={() => handleDeleteCrew(c.id, c.name)}>
                    <i className="ti ti-trash"></i>
                  </button>
                </div>
                <div className="rc-row">
                  <input
                    className="finp sm"
                    placeholder="Phone"
                    value={(c as any).phone || ""}
                    onChange={(e) => handleEditResource("crew", c.id, "phone", e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    className="finp sm"
                    placeholder="Company"
                    value={(c as any).company || ""}
                    onChange={(e) => handleEditResource("crew", c.id, "company", e.target.value)}
                    style={{ flex: 1 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VENUES SECTION */}
      {activeSubTab === "venues" && (
        <div id="sec-venues" className="tm-section active">
          <div className="tm-top">
            <h2>Venue types &amp; default setup times</h2>
            <button className="btn" onClick={() => setVenueFormOpen(!venueFormOpen)}>
              <i className={venueFormOpen ? "ti ti-x" : "ti ti-plus"}></i> {venueFormOpen ? "Cancel" : "Add venue type"}
            </button>
          </div>
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "16px" }}>
            Picking a venue in the Add-order form fills the setup time automatically. Changing a default here applies to new orders.
          </p>

          {venueFormOpen && (
            <div className="add-form" style={{ display: "block", marginBottom: "20px" }}>
              <div className="fg">
                <div className="fgrp">
                  <label>Venue type name</label>
                  <input
                    className="finp"
                    placeholder="e.g. Beach Setup"
                    value={vForm.name}
                    onChange={(e) => setVForm({ ...vForm, name: e.target.value })}
                  />
                </div>
                <div className="fgrp">
                  <label>Default setup (mins)</label>
                  <input
                    className="finp"
                    type="number"
                    min="5"
                    placeholder="60"
                    value={vForm.setup}
                    onChange={(e) => setVForm({ ...vForm, setup: parseInt(e.target.value, 10) || 60 })}
                  />
                </div>
              </div>
              <div className="fa">
                <button className="btn amber" onClick={handleSaveVenue}>
                  <i className="ti ti-check"></i> Save venue type
                </button>
                <button className="btn" onClick={() => setVenueFormOpen(false)}>
                  <i className="ti ti-x"></i> Cancel
                </button>
              </div>
            </div>
          )}

          {venues.length === 0 ? (
            <div className="empty-msg">
              <i className="ti ti-building"></i>No venue types yet. Add one above.
            </div>
          ) : (
            <div className="ot-wrap">
              <table className="ot" style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>Venue type</th>
                    <th style={{ width: "150px" }}>Delivery setup</th>
                    <th style={{ width: "160px" }}>Collection / tear-down</th>
                    <th style={{ width: "46px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map(v => {
                    const colVal = v.colSetup !== undefined && v.colSetup !== null && v.colSetup !== "" ? v.colSetup : Math.max(5, Math.round((v.setup || 60) / 2));
                    return (
                      <tr key={v.id}>
                        <td>
                          <input
                            className="finp"
                            style={{ maxWidth: "280px" }}
                            value={v.name}
                            onChange={(e) => handleEditVenue(v.id, "name", e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            className="finp"
                            style={{ maxWidth: "80px" }}
                            type="number"
                            min="5"
                            value={v.setup}
                            onChange={(e) => handleEditVenue(v.id, "setup", e.target.value)}
                          />{" "}
                          <span className="su-u">min</span>
                        </td>
                        <td>
                          <input
                            className="finp"
                            style={{ maxWidth: "80px" }}
                            type="number"
                            min="5"
                            value={colVal}
                            onChange={(e) => handleEditVenue(v.id, "colSetup", e.target.value)}
                          />{" "}
                          <span className="su-u">min</span>
                        </td>
                        <td>
                          <button className="icon-btn danger" onClick={() => handleDeleteVenue(v.id)} aria-label="Remove venue">
                            <i className="ti ti-trash" style={{ fontSize: "13px" }}></i>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PREFERENCES / DEFAULTS SECTION */}
      {activeSubTab === "defaults" && (
        <div id="sec-defaults" className="tm-section active">
          <div className="tm-top">
            <h2>New-order defaults</h2>
          </div>
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "10px" }}>
            Used when an order doesn't bring its own values. Venue types override the delivery setup. Per-order values entered in the schedule always win.
          </p>
          <div className="add-form" style={{ display: "block", marginBottom: "24px" }}>
            <div className="fg">
              <div className="fgrp">
                <label>Delivery setup (mins)</label>
                <input
                  className="finp"
                  type="number"
                  min="5"
                  value={defaults.del}
                  onChange={(e) => onUpdateDefaults({ ...defaults, del: parseInt(e.target.value, 10) || 60 })}
                />
              </div>
              <div className="fgrp">
                <label>Collection setup (mins)</label>
                <input
                  className="finp"
                  type="number"
                  min="5"
                  value={defaults.col}
                  onChange={(e) => onUpdateDefaults({ ...defaults, col: parseInt(e.target.value, 10) || 30 })}
                />
              </div>
              <div className="fgrp">
                <label>Buffer between jobs (mins)</label>
                <input
                  className="finp"
                  type="number"
                  min="0"
                  value={defaults.buf}
                  onChange={(e) => {
                    const newBuf = parseInt(e.target.value, 10) || 0;
                    onUpdateDefaults({ ...defaults, buf: newBuf });
                    triggerRepack(teams, trucks, drivers, crew, { ...defaults, buf: newBuf });
                  }}
                />
              </div>
            </div>
            <div className="fa">
              <button className="btn amber" onClick={handleApplyDefaults}>
                <i className="ti ti-check"></i> Apply to orders without custom times
              </button>
            </div>
          </div>

          <div className="tm-top">
            <h2>In-house fuel cost</h2>
          </div>
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "10px" }}>
            Diesel cost for your own trucks. UAE sets the diesel price monthly. A 5-ton truck doing 100 L per 500 km uses 20 L/100km.
          </p>
          <div className="add-form" style={{ display: "block", marginBottom: "24px" }}>
            <div className="fg">
              <div className="fgrp">
                <label>Diesel price (AED / litre)</label>
                <input
                  className="finp"
                  type="number"
                  min="0"
                  step="0.01"
                  value={fuelConfig.dieselAED}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const newFuel = { ...fuelConfig, dieselAED: val };
                    onUpdateFuelConfig(newFuel);
                    triggerRepack(teams, trucks, drivers, crew, defaults, newFuel);
                  }}
                />
              </div>
              <div className="fgrp">
                <label>Consumption (litres / 100 km)</label>
                <input
                  className="finp"
                  type="number"
                  min="1"
                  step="0.5"
                  value={fuelConfig.lPer100}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 20;
                    const newFuel = { ...fuelConfig, lPer100: val };
                    onUpdateFuelConfig(newFuel);
                    triggerRepack(teams, trucks, drivers, crew, defaults, newFuel);
                  }}
                />
              </div>
              <div className="fgrp">
                <label>Cost per km</label>
                <input
                  className="finp"
                  disabled
                  style={{ opacity: 0.8 }}
                  value={`AED ${(fuelConfig.dieselAED * (fuelConfig.lPer100 / 100)).toFixed(2)} / km`}
                />
              </div>
            </div>
          </div>

          <div className="tm-top">
            <h2>Crew &amp; staffing</h2>
          </div>
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "10px" }}>
            Your in-house crew are counted against each day's busiest crew need. When short, the dashboard indicates the cost to outsource manpower supply.
          </p>
          <div className="add-form" style={{ display: "block", marginBottom: "24px" }}>
            <div className="fg">
              <div className="fgrp">
                <label>Supplier crew rate (AED / crew / day)</label>
                <input
                  className="finp"
                  type="number"
                  min="0"
                  step="10"
                  value={crewRate}
                  onChange={(e) => onUpdateCrewRate(parseInt(e.target.value, 10) || 0)}
                />
              </div>
            </div>
          </div>

          <div className="tm-top">
            <h2>Schedule display</h2>
          </div>
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "10px" }}>
            Choose what each order row shows on the Schedule tab.
          </p>
          <div className="add-form" style={{ display: "block", marginBottom: "24px" }}>
            <label className="tog" style={{ display: "block", marginBottom: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPrefs.orderNo}
                onChange={(e) => onUpdateShowPrefs({ ...showPrefs, orderNo: e.target.checked })}
                style={{ marginRight: "8px" }}
              />
              Order number (D-/C-) next to the client name
            </label>
            <label className="tog" style={{ display: "block", marginBottom: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPrefs.phone}
                onChange={(e) => onUpdateShowPrefs({ ...showPrefs, phone: e.target.checked })}
                style={{ marginRight: "8px" }}
              />
              Client phone
            </label>
            <label className="tog" style={{ display: "block", marginBottom: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPrefs.venue}
                onChange={(e) => onUpdateShowPrefs({ ...showPrefs, venue: e.target.checked })}
                style={{ marginRight: "8px" }}
              />
              Venue type
            </label>
            <label className="tog" style={{ display: "block", marginBottom: "8px", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPrefs.items}
                onChange={(e) => onUpdateShowPrefs({ ...showPrefs, items: e.target.checked })}
                style={{ marginRight: "8px" }}
              />
              Items
            </label>
            <label className="tog" style={{ display: "block", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showPrefs.notes}
                onChange={(e) => onUpdateShowPrefs({ ...showPrefs, notes: e.target.checked })}
                style={{ marginRight: "8px" }}
              />
              Site notes
            </label>
          </div>

          <div className="tm-top">
            <h2>Team cloud — share one live schedule</h2>
          </div>
          <p style={{ fontSize: "12px", color: "var(--t2)", marginBottom: "10px" }}>
            Real-time multi-dispatcher synchronization status.
          </p>
          <div className="add-form" style={{ display: "block", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <i className="ti ti-cloud-check" style={{ fontSize: "24px", color: "var(--green)" }}></i>
              <div>
                <strong style={{ color: "var(--green)" }}>Connected</strong>
                <div style={{ fontSize: "11px", color: "var(--t2)", marginTop: "4px" }}>
                  All schedule changes are saved automatically and synced in real-time to the centralized Next.js database.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
