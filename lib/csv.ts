import { Job, Venue, AppDefaults } from "./types";
import { uid, normSize, fmtOrderNo, parseDt, twS, toS, gen5, venueColSetup } from "./utils";

export function splitCSV(line: string): string[] {
  const r: string[] = [];
  let c = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      q = !q;
    } else if (ch === ',' && !q) {
      r.push(c.trim());
      c = '';
    } else {
      c += ch;
    }
  }
  r.push(c.trim());
  return r;
}

export function parseCSVRows(text: string): string[][] {
  text = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else q = false;
      } else field += c;
    } else {
      if (c === '"') q = true;
      else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

export function rmsDT(s: string | null | undefined): { date: string; time: string } {
  s = String(s || '').trim();
  if (!s) return { date: '', time: '' };
  const m = s.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (!m) return { date: '', time: '' };
  return {
    date: m[1] + '-' + m[2].padStart(2, '0') + '-' + m[3].padStart(2, '0'),
    time: m[4] ? (m[4].padStart(2, '0') + ':' + m[5]) : ''
  };
}

export function rmsExpand(r: any): any[] {
  const num = String(r.number || r.order_no || '').replace(/^MQTN[-\s]?/i, '').replace(/^[DC]-/i, '').trim();
  const addr = [r.delivery_address_street, r.delivery_address_city].filter(Boolean).join(', ').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
  const base = {
    order_no: num,
    organisation: r.organisation || r.organization || '',
    subject: r.subject || '',
    delivery_address_street: r.delivery_address_street || '',
    delivery_address_city: r.delivery_address_city || '',
    venue_type: r.venue_type || '',
    order_load_size: r.order_load_size || r.load_size || '',
    number_of_trucks: r.number_of_trucks || '',
    crew_required: r.crew_required || '',
    owner: r.owner || '',
    set_up_duration: r.set_up_duration || r.setup_duration || '',
    delivery_start_date: r.delivery_start_date || '',
    collection_start_date: r.collection_start_date || ''
  };
  
  const out: any[] = [];
  const d = rmsDT(r.delivery_start_date);
  if (d.date) {
    out.push(Object.assign({}, base, { type: 'Delivery', date: d.date, arrival: d.time, setup_mins: r.set_up_duration || r.setup_duration || '' }));
  }
  const c = rmsDT(r.collection_start_date);
  if (c.date) {
    out.push(Object.assign({}, base, { type: 'Collection', date: c.date, arrival: c.time, linked_order: num }));
  }
  return out;
}

export function parseCSV(text: string): any[] {
  const rows = parseCSVRows(text);
  if (rows.length < 2) return [];
  const hdrs = rows[0].map(h => String(h).trim().toLowerCase().replace(/[\s\-]+/g, '_'));
  const recs: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const obj: any = {};
    hdrs.forEach((h, idx) => {
      obj[h] = String(rows[i][idx] || '').trim();
    });
    if (Object.keys(obj).some(k => obj[k])) recs.push(obj);
  }
  
  if (hdrs.includes('delivery_start_date') || (hdrs.includes('number') && hdrs.includes('collection_start_date'))) {
    return recs.reduce((a, r) => a.concat(rmsExpand(r)), []);
  }
  return recs.filter(o => o.client || o.organisation || o.organization || o.order_no);
}

export function normOrder(o: any, defDate: string, venues: Venue[], def: AppDefaults): Job {
  const ty = o.type || 'Delivery';
  const isC = ty.toLowerCase() === 'collection';
  const sm = parseInt(o.setup_mins || o.set_up_duration || o.setup_duration || o.setup || '', 10);
  const bf = parseInt(o.buffer_mins || o.buffer || '', 10);
  const tk = parseInt(o.trucks || o.number_of_trucks || o.trucks_needed || o.trucks_required || '', 10);
  const cw = parseInt(o.crew || o.crew_required || o.crew_needed || o.crew_required || '', 10);
  const spRaw = String(o.split || o.split_allowed || '').trim().toLowerCase();
  const sp = !(spRaw === 'no' || spRaw === 'false' || spRaw === '0' || spRaw === 'together' || spRaw === 'convoy');
  
  const dtVal = o.date || o.date_ || '';
  const dt = dtVal ? (parseDt(dtVal) ? dtVal : defDate) : defDate;
  
  const twRaw = o.arrival || o.arrival_on_site || o.arrival_time || o.time_window || o.time || '';
  const twN = (twS(twRaw) != null) ? toS(twS(twRaw)) : '';
  
  const onN = fmtOrderNo((o.order_no || '').trim() || gen5(), ty);
  const loN = (o.linked_order || '').trim() ? fmtOrderNo(o.linked_order, isC ? 'Delivery' : 'Collection') : '';
  
  const veRaw = (o.venue || o.venue_type || '').trim();
  let veName = '', veSetup: number | null = null, veCol: number | null = null;
  
  if (veRaw) {
    const vm = venues.find(v => v.name.toLowerCase() === veRaw.toLowerCase())
      || venues.find(v => veRaw.toLowerCase().includes(v.name.toLowerCase()) || v.name.toLowerCase().includes(veRaw.toLowerCase()));
    if (vm) {
      veName = vm.name;
      veSetup = vm.setup;
      veCol = venueColSetup(vm);
    } else {
      veName = veRaw;
    }
  }
  
  return {
    _id: uid(),
    order_no: onN,
    client: o.client || o.organisation || o.organization || '',
    address: o.address || [o.delivery_address_street, o.delivery_address_city].filter(Boolean).join(', ') || '',
    items: o.items || o.subject || '',
    date: dt,
    time_window: twN,
    type: ty,
    size: normSize(o.size || o.load || o.order_load_size || o.load_size || ''),
    phone: o.phone || o.contact || o.client_phone || '',
    notes: o.notes || o.note || o.site_notes || (o.owner ? `Salesman: ${o.owner}` : ''),
    venue_type: veName,
    trucks: (!isNaN(tk) && tk >= 1) ? tk : 1,
    crew: (!isNaN(cw) && cw >= 0) ? cw : 2,
    split: sp,
    setup_mins: isNaN(sm) ? (veSetup != null ? (isC ? veCol! : veSetup) : (isC ? def.col : def.del)) : sm,
    _customSetup: !isNaN(sm) || veSetup != null,
    buffer_mins: isNaN(bf) ? def.buf : bf,
    _customBuf: !isNaN(bf),
    linked_order: loN,
    continuity: '',
    split_note: '',
    team_id: null,
    status: 'active',
    _tr: undefined,
    _buf: undefined,
    _bufOk: true,
    _backhaul: false
  };
}

export function genSampleOrders(): any[] {
  return [
    { order_no: '57580', type: 'Delivery', client: 'Sally Maddison.', address: 'MINT Market Street 3 Villa 15 Reem Arabian ranches 2', items: '', phone: '+971 55 639 2525', notes: '', size: 'S', split: 'yes', date: '2026-06-11', arrival: '07:30', venue: 'Villa - Small', linked_order: '57580', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 60 },
    { order_no: '57585', type: 'Delivery', client: 'RLG Retail LLC', address: 'Dubai Mall Piaget - Fashion Avenue Ground Floor Loading Bay 4', items: '', phone: '+971 50 449 7435', notes: '', size: 'S', split: 'yes', date: '2026-06-11', arrival: '08:00', venue: 'Villa - Small', linked_order: '57585', trucks: 1, crew: 2, setup_mins: 60, buffer_mins: 30 },
    { order_no: '57569', type: 'Delivery', client: 'Natalja Lomakina', address: 'ISD Padel https://maps.app.goo.gl/LYhuS6gE1gjvFZbv7', items: '', phone: '+971569095530', notes: '', size: 'S', split: 'yes', date: '2026-06-11', arrival: '09:00', venue: 'Villa - Small', linked_order: '57569', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 30 },
    { order_no: '12356', type: 'Delivery', client: 'N M K ELECTRONICS TRADING L L C SOLE', address: 'Reem Island Abu Dhabi', items: '', phone: '', notes: '', size: 'M', split: 'yes', date: '2026-06-11', arrival: '10:30', venue: 'Hotel Ballroom - Small Order', linked_order: '12356', trucks: 1, crew: 2, setup_mins: 90, buffer_mins: 30 },
    { order_no: '57587', type: 'Collection', client: 'EIDEAL TRADING LLC', address: 'Al Quoz – 48 First Al Khail St', items: '', phone: '+971 56 982 8408', notes: '', size: 'S', split: 'yes', date: '2026-06-11', arrival: '11:00', venue: 'Villa - Small', linked_order: '', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 30 },
    { order_no: '57485', type: 'Collection', client: 'Sahab Marketing Management', address: 'Ajman Saray Hotel', items: '', phone: '', notes: '', size: 'L', split: 'yes', date: '2026-06-11', arrival: '15:00', venue: 'Hotel Ballroom - Big Order', linked_order: '', trucks: 1, crew: 2, setup_mins: 120, buffer_mins: 30 },
    { order_no: '57363', type: 'Collection', client: 'ARADA KHADAMAT LLC', address: 'Muwaileh Commercial Sharjah', items: '', phone: '', notes: '', size: 'M', split: 'yes', date: '2026-06-11', arrival: '15:00', venue: 'Hotel Ballroom - Big Order', linked_order: '', trucks: 1, crew: 2, setup_mins: 120, buffer_mins: 30 },
    { order_no: '12356', type: 'Collection', client: 'N M K ELECTRONICS TRADING L L C SOLE', address: 'Reem Island Abu Dhabi', items: '', phone: '', notes: '', size: 'M', split: 'yes', date: '2026-06-11', arrival: '17:30', venue: 'Hotel Ballroom - Small Order', linked_order: '12356', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 30 },
    { order_no: '57550', type: 'Collection', client: 'Wasl LLC', address: 'Grand Hyatt Dubai', items: '', phone: '', notes: '', size: 'M', split: 'yes', date: '2026-06-11', arrival: '17:30', venue: 'Hotel Ballroom - Small Order', linked_order: '', trucks: 1, crew: 2, setup_mins: 90, buffer_mins: 30 },
    { order_no: '57580', type: 'Collection', client: 'Sally Maddison.', address: 'MINT Market Street 3 Villa 15 Reem Arabian ranches 2', items: '', phone: '+971 55 639 2525', notes: '', size: 'S', split: 'yes', date: '2026-06-11', arrival: '19:00', venue: 'Villa - Small', linked_order: '57580', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 30 },
    { order_no: '57585', type: 'Collection', client: 'RLG Retail LLC', address: 'Dubai Mall Piaget - Fashion Avenue Ground Floor Loading Bay 4', items: '', phone: '+971 50 449 7435', notes: '', size: 'S', split: 'yes', date: '2026-06-12', arrival: '08:00', venue: 'Villa - Small', linked_order: '57585', trucks: 1, crew: 2, setup_mins: 60, buffer_mins: 30 },
    { order_no: '57569', type: 'Collection', client: 'Natalja Lomakina', address: 'ISD Padel https://maps.app.goo.gl/LYhuS6gE1gjvFZbv7', items: '', phone: '+971569095530', notes: '', size: 'S', split: 'yes', date: '2026-06-12', arrival: '09:00', venue: 'Villa - Small', linked_order: '57569', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 30 },
    { order_no: '57490', type: 'Delivery', client: 'N M K ELECTRONICS TRADING L L C SOLE PROPRIETORSHIP', address: 'Radiant Square Viewz 1, Unit M102 (UG Floor), Reem Island Parking: B1', items: '', phone: '0543286457', notes: '', size: 'M', split: 'yes', date: '2026-11-06', arrival: '10:30', venue: 'Hotel Ballroom - Small Order', linked_order: '57490', trucks: 1, crew: 2, setup_mins: 90, buffer_mins: 30 },
    { order_no: '57490', type: 'Collection', client: 'N M K ELECTRONICS TRADING L L C SOLE PROPRIETORSHIP', address: 'Radiant Square Viewz 1, Unit M102 (UG Floor), Reem Island Parking: B1', items: '', phone: '0543286457', notes: '', size: 'M', split: 'yes', date: '2026-11-06', arrival: '17:30', venue: 'Hotel Ballroom - Small Order', linked_order: '57490', trucks: 1, crew: 2, setup_mins: 30, buffer_mins: 30 }
  ];
}
