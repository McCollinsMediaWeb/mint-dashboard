import React from "react";
import { Suggestion } from "@/lib/suggestions";

interface SuggestionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  suggestions: Suggestion[];
  onApplySuggestion: (sug: Suggestion) => void;
}

export default function SuggestionsModal({
  isOpen,
  onClose,
  suggestions,
  onApplySuggestion
}: SuggestionsModalProps) {
  if (!isOpen) return null;

  return (
    <div id="sug-modal" className="open" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="od-card" style={{ maxWidth: "620px" }}>
        <div className="od-hdr">
          <div style={{ flex: 1 }}>
            <h3>
              <i className="ti ti-bulb" style={{ color: "var(--amber)", marginRight: "5px" }}></i> 
              Simulated Improvements
            </h3>
            <div className="od-sub">
              Human-approved adjustments. These are shifts that could save travel distance, drop outsource hires, or resolve overlaps.
            </div>
          </div>
          <button className="icon-btn" aria-label="Close" onClick={onClose}>
            <i className="ti ti-x" style={{ fontSize: "15px" }}></i>
          </button>
        </div>

        <div className="sug-list" style={{ maxHeight: "400px", overflowY: "auto" }}>
          {suggestions.length > 0 ? (
            suggestions.map((s, idx) => (
              <div key={idx} className="sug-item">
                <div className="sug-ic">
                  <i className={`ti ${s.icon}`}></i>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sug-t">
                    {s.title}
                    {s.tag && <span className="sug-tag">{s.tag}</span>}
                  </div>
                  <div className="sug-b">
                    {s.benefit}
                  </div>
                </div>
                <button
                  className="btn sm amber"
                  onClick={() => onApplySuggestion(s)}
                  style={{ alignSelf: "center", marginLeft: "10px" }}
                >
                  Apply
                </button>
              </div>
            ))
          ) : (
            <div className="od-missing" style={{ padding: "30px 16px", textAlign: "center" }}>
              No automated suggestions found for this date. The schedule is either optimal or no time-nudge improvements are available.
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
