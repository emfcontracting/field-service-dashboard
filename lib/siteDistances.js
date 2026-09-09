// lib/siteDistances.js
// ─────────────────────────────────────────────────────────────────────────────
// How long it takes to get from our base to each UPS site, and whether a
// technician's check-in time is a believable arrival for that distance.
//
// WHY THIS EXISTS: CBRE calculates our Response Rate from the arrival time we
// report (Supplier Training Guide, "VAWS: Site Arrival" — target 85% on time).
// The only arrival timestamp we actually hold is work_orders.time_in, the
// technician's first check-in in the FSM app. For a same-day emergency that IS
// the arrival. For a job attended days later it is the arrival of that visit.
// Either way it is a real observation, and it is what we report.
//
// What this module does NOT do: invent an arrival time. The drive table is a
// plausibility band, not a source. A check-in that falls outside the band is
// flagged for a human, never replaced with a nicer number.
//
// BASE: SCCAH — Columbia Air Hub, West Columbia SC. Every drive time below is
// one-way road time from there.
//
// ⚠ THE DRIVE TIMES ARE ESTIMATES and are meant to be corrected. They came from
// road distances, not from measured trips. Daniel's own rule of thumb — our
// response runs 0.5 to 3.5 hours depending on distance — is what MIN_RESPONSE_H
// and MAX_RESPONSE_H encode. Fix a wrong number here and every check re-runs
// against it; nothing else needs to change.
// ─────────────────────────────────────────────────────────────────────────────

export const BASE_CODE = 'SCCAH';
export const BASE_NAME = 'Columbia Air Hub (West Columbia, SC)';

// Daniel's own rule of thumb: our response runs 0.5 to 3.5 hours depending on
// distance. So 3.5h is the normal ceiling for ANY site, near or far — a job an
// hour away answered in three hours is still a normal response, not a late one.
// The distance says where inside that range you would expect to land; it does
// not tighten the ceiling. A site further out than 2.5 hours gets its drive plus
// mobilisation instead, because the ceiling cannot sit below the drive itself.
export const MIN_RESPONSE_H = 0.5;
export const MAX_RESPONSE_H = 3.5;

// Slack on top of the drive itself: dispatch, load-out, gate, walking to the
// equipment. Added to the drive time to get the top of the expected window.
export const MOBILIZATION_H = 1.0;

// A check-in this much faster than the drive cannot be real — the truck could
// not have covered the distance. Below this fraction of the drive we treat the
// timestamp as wrong, not the response as fast.
const TOO_FAST_FRACTION = 0.8;

// Beyond this, a time_in / created_at pair is corrupt rather than late. The
// live data holds sixteen of these (B3297333 sits on 01/08 for a 09/08 work
// order; C3297218 lands 276 days early).
const ABSURD_H = 24 * 60;

// ── the table ────────────────────────────────────────────────────────────────
// 5-letter UPS building code → one-way drive hours from SCCAH.
// `sure: false` marks a site whose location we have not confirmed.
export const DRIVE_HOURS = {
  SCCAH: { h: 0.0,  name: 'Columbia Air Hub',        sure: true  },   // base
  SCCAE: { h: 0.2,  name: 'West Columbia Air Ramp',  sure: true  },
  SCCOL: { h: 0.4,  name: 'Columbia Hub',            sure: true  },
  SCORA: { h: 0.8,  name: 'Orangeburg Center',       sure: true  },
  SCSMT: { h: 0.85, name: 'Sumter Center',           sure: true  },
  SCAIK: { h: 1.0,  name: 'Aiken Center',            sure: true  },
  GAAUG: { h: 1.2,  name: 'Augusta',                 sure: true  },
  SCFLO: { h: 1.4,  name: 'Florence Center',         sure: true  },
  SCTON: { h: 1.5,  name: 'Palmetto',                sure: false },   // ⚠ unconfirmed — 145 work orders ride on this one
  SCSMV: { h: 1.6,  name: 'Summerville Center',      sure: true  },
  NCWCH: { h: 1.6,  name: 'West Charlotte Facility', sure: false },
  GAWAR: { h: 1.7,  name: 'Warrenton',               sure: true  },
  SCCHA: { h: 1.85, name: 'Charleston Center',       sure: true  },
  NCSOU: { h: 2.4,  name: 'Southern Pines Center',   sure: true  },
  GAATH: { h: 2.6,  name: 'Athens',                  sure: false },
  NCFAY: { h: 2.6,  name: 'Fayetteville Center',     sure: true  },
  SCBEA: { h: 2.6,  name: 'Parris Island Center',    sure: true  },
  GASNH: { h: 2.75, name: 'Savannah',                sure: true  },
  SCMYR: { h: 2.75, name: 'Myrtle Beach Center',     sure: true  },
  SCLON: { h: 3.0,  name: 'North Myrtle Beach',      sure: true  },
  SCHIL: { h: 3.1,  name: 'Hilton Head',             sure: true  },
  NCWLK: { h: 3.3,  name: 'Wilmington Center',       sure: false },
  GAORD: { h: 3.4,  name: 'Buford Package Center',   sure: false },
  GAPLE: { h: 3.4,  name: 'Pleasantdale Hub',        sure: false },
};

// "GAAUG - AUGUSTA" | "SCLON-UPS NORTH MYRTLE" | "\tSCCHA - ..." | "SCFLO"
// → "GAAUG". Same rule as lib/cbreVendorForm.js buildingCode(), kept separate
// so this module can be used without pulling the form code in.
export function siteCode(raw) {
  if (!raw) return null;
  const code = String(raw).split('-')[0].trim().toUpperCase();
  return /^[A-Z]{5}$/.test(code) ? code : null;
}

export function siteInfo(raw) {
  const code = siteCode(raw);
  if (!code) return null;
  const row = DRIVE_HOURS[code];
  return row ? { code, ...row } : { code, h: null, name: null, sure: false };
}

/**
 * The window in which an arrival at this site is believable, measured in hours
 * after dispatch. Null when we do not know the site.
 */
export function arrivalWindow(raw) {
  const info = siteInfo(raw);
  if (!info || info.h == null) return null;
  const minH = Math.max(MIN_RESPONSE_H, info.h * TOO_FAST_FRACTION);
  const maxH = Math.max(
    MAX_RESPONSE_H,                    // the normal ceiling, whatever the site
    info.h + MOBILIZATION_H,           // …unless the drive alone is longer
    minH + 0.25,                       // never an empty or inverted window
  );
  return { code: info.code, name: info.name, sure: info.sure, driveH: info.h, minH, maxH };
}

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const VERDICTS = {
  ok:         { label: 'in the expected window', report: true,  flag: false },
  unknown:    { label: 'site not in the drive table — not checked', report: true, flag: false },
  late:       { label: 'later than the drive explains', report: true,  flag: true  },
  early:      { label: 'faster than the drive allows',  report: false, flag: true  },
  impossible: { label: 'check-in cannot be right',      report: false, flag: true  },
  no_data:    { label: 'no check-in recorded',          report: false, flag: false },
};

/**
 * Judge a work order's check-in as an arrival report.
 *
 * `report:false` means: queue it so the office sees it, but do NOT prefill the
 * date into CBRE's form. A wrong arrival on CBRE's permanent record is worse
 * than a missing one.
 *
 * returns { verdict, report, flag, hours, window, note }
 */
export function checkArrival(wo) {
  const dispatch = toDate(wo?.created_at) || toDate(wo?.date_entered);
  const arrived = toDate(wo?.time_in);
  const window = arrivalWindow(wo?.ups_building_code || wo?.building);

  const out = (verdict, note, hours = null) => ({
    verdict,
    ...VERDICTS[verdict],
    hours,
    window,
    note,
  });

  if (!arrived) return out('no_data', 'no time_in on the work order');
  if (!dispatch) return out('unknown', 'no dispatch timestamp to measure from');

  const hours = (arrived.getTime() - dispatch.getTime()) / 3600000;

  if (Math.abs(hours) > ABSURD_H) {
    return out('impossible', `check-in is ${Math.round(hours / 24)} days from dispatch — the timestamp is wrong`, hours);
  }
  if (hours < 0) {
    return out('impossible', 'check-in is before the work order was dispatched — CBRE refuses backdated arrivals', hours);
  }
  if (!window) {
    return out('unknown', `${siteCode(wo?.building) || 'site'} is not in the drive table`, hours);
  }
  if (hours < window.minH) {
    return out('early', `arrived in ${hours.toFixed(1)}h but the drive alone is ${window.driveH.toFixed(1)}h`, hours);
  }
  if (hours > window.maxH) {
    return out('late', `${hours.toFixed(1)}h after dispatch, expected ${window.minH.toFixed(1)}–${window.maxH.toFixed(1)}h`, hours);
  }
  return out('ok', `${hours.toFixed(1)}h after dispatch, within ${window.minH.toFixed(1)}–${window.maxH.toFixed(1)}h`, hours);
}
