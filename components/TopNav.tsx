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
      <span
        id="save-badge"
        style={{
          marginLeft: "auto",
          fontSize: "10px",
          color: "var(--t3)",
          fontFamily: "'JetBrains Mono', monospace",
          paddingBottom: "14px"
        }}
      >
        {saveStatus}
      </span>
    </div>
  );
}
