import React, { useState } from "react";
import { Job, Team } from "@/lib/types";
import { todayStr } from "@/lib/utils";
import { TPAL } from "@/lib/constants";

interface CalendarPanelProps {
  selDate: string;
  setSelDate: (date: string) => void;
  jobs: Job[];
  teams: Team[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export default function CalendarPanel({
  selDate,
  setSelDate,
  jobs,
  teams
}: CalendarPanelProps) {
  // Calendar month/year navigation state
  const initialYear = selDate ? parseInt(selDate.slice(0, 4)) : new Date().getFullYear();
  const initialMonth = selDate ? parseInt(selDate.slice(5, 7)) - 1 : new Date().getMonth();
  
  const [calY, setCalY] = useState(initialYear);
  const [calM, setCalM] = useState(initialMonth);

  const handlePrev = () => {
    if (calM === 0) {
      setCalM(11);
      setCalY(prev => prev - 1);
    } else {
      setCalM(prev => prev - 1);
    }
  };

  const handleNext = () => {
    if (calM === 11) {
      setCalM(0);
      setCalY(prev => prev + 1);
    } else {
      setCalM(prev => prev + 1);
    }
  };

  const handleToday = () => {
    const today = todayStr();
    setCalY(new Date().getFullYear());
    setCalM(new Date().getMonth());
    setSelDate(today);
  };

  // Build dot map: day string -> Set of team color indices
  const dotMap: Record<string, Set<number>> = {};
  jobs.forEach(j => {
    if (!j.date || !j.team_id || j.status === "cancelled") return;
    const t = teams.find(team => team.id === j.team_id);
    if (!t) return;
    if (!dotMap[j.date]) {
      dotMap[j.date] = new Set<number>();
    }
    dotMap[j.date].add(t.colorIdx);
  });

  const fd = new Date(calY, calM, 1).getDay();
  // Monday is index 0 in our grid, so we adjust fd: Sunday is 0, Mon is 1 -> fd=0 (Sun) means offset=6, fd=1 (Mon) means offset=0
  const offset = (fd + 6) % 7;
  const dim = new Date(calY, calM + 1, 0).getDate();
  const today = todayStr();

  const days: React.ReactNode[] = [];
  
  // Render offset days from previous month
  for (let i = 0; i < offset; i++) {
    days.push(<div key={`offset-${i}`} className="cday other"></div>);
  }

  // Render month days
  for (let d = 1; d <= dim; d++) {
    const dayString = `${calY}-${String(calM + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    let cls = "cday";
    if (dayString === today) cls += " today";
    if (dayString === selDate) cls += " selected";

    const dots = dotMap[dayString];
    const dotElements = dots && dots.size > 0 ? (
      <div className="cdots">
        {Array.from(dots).slice(0, 4).map((colorIdx, idx) => (
          <div
            key={idx}
            className="cdot"
            style={{ background: TPAL[colorIdx % TPAL.length].dot }}
          ></div>
        ))}
      </div>
    ) : null;

    days.push(
      <div
        key={`day-${d}`}
        className={cls}
        onClick={() => setSelDate(dayString)}
        style={{ cursor: "pointer" }}
      >
        <span>{d}</span>
        {dotElements}
      </div>
    );
  }

  return (
    <div className="cal-wrap">
      <div className="cal-hdr">
        <span className="cal-mo" id="cal-lbl">
          {MONTHS[calM]} {calY}
        </span>
        <div className="cal-nav">
          <button id="cal-prev" aria-label="Prev month" onClick={handlePrev}>
            <i className="ti ti-chevron-left"></i>
          </button>
          <button id="cal-next" aria-label="Next month" onClick={handleNext}>
            <i className="ti ti-chevron-right"></i>
          </button>
        </div>
      </div>
      <div className="cal-gw">
        <div className="cal-dow-row">
          <div className="cal-dow">Mo</div>
          <div className="cal-dow">Tu</div>
          <div className="cal-dow">We</div>
          <div className="cal-dow">Th</div>
          <div className="cal-dow">Fr</div>
          <div className="cal-dow">Sa</div>
          <div className="cal-dow">Su</div>
        </div>
        <div className="cal-days" id="cal-days">
          {days}
        </div>
      </div>
      <div className="cal-foot">
        <button className="today-btn" id="cal-today" onClick={handleToday}>
          Today
        </button>
      </div>
    </div>
  );
}
