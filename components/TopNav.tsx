import React from "react";

interface TopNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  orderCount: number;
  setupCount: number;
  saveStatus: string;
}

export default function TopNav({
  activeTab,
  setActiveTab,
  orderCount,
  setupCount,
  saveStatus
}: TopNavProps) {
  const handleLogout = async () => {
    if (confirm("Are you sure you want to log out of the platform?")) {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      } catch (err) {
        console.error("Logout failed:", err);
      }
    }
  };

  return (
    <div className="top-nav">
      <div className="nav-brand">
        <div className="nav-brand-pill">
          <i className="ti ti-truck-delivery"></i> MINT OPS
        </div>
        <div>
          <h1>Operations Platform</h1>
          <div className="hub-tag">
            <i className="ti ti-building-warehouse" style={{ fontSize: "10px" }}></i> Hub: DIC Warehouse
          </div>
        </div>
      </div>
      <div className="nav-tabs">
        <button
          className={`nav-tab ${activeTab === "schedule" ? "active" : ""}`}
          onClick={() => setActiveTab("schedule")}
        >
          <i className="ti ti-calendar"></i> Schedule
        </button>
        <button
          className={`nav-tab ${activeTab === "orders" ? "active" : ""}`}
          onClick={() => setActiveTab("orders")}
        >
          <i className="ti ti-list-details"></i> All Orders{" "}
          <span className={`tcnt ${activeTab === "orders" ? "active" : ""}`} id="cnt-orders-nav">
            {orderCount}
          </span>
        </button>
        <button
          className={`nav-tab ${activeTab === "teams" ? "active" : ""}`}
          onClick={() => setActiveTab("teams")}
        >
          <i className="ti ti-settings"></i> Setup{" "}
          <span className={`tcnt ${activeTab === "teams" ? "active" : ""}`} id="cnt-teams-nav">
            {setupCount}
          </span>
        </button>
      </div>
      
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "16px", paddingBottom: "14px" }}>
        <span
          id="save-badge"
          style={{
            fontSize: "10px",
            color: "var(--t3)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {saveStatus}
        </span>
        <button
          onClick={handleLogout}
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#f87171",
            padding: "5px 10px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "600",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
          className="logout-btn-nav"
        >
          <i className="ti ti-logout"></i> Logout
        </button>
      </div>
    </div>
  );
}
