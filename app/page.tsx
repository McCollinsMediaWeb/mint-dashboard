"use client";

import React, { useState, useEffect, useRef } from "react";
import { Job, Team, Driver, Crew, Truck, Venue, AppDefaults, FuelConfig, ShowPreferences } from "@/lib/types";
import { todayStr, buildFleet } from "@/lib/utils";
import TopNav from "@/components/TopNav";
import ScheduleScreen from "@/components/ScheduleScreen";
import AllOrdersScreen from "@/components/AllOrdersScreen";
import SetupScreen from "@/components/SetupScreen";
import PrintSheet from "@/components/PrintSheet";
import OrderModal from "@/components/OrderModal";
import { packDate } from "@/lib/optimizer";

interface SavedHistoryState {
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
}

const cleanJob = (j: Job): any => {
  const c: any = {};
  const KEEP_PRIVATE = ["_id", "_portionOf", "_portionIdx", "_portionCount", "_customSetup", "_customBuf"];
  Object.keys(j).forEach(key => {
    const k = key as keyof Job;
    if (k.startsWith("_") && !KEEP_PRIVATE.includes(k)) return;
    c[k] = j[k];
  });
  return c;
};

export default function Page() {
  const [activeTab, setActiveTab] = useState("schedule");
  const [selDate, setSelDate] = useState(todayStr());

  // Roster / Settings State
  const [jobs, setJobs] = useState<Job[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [defaults, setDefaults] = useState<AppDefaults>({ del: 60, col: 30, buf: 30 });
  const [fuelConfig, setFuelConfig] = useState<FuelConfig>({ dieselAED: 4.33, lPer100: 20 });
  const [crewRate, setCrewRate] = useState<number>(150);
  const [showPrefs, setShowPrefs] = useState<ShowPreferences>({
    orderNo: true,
    phone: true,
    venue: true,
    items: true,
    notes: true
  });

  // Modal State
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);

  // Sync / Auto-save states
  const [saveStatus, setSaveStatus] = useState("Loading...");
  const [undoHistory, setUndoHistory] = useState<SavedHistoryState[]>([]);

  const isFirstLoad = useRef(true);
  const applyingRemoteRef = useRef(false);
  const lastSyncRef = useRef<string | null>(null);

  // Initialize theme
  useEffect(() => {
    try {
      const theme = localStorage.getItem("mintops.theme") || "light";
      document.body.classList.toggle("light", theme === "light");
    } catch (e) {}
  }, []);

  // Fetch initial state
  useEffect(() => {
    const fetchInitialState = async () => {
      try {
        setSaveStatus("Loading...");
        const res = await fetch("/api/state");
        const data = await res.json();
        if (data && !data.error) {
          applyingRemoteRef.current = true;
          
          setJobs(data.jobs || []);
          setTeams(data.teams || []);
          setDrivers(data.drivers || []);
          setCrew(data.crew || []);
          setTrucks(data.trucks || []);
          setVenues(data.venues || []);
          setDefaults(data.def || { del: 60, col: 30, buf: 30 });
          setFuelConfig(data.fuel || { dieselAED: 4.33, lPer100: 20 });
          setCrewRate(data.crewRate ?? 150);
          setShowPrefs(data.show || { orderNo: true, phone: true, venue: true, items: true, notes: true });
          if (data.selDate) setSelDate(data.selDate);

          lastSyncRef.current = data.savedAt;

          setTimeout(() => {
            applyingRemoteRef.current = false;
            isFirstLoad.current = false;
            setSaveStatus(`✓ saved ${new Date(data.savedAt || Date.now()).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
          }, 100);
        } else {
          console.error("API returned error:", data?.error || "Unknown error");
          setSaveStatus("Database Connection Error");
          
          // Attempt local storage fallback
          try {
            const local = localStorage.getItem("mintops.save.v1");
            if (local) {
              const localData = JSON.parse(local);
              applyingRemoteRef.current = true;
              setJobs(localData.jobs || []);
              setTeams(localData.teams || []);
              setDrivers(localData.drivers || []);
              setCrew(localData.crew || []);
              setTrucks(localData.trucks || []);
              setVenues(localData.venues || []);
              setDefaults(localData.def || { del: 60, col: 30, buf: 30 });
              setFuelConfig(localData.fuel || { dieselAED: 4.33, lPer100: 20 });
              setCrewRate(localData.crewRate ?? 150);
              setShowPrefs(localData.show || { orderNo: true, phone: true, venue: true, items: true, notes: true });
              if (localData.selDate) setSelDate(localData.selDate);
              setTimeout(() => {
                applyingRemoteRef.current = false;
              }, 100);
            }
          } catch (_) {}
          
          isFirstLoad.current = false;
        }
      } catch (err) {
        console.error("Failed to load initial state:", err);
        setSaveStatus("Offline - Using local state");
        
        // Attempt local storage fallback
        try {
          const local = localStorage.getItem("mintops.save.v1");
          if (local) {
            const localData = JSON.parse(local);
            applyingRemoteRef.current = true;
            setJobs(localData.jobs || []);
            setTeams(localData.teams || []);
            setDrivers(localData.drivers || []);
            setCrew(localData.crew || []);
            setTrucks(localData.trucks || []);
            setVenues(localData.venues || []);
            setDefaults(localData.def || { del: 60, col: 30, buf: 30 });
            setFuelConfig(localData.fuel || { dieselAED: 4.33, lPer100: 20 });
            setCrewRate(localData.crewRate ?? 150);
            setShowPrefs(localData.show || { orderNo: true, phone: true, venue: true, items: true, notes: true });
            if (localData.selDate) setSelDate(localData.selDate);
            setTimeout(() => {
              applyingRemoteRef.current = false;
            }, 100);
          }
        } catch (_) {}
        
        isFirstLoad.current = false;
      }
    };
    fetchInitialState();
  }, []);

  // Polling & focus sync
  const pollServer = async () => {
    if (applyingRemoteRef.current || isFirstLoad.current) return;
    try {
      const res = await fetch("/api/state");
      const data = await res.json();
      if (data && !data.error && data.savedAt) {
        if (data.savedAt !== lastSyncRef.current) {
          applyingRemoteRef.current = true;
          
          setJobs(data.jobs || []);
          setTeams(data.teams || []);
          setDrivers(data.drivers || []);
          setCrew(data.crew || []);
          setTrucks(data.trucks || []);
          setVenues(data.venues || []);
          setDefaults(data.def || { del: 60, col: 30, buf: 30 });
          setFuelConfig(data.fuel || { dieselAED: 4.33, lPer100: 20 });
          setCrewRate(data.crewRate ?? 150);
          setShowPrefs(data.show || { orderNo: true, phone: true, venue: true, items: true, notes: true });

          lastSyncRef.current = data.savedAt;

          setTimeout(() => {
            applyingRemoteRef.current = false;
            setSaveStatus(`✓ updated ${new Date(data.savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
          }, 100);
        }
      }
    } catch (e) {
      console.error("Polling error:", e);
    }
  };

  useEffect(() => {
    const interval = setInterval(pollServer, 12000);
    const handleFocus = () => pollServer();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Debounced auto-save to server + local storage backup
  useEffect(() => {
    if (isFirstLoad.current || applyingRemoteRef.current) return;

    const saveToServer = async () => {
      try {
        setSaveStatus("Saving...");
        const payload = {
          v: 1,
          savedAt: new Date().toISOString(),
          app: "mint-ops",
          selDate,
          jobs: jobs.map(cleanJob),
          teams,
          drivers,
          crew,
          trucks,
          venues,
          def: defaults,
          fuel: fuelConfig,
          crewRate,
          show: showPrefs
        };

        // Offline storage backup
        try {
          localStorage.setItem("mintops.save.v1", JSON.stringify(payload));
        } catch (_) {}

        const res = await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data && !data.error) {
          lastSyncRef.current = data.savedAt;
          setSaveStatus(`✓ saved ${new Date(data.savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`);
        } else {
          setSaveStatus("Cloud save error");
        }
      } catch (err) {
        console.error("Auto-save failed:", err);
        setSaveStatus("Offline - Saved locally");
      }
    };

    const timer = setTimeout(saveToServer, 600);
    return () => clearTimeout(timer);
  }, [jobs, teams, drivers, crew, trucks, venues, defaults, fuelConfig, crewRate, showPrefs, selDate]);

  // Undo Management
  const pushUndo = () => {
    const snapshot: SavedHistoryState = {
      jobs: JSON.parse(JSON.stringify(jobs)),
      teams: JSON.parse(JSON.stringify(teams)),
      drivers: JSON.parse(JSON.stringify(drivers)),
      crew: JSON.parse(JSON.stringify(crew)),
      trucks: JSON.parse(JSON.stringify(trucks)),
      venues: JSON.parse(JSON.stringify(venues)),
      defaults: JSON.parse(JSON.stringify(defaults)),
      fuelConfig: JSON.parse(JSON.stringify(fuelConfig)),
      crewRate,
      showPrefs: JSON.parse(JSON.stringify(showPrefs))
    };
    setUndoHistory(prev => [...prev.slice(-14), snapshot]); // keep up to 15 entries
  };

  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    const prev = undoHistory[undoHistory.length - 1];
    setUndoHistory(history => history.slice(0, -1));

    applyingRemoteRef.current = true;
    
    setJobs(prev.jobs);
    setTeams(prev.teams);
    setDrivers(prev.drivers);
    setCrew(prev.crew);
    setTrucks(prev.trucks);
    setVenues(prev.venues);
    setDefaults(prev.defaults);
    setFuelConfig(prev.fuelConfig);
    setCrewRate(prev.crewRate);
    setShowPrefs(prev.showPrefs);

    setTimeout(() => {
      applyingRemoteRef.current = false;
      setSaveStatus("Undo applied ✓");
    }, 100);
  };

  // Updaters with automated undo triggers
  const handleUpdateJobs = (newJobs: Job[]) => {
    pushUndo();
    setJobs(newJobs);
  };

  const handleUpdateTeams = (newTeams: Team[]) => {
    pushUndo();
    setTeams(newTeams);
  };

  const handleUpdateDrivers = (newDrivers: Driver[]) => {
    pushUndo();
    setDrivers(newDrivers);
  };

  const handleUpdateCrew = (newCrew: Crew[]) => {
    pushUndo();
    setCrew(newCrew);
  };

  const handleUpdateTrucks = (newTrucks: Truck[]) => {
    pushUndo();
    setTrucks(newTrucks);
  };

  // Modals operations
  const handleOpenOrderDetails = (jobId: string) => {
    setActiveJobId(jobId);
    setIsOrderModalOpen(true);
  };

  const handleUpdateJobDetails = (jobId: string, updates: Partial<Job>) => {
    pushUndo();
    let updated = jobs.map(j => {
      if (j._id === jobId) {
        return { ...j, ...updates };
      }
      return j;
    });

    // Repack the job's date
    const job = jobs.find(x => x._id === jobId);
    if (job) {
      updated = packDate(updated, teams, trucks, drivers, crew, defaults.buf, fuelConfig, job.date);
    }
    setJobs(updated);
  };

  const handleGotoDate = (date: string) => {
    setSelDate(date);
    setActiveTab("schedule");
    setIsOrderModalOpen(false);
  };

  return (
    <>
      <div id="app">
        {/* Navigation tabs header */}
        <TopNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          orderCount={jobs.filter(j => !j._portionOf && j.status !== "cancelled").length}
          setupCount={teams.length}
          saveStatus={saveStatus}
        />

        {/* Tab rendering switches */}
        {activeTab === "schedule" && (
          <ScheduleScreen
            jobs={jobs}
            teams={teams}
            trucks={trucks}
            drivers={drivers}
            crew={crew}
            venues={venues}
            defaults={defaults}
            fuelConfig={fuelConfig}
            crewRate={crewRate}
            showPrefs={showPrefs}
            selDate={selDate}
            setSelDate={setSelDate}
            onUpdateJobs={handleUpdateJobs}
            onUndo={handleUndo}
            canUndo={undoHistory.length > 0}
            onOpenOrderDetails={handleOpenOrderDetails}
          />
        )}

        {activeTab === "orders" && (
          <AllOrdersScreen
            jobs={jobs}
            teams={teams}
            trucks={trucks}
            drivers={drivers}
            crew={crew}
            defaults={defaults}
            fuelConfig={fuelConfig}
            onUpdateJobs={handleUpdateJobs}
            onOpenOrderDetails={handleOpenOrderDetails}
            setSelDate={setSelDate}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "teams" && (
          <SetupScreen
            jobs={jobs}
            teams={teams}
            drivers={drivers}
            crew={crew}
            trucks={trucks}
            venues={venues}
            defaults={defaults}
            fuelConfig={fuelConfig}
            crewRate={crewRate}
            showPrefs={showPrefs}
            onUpdateJobs={handleUpdateJobs}
            onUpdateTeams={handleUpdateTeams}
            onUpdateDrivers={handleUpdateDrivers}
            onUpdateCrew={handleUpdateCrew}
            onUpdateTrucks={handleUpdateTrucks}
            onUpdateVenues={setVenues}
            onUpdateDefaults={setDefaults}
            onUpdateFuelConfig={setFuelConfig}
            onUpdateCrewRate={setCrewRate}
            onUpdateShowPrefs={setShowPrefs}
          />
        )}

        {/* Global Details Modal */}
        <OrderModal
          isOpen={isOrderModalOpen}
          jobId={activeJobId}
          jobs={jobs}
          teams={teams}
          trucks={trucks}
          onClose={() => setIsOrderModalOpen(false)}
          onUpdateJob={handleUpdateJobDetails}
          onGotoDate={handleGotoDate}
        />
      </div>

      {/* Renders print sheets outside of #app layout - hidden by default, visible during window.print() */}
      <PrintSheet
        jobs={jobs}
        teams={teams}
        drivers={drivers}
        crew={crew}
        trucks={trucks}
        defaults={defaults}
        fuelConfig={fuelConfig}
        selDate={selDate}
      />
    </>
  );
}
