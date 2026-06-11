import React, { useState, useEffect } from "react";
import { Venue, Team, Job } from "@/lib/types";
import { todayStr, localISO, normSize, fmtOrderNo, gen5, coreNo, venueColSetup, uid } from "@/lib/utils";

interface AddOrderFormProps {
  venues: Venue[];
  teams: Team[];
  defaultDelMins: number;
  defaultColMins: number;
  defaultBufMins: number;
  selDate: string;
  onAdd: (job: Job, colJob: Job | null) => void;
  onCancel: () => void;
}

export default function AddOrderForm({
  venues,
  teams,
  defaultDelMins,
  defaultColMins,
  defaultBufMins,
  selDate,
  onAdd,
  onCancel
}: AddOrderFormProps) {
  const tomorrow = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return localISO(d);
  };

  const [orderNo, setOrderNo] = useState("");
  const [conly, setConly] = useState(false); // Collection only
  const [venueId, setVenueId] = useState("");
  const [size, setSize] = useState("S");
  const [trucks, setTrucks] = useState(1);
  const [crew, setCrew] = useState(2);
  const [split, setSplit] = useState(true); // true = Separate trucks, false = Convoy
  
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [items, setItems] = useState("");
  const [notes, setNotes] = useState("");

  const [date, setDate] = useState(selDate || tomorrow());
  const [timeWindow, setTimeWindow] = useState("");
  const [setupMins, setSetupMins] = useState("");
  const [bufferMins, setBufferMins] = useState("");

  const [colDate, setColDate] = useState("");
  const [colTime, setColTime] = useState("");
  const [colSetupMins, setColSetupMins] = useState("");

  const [linkedOrder, setLinkedOrder] = useState("");
  const [teamId, setTeamId] = useState("");
  
  const [validationError, setValidationError] = useState("");
  const [errorsList, setErrorsList] = useState<Record<string, boolean>>({});

  // Sync date with selected date if it changes
  useEffect(() => {
    if (selDate) {
      setDate(selDate);
    }
  }, [selDate]);

  const handleVenueChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vId = e.target.value;
    setVenueId(vId);
    const v = venues.find(x => x.id === vId);
    if (!v) return;

    setSetupMins(String(conly ? venueColSetup(v) : v.setup));
    if (!colSetupMins) {
      setColSetupMins(String(venueColSetup(v)));
    }
  };

  const handleConlyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setConly(checked);
    
    // update setup minutes placeholder/value based on conly status
    const v = venues.find(x => x.id === venueId);
    if (v) {
      setSetupMins(String(checked ? venueColSetup(v) : v.setup));
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    if (!date) newErrors.date = true;
    if (!client.trim()) newErrors.client = true;
    if (!address.trim()) newErrors.address = true;

    // Check optional collection fields
    const wantCol = !conly && (colDate || colTime);
    if (wantCol) {
      if (!colDate) newErrors.colDate = true;
      if (!colTime) newErrors.colTime = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrorsList(newErrors);
      setValidationError("Please fill in all required fields highlighted in red.");
      return;
    }

    setErrorsList({});
    setValidationError("");

    const ty = conly ? "Collection" : "Delivery";
    const smVal = parseInt(setupMins, 10);
    const bfVal = parseInt(bufferMins, 10);
    const tkVal = parseInt(trucks as any, 10);
    const cwVal = parseInt(crew as any, 10);
    const csVal = parseInt(colSetupMins, 10);
    
    const selectedVenue = venues.find(x => x.id === venueId) || null;
    
    const formattedOrderNo = fmtOrderNo(orderNo.trim() || gen5(), ty);

    const mainJob: Job = {
      _id: uid(),
      order_no: formattedOrderNo,
      client: client.trim(),
      address: address.trim(),
      items: items.trim(),
      phone: phone.trim(),
      notes: notes.trim(),
      venue_type: selectedVenue ? selectedVenue.name : "",
      date: date,
      time_window: timeWindow.trim(),
      type: ty,
      size: normSize(size),
      trucks: (!isNaN(tkVal) && tkVal >= 1) ? tkVal : 1,
      crew: (!isNaN(cwVal) && cwVal >= 0) ? cwVal : 2,
      split: split,
      setup_mins: isNaN(smVal) ? (selectedVenue && !conly ? selectedVenue.setup : (conly ? defaultColMins : defaultDelMins)) : smVal,
      _customSetup: !isNaN(smVal) || !!selectedVenue,
      buffer_mins: isNaN(bfVal) ? defaultBufMins : bfVal,
      _customBuf: !isNaN(bfVal),
      linked_order: linkedOrder ? fmtOrderNo(linkedOrder, conly ? "Delivery" : "Collection") : "",
      continuity: "",
      split_note: "",
      team_id: teamId || null,
      status: "active",
      _tr: undefined,
      _buf: undefined,
      _bufOk: true,
      _backhaul: false
    };

    let colJob: Job | null = null;
    if (wantCol) {
      const colNo = "C-" + coreNo(mainJob.order_no);
      mainJob.linked_order = colNo;
      colJob = {
        _id: uid(),
        order_no: colNo,
        client: mainJob.client,
        address: mainJob.address,
        items: mainJob.items,
        phone: mainJob.phone,
        notes: mainJob.notes,
        venue_type: mainJob.venue_type,
        date: colDate,
        time_window: colTime.trim(),
        type: "Collection",
        size: mainJob.size,
        trucks: mainJob.trucks,
        crew: mainJob.crew,
        split: mainJob.split,
        setup_mins: isNaN(csVal) ? (selectedVenue ? venueColSetup(selectedVenue) : defaultColMins) : csVal,
        _customSetup: !isNaN(csVal) || !!selectedVenue,
        buffer_mins: mainJob.buffer_mins,
        _customBuf: mainJob._customBuf,
        linked_order: mainJob.order_no,
        continuity: "",
        split_note: "",
        team_id: null,
        status: "active",
        _tr: undefined,
        _buf: undefined,
        _bufOk: true,
        _backhaul: false
      };
    }

    onAdd(mainJob, colJob);
  };

  return (
    <div className="aof" style={{ marginBottom: "20px" }}>
      <h3>
        <i className="ti ti-plus"></i> New order
      </h3>
      
      <div className="sec-lbl">Order</div>
      <div className="fg">
        <div className="fgrp">
          <label>Order No</label>
          <input
            className="finp"
            value={orderNo}
            onChange={e => setOrderNo(e.target.value)}
            placeholder="MQTN57550 or 57550"
          />
        </div>
        <div className="fgrp" style={{ gridColumn: "span 2" }}>
          <label>Order type</label>
          <label className="conly">
            <input
              type="checkbox"
              checked={conly}
              onChange={handleConlyChange}
            />{" "}
            <span>
              <strong>Collection only</strong> — goods were already delivered, just schedule the pickup
            </span>
          </label>
        </div>
        <div className="fgrp">
          <label>Venue type</label>
          <select className="fsel" value={venueId} onChange={handleVenueChange}>
            <option value="">— choose (fills setup) —</option>
            {venues.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.setup >= 60 ? `${Math.floor(v.setup / 60)}h ${v.setup % 60 ? `${v.setup % 60}m` : ""}` : `${v.setup}m`}
              </option>
            ))}
          </select>
        </div>
        <div className="fgrp">
          <label>Size (truck load)</label>
          <select className="fsel" value={size} onChange={e => setSize(e.target.value)}>
            <option value="XS">XS · 10% of 5t</option>
            <option value="S">S · 25% of 5t</option>
            <option value="M">M · 50% of 5t</option>
            <option value="L">L · 75% of 5t</option>
            <option value="XL">XL · 100% of 5t</option>
          </select>
        </div>
        <div className="fgrp">
          <label>Trucks needed</label>
          <input
            className="finp"
            type="number"
            min="1"
            value={trucks}
            onChange={e => setTrucks(parseInt(e.target.value, 10) || 1)}
            title="2+ for orders too big for one truck"
          />
        </div>
        <div className="fgrp">
          <label>Crew needed</label>
          <input
            className="finp"
            type="number"
            min="0"
            value={crew}
            onChange={e => setCrew(parseInt(e.target.value, 10) || 0)}
            title="Total crew across all trucks for this order"
          />
        </div>
        <div className="fgrp">
          <label>Multi-truck mode</label>
          <select
            className="fsel"
            value={split ? "1" : "0"}
            onChange={e => setSplit(e.target.value === "1")}
          >
            <option value="1">Separate trucks — all within the setup window</option>
            <option value="0">Convoy — all trucks arrive together at the start</option>
          </select>
        </div>
      </div>

      <div className="sec-lbl">Client &amp; site</div>
      <div className="fg">
        <div className="fgrp">
          <label style={{ color: errorsList.client ? "var(--red)" : "inherit" }}>Client *</label>
          <input
            className="finp"
            style={{ outline: errorsList.client ? "1px solid var(--red)" : "" }}
            value={client}
            onChange={e => setClient(e.target.value)}
            placeholder="Client name"
          />
        </div>
        <div className="fgrp">
          <label>Client phone</label>
          <input
            className="finp"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+971 5x xxx xxxx"
          />
        </div>
        <div className="fgrp" style={{ gridColumn: "span 2" }}>
          <label style={{ color: errorsList.address ? "var(--red)" : "inherit" }}>Address *</label>
          <input
            className="finp"
            style={{ outline: errorsList.address ? "1px solid var(--red)" : "" }}
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Full address in Dubai"
          />
        </div>
        <div className="fgrp" style={{ gridColumn: "span 2" }}>
          <label>Items</label>
          <input
            className="finp"
            value={items}
            onChange={e => setItems(e.target.value)}
            placeholder="Lounge Sofa x2, Coffee Table x1"
          />
        </div>
        <div className="fgrp" style={{ gridColumn: "span 2" }}>
          <label>Site notes</label>
          <input
            className="finp"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Gate code, loading dock, call before arriving…"
          />
        </div>
      </div>

      <div className="sec-lbl" id="sl-timing">
        {conly ? "Collection timing" : "Delivery timing"}
      </div>
      <div className="fg">
        <div className="fgrp">
          <label style={{ color: errorsList.date ? "var(--red)" : "inherit" }}>
            {conly ? "Collection date *" : "Delivery date *"}
          </label>
          <input
            type="date"
            className="finp"
            style={{
              outline: errorsList.date ? "1px solid var(--red)" : "",
              fontFamily: "'JetBrains Mono', monospace"
            }}
            value={date}
            onChange={e => setDate(e.target.value)}
          />
        </div>
        <div className="fgrp">
          <label>{conly ? "Collection arrival on site" : "Delivery arrival on site"}</label>
          <input
            className="finp"
            type="time"
            value={timeWindow}
            onChange={e => setTimeWindow(e.target.value)}
          />
        </div>
        <div className="fgrp">
          <label>Setup mins</label>
          <input
            className="finp"
            type="number"
            min="5"
            placeholder={String(conly ? defaultColMins : defaultDelMins)}
            value={setupMins}
            onChange={e => setSetupMins(e.target.value)}
          />
        </div>
        <div className="fgrp">
          <label>Buffer mins</label>
          <input
            className="finp"
            type="number"
            min="0"
            placeholder={String(defaultBufMins)}
            value={bufferMins}
            onChange={e => setBufferMins(e.target.value)}
          />
        </div>
      </div>

      {!conly && (
        <div id="col-section">
          <div className="sec-lbl" style={{ color: "var(--amber)" }}>
            Collection — fill to create the linked C- order
          </div>
          <div className="fg">
            <div className="fgrp">
              <label style={{ color: errorsList.colDate ? "var(--red)" : "inherit" }}>Collection date</label>
              <input
                type="date"
                className="finp"
                style={{
                  outline: errorsList.colDate ? "1px solid var(--red)" : "",
                  fontFamily: "'JetBrains Mono', monospace"
                }}
                value={colDate}
                onChange={e => setColDate(e.target.value)}
              />
            </div>
            <div className="fgrp">
              <label style={{ color: errorsList.colTime ? "var(--red)" : "inherit" }}>Collection arrival</label>
              <input
                className="finp"
                type="time"
                style={{ outline: errorsList.colTime ? "1px solid var(--red)" : "" }}
                value={colTime}
                onChange={e => setColTime(e.target.value)}
              />
            </div>
            <div className="fgrp">
              <label>Collection setup mins</label>
              <input
                className="finp"
                type="number"
                min="5"
                placeholder={String(defaultColMins)}
                value={colSetupMins}
                onChange={e => setColSetupMins(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="sec-lbl">Assignment</div>
      <div className="fg">
        <div className="fgrp">
          <label>Linked Order</label>
          <input
            className="finp"
            value={linkedOrder}
            onChange={e => setLinkedOrder(e.target.value)}
            placeholder="MQTN or D-/C- number"
          />
        </div>
        <div className="fgrp">
          <label>Pre-assign team</label>
          <select className="fsel" value={teamId} onChange={e => setTeamId(e.target.value)}>
            <option value="">— Auto assign —</option>
            {teams.map(t => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {validationError && (
        <div id="fo-err" style={{ display: "block", color: "var(--red)", fontSize: "11px", marginBottom: "8px" }}>
          {validationError}
        </div>
      )}

      <div className="fa" style={{ marginTop: "14px" }}>
        <button className="btn amber" onClick={handleSubmit}>
          <i className="ti ti-check"></i> Add order
        </button>
        <button className="btn" onClick={onCancel}>
          <i className="ti ti-x"></i> Cancel
        </button>
      </div>
    </div>
  );
}
