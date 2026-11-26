/**
 * Lázeňský plán — statická PWA.
 * Data: data/procedures.json (pole date, time, name, place, staff, type, note).
 */

"use strict";

const DATA_URL = "./data/procedures.json";
const LOCALE = "cs-CZ";
const EMPTY_LINES = [
  "Dnes volno. Odpočívej, mladý padawane.",
  "Žádné procedury. Síla je s tebou — odpočívej.",
  "Kalendář mlčí. Využij den k regeneraci.",
];
const DAY_FOOTER =
  "Choďte včas, nejlépe 5 min předem. Před procedurou vypněte mobil. Před bazénem se osprchujte. Do posilovny ve sportovní obuvi a oblečení.";

/** @typedef {"day" | "week" | "month"} ViewMode */

/** @type {{ date: string, time: string, name: string, place: string, staff: string, type: string, note: string }[]} */
let procedures = [];
/** @type {Map<string, typeof procedures>} */
let byDate = new Map();
let minDate = "";
let maxDate = "";
/** @type {ViewMode} */
let currentView = "day";
/** ISO YYYY-MM-DD */
let selectedDate = "";
let countdownTimer = 0;

const viewEl = document.getElementById("view");
const periodEl = document.getElementById("period-title");
const toastEl = document.getElementById("toast");

/* ---------- datum (vždy lokální, bez UTC z ISO stringu) ---------- */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function formatISO(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function todayISO() {
  return formatISO(new Date());
}

function addDays(iso, count) {
  const date = parseISO(iso);
  date.setDate(date.getDate() + count);
  return formatISO(date);
}

function addMonths(iso, count) {
  const date = parseISO(iso);
  date.setMonth(date.getMonth() + count);
  return formatISO(date);
}

/** Pondělí daného týdne. */
function startOfWeek(iso) {
  const date = parseISO(iso);
  const weekday = date.getDay();
  const diff = weekday === 0 ? -6 : 1 - weekday;
  date.setDate(date.getDate() + diff);
  return formatISO(date);
}

function clampToDataRange(iso) {
  if (!minDate || !maxDate) {
    return iso;
  }
  if (iso < minDate) {
    return minDate;
  }
  if (iso > maxDate) {
    return maxDate;
  }
  return iso;
}

function formatDayHeading(iso) {
  const date = parseISO(iso);
  return date.toLocaleDateString(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatWeekHeading(mondayIso) {
  const start = parseISO(mondayIso);
  const end = parseISO(addDays(mondayIso, 6));
  const startDay = start.getDate();
  const endLabel = end.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
  });
  if (start.getMonth() === end.getMonth()) {
    return `${startDay}.–${endLabel}`;
  }
  const startLabel = start.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
  });
  return `${startLabel} – ${endLabel}`;
}

function formatMonthHeading(iso) {
  return parseISO(iso).toLocaleDateString(LOCALE, {
    month: "long",
    year: "numeric",
  });
}

function weekdayShort(iso) {
  return parseISO(iso).toLocaleDateString(LOCALE, { weekday: "short" });
}

function procedureDateTime(item) {
  const [y, m, d] = item.date.split("-").map(Number);
  const [hh, mm] = item.time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

function formatCountdown(ms) {
  if (ms <= 0) {
    return "";
  }
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 1) {
    return "za chvíli";
  }
  if (totalMin < 60) {
    return `za ${totalMin} min`;
  }
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  if (minutes === 0) {
    return `za ${hours} h`;
  }
  return `za ${hours} h ${minutes} min`;
}

/* ---------- ikony procedur (Sith, tenký stroke) ---------- */

function svgWrap(paths) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

function iconFor(type) {
  switch (type) {
    case "elektro":
      return svgWrap(
        `<polygon points="13 2 6 14 12 14 11 22 18 10 12 10 13 2" />`
      );
    case "bazen":
      return svgWrap(
        `<path d="M4 7h16v10H4z" />
         <path d="M4 12c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />
         <path d="M4 16c1.5 1.2 3 1.2 4.5 0s3-1.2 4.5 0 3 1.2 4.5 0 3-1.2 4.5 0" />`
      );
    case "fyzio":
      return svgWrap(
        `<circle cx="12" cy="12" r="8" />
         <path d="M8 13c1.2 1.6 2.6 2.4 4 2.4s2.8-.8 4-2.4" />
         <path d="M9 10h.01M15 10h.01" />`
      );
    case "cviceni":
      return svgWrap(
        `<circle cx="12" cy="5" r="2" />
         <path d="M12 7v5" />
         <path d="M6 10h12" />
         <path d="M8 22l4-10 4 10" />`
      );
    case "chodnik":
      return svgWrap(
        `<path d="M5 20c3-6 4-10 4-16" />
         <path d="M19 20c-3-6-4-10-4-16" />
         <path d="M9.5 8h5" />
         <path d="M9 13h6" />
         <path d="M8.5 18h7" />`
      );
    case "koupel":
      return svgWrap(
        `<path d="M4 13h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" />
         <path d="M6 13V10a3 3 0 0 1 3-3h1" />
         <path d="M10 5c0 1.2.8 2 2 2s2-.8 2-2-.8-2-2-2" />`
      );
    case "zabal":
      return svgWrap(
        `<circle cx="12" cy="5.5" r="2" />
         <path d="M8 21c0-4 1.5-8 4-8s4 4 4 8" />
         <path d="M7.5 13h9" />
         <path d="M8 16.5h8" />
         <path d="M8.5 20h7" />`
      );
    case "vizita":
      return svgWrap(
        `<path d="M6 9l6-6 6 6v9H6z" />
         <path d="M9 14h6" />
         <path d="M12 11v6" />`
      );
    case "krio":
      return svgWrap(
        `<path d="M12 3v18" />
         <path d="M5.4 7.2l13.2 9.6" />
         <path d="M5.4 16.8l13.2-9.6" />
         <path d="M12 5.2l-2-2.2M12 5.2l2-2.2" />
         <path d="M12 18.8l-2 2.2M12 18.8l2 2.2" />
         <path d="M7.6 8.5l-2.4.1M7.6 8.5l-.4-2.4" />
         <path d="M16.4 8.5l2.4.1M16.4 8.5l.4-2.4" />
         <path d="M7.6 15.5l-2.4-.1M7.6 15.5l-.4 2.4" />
         <path d="M16.4 15.5l2.4-.1M16.4 15.5l.4 2.4" />`
      );
    default:
      return svgWrap(`<circle cx="12" cy="12" r="8" /><path d="M12 8v8" />`);
  }
}

function iconHtml(type) {
  const frost = type === "krio" ? " frost" : "";
  return `<span class="proc-icon${frost}">${iconFor(type)}</span>`;
}

/* ---------- data ---------- */

function indexProcedures(list) {
  const map = new Map();
  const sorted = [...list].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }
    return a.time.localeCompare(b.time);
  });
  for (const item of sorted) {
    const bucket = map.get(item.date);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(item.date, [item]);
    }
  }
  byDate = map;
  const dates = [...map.keys()].sort();
  minDate = dates[0] || "";
  maxDate = dates[dates.length - 1] || "";
}

function itemsOn(iso) {
  return byDate.get(iso) || [];
}

/* ---------- stavy dne ---------- */

function dayStates(iso, now = new Date()) {
  const items = itemsOn(iso);
  const upcomingIndex = items.findIndex((item) => procedureDateTime(item) > now);
  let currentIndex = -1;
  if (upcomingIndex === 0) {
    currentIndex = 0;
  } else if (upcomingIndex > 0) {
    currentIndex = upcomingIndex;
  } else if (items.length > 0) {
    currentIndex = items.length - 1;
  }

  const nextItem = upcomingIndex >= 0 ? items[upcomingIndex] : null;
  const countdown = nextItem
    ? formatCountdown(procedureDateTime(nextItem) - now)
    : "";

  return { items, currentIndex, upcomingIndex, countdown };
}

/* ---------- vykreslení ---------- */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderDay() {
  const { items, currentIndex, countdown } = dayStates(selectedDate);
  periodEl.textContent = formatDayHeading(selectedDate);

  if (items.length === 0) {
    const line = EMPTY_LINES[parseISO(selectedDate).getDate() % EMPTY_LINES.length];
    viewEl.innerHTML = `
      <div class="empty">
        <p class="empty-lead">Síla odpočinku</p>
        <p>${escapeHtml(line)}</p>
      </div>
      <p class="day-footer">${escapeHtml(DAY_FOOTER)}</p>`;
    return;
  }

  const cards = items
    .map((item, index) => {
      const classes = ["card"];
      if (index === currentIndex) {
        classes.push("current");
      } else if (index < currentIndex) {
        classes.push("past");
      }
      const staff = item.staff
        ? `<div class="card-staff">${escapeHtml(item.staff)}</div>`
        : "";
      const note = item.note
        ? `<div class="card-note">${escapeHtml(item.note)}</div>`
        : "";
      const countHtml =
        index === currentIndex && countdown
          ? `<div class="countdown">${escapeHtml(countdown)}</div>`
          : "";
      return `
        <article class="${classes.join(" ")}">
          <div class="card-time">${escapeHtml(item.time)}</div>
          <div class="card-body">
            <div class="card-head">${iconHtml(item.type)}<div class="card-name">${escapeHtml(item.name)}</div></div>
            <div class="card-place">${escapeHtml(item.place)}</div>
            ${staff}${note}${countHtml}
          </div>
        </article>`;
    })
    .join("");

  viewEl.innerHTML = `<div class="day-list">${cards}</div><p class="day-footer">${escapeHtml(DAY_FOOTER)}</p>`;
}

function renderWeek() {
  const monday = startOfWeek(selectedDate);
  periodEl.textContent = formatWeekHeading(monday);
  const today = todayISO();
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const iso = addDays(monday, i);
    const items = itemsOn(iso);
    const isToday = iso === today;
    const list =
      items.length === 0
        ? `<div class="week-empty">volno</div>`
        : items
            .map(
              (item) => `
            <div class="week-item">
              <span class="week-time">${escapeHtml(item.time)}</span>
              ${iconHtml(item.type)}
              <span>${escapeHtml(item.name)}</span>
            </div>`
            )
            .join("");
    days.push(`
      <button type="button" class="week-day${isToday ? " is-today" : ""}" data-open-date="${iso}">
        <div class="week-day-label">
          <span>${escapeHtml(weekdayShort(iso))}</span>
          <span>${parseISO(iso).getDate()}.</span>
        </div>
        <div class="week-items">${list}</div>
      </button>`);
  }
  viewEl.innerHTML = `<div class="week-list">${days.join("")}</div>`;
}

function renderMonth() {
  periodEl.textContent = formatMonthHeading(selectedDate);
  const cursor = parseISO(selectedDate);
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const firstIso = formatISO(first);
  const gridStart = startOfWeek(firstIso);
  const today = todayISO();
  const dow = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"]
    .map((label) => `<div class="month-dow">${label}</div>`)
    .join("");

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const iso = addDays(gridStart, i);
    const date = parseISO(iso);
    const outside = date.getMonth() !== cursor.getMonth();
    const items = itemsOn(iso);
    const count = items.length;
    const classes = ["month-cell"];
    if (outside) {
      classes.push("outside");
    }
    if (iso === today) {
      classes.push("is-today");
    }
    if (count > 0) {
      classes.push("has-items");
    }
    let marks = "";
    if (count > 3) {
      marks = `<span class="month-count">${count}</span>`;
    } else if (count > 0) {
      marks = `<span class="dots">${"<span class='dot'></span>".repeat(count)}</span>`;
    }
    cells.push(`
      <button type="button" class="${classes.join(" ")}" data-open-date="${iso}" aria-label="${escapeHtml(formatDayHeading(iso))}">
        <span class="month-num">${date.getDate()}</span>
        ${marks}
      </button>`);
  }
  viewEl.innerHTML = `<div class="month-grid">${dow}${cells.join("")}</div>`;
}

function render() {
  switch (currentView) {
    case "day":
      renderDay();
      break;
    case "week":
      renderWeek();
      break;
    case "month":
      renderMonth();
      break;
    default: {
      const _exhaustive = currentView;
      throw new Error(`Neznámý pohled: ${_exhaustive}`);
    }
  }
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.getAttribute("data-view") === currentView;
    if (active) {
      tab.setAttribute("aria-current", "page");
    } else {
      tab.removeAttribute("aria-current");
    }
  });
  maybeEasterEgg();
}

function setView(mode) {
  currentView = mode;
  render();
}

function openDay(iso) {
  selectedDate = iso;
  currentView = "day";
  render();
}

function shift(direction) {
  switch (currentView) {
    case "day":
      selectedDate = addDays(selectedDate, direction);
      break;
    case "week":
      selectedDate = addDays(selectedDate, direction * 7);
      break;
    case "month":
      selectedDate = addMonths(selectedDate, direction);
      break;
    default: {
      const _exhaustive = currentView;
      throw new Error(`Neznámý pohled: ${_exhaustive}`);
    }
  }
  render();
}

function goToday() {
  selectedDate = clampToDataRange(todayISO());
  render();
}

/* ---------- easter egg ---------- */

function maybeEasterEgg() {
  if (currentView !== "day") {
    return;
  }
  const key = `egg-${selectedDate}`;
  try {
    if (localStorage.getItem(key)) {
      return;
    }
    localStorage.setItem(key, "1");
  } catch {
    return;
  }
  toastEl.hidden = false;
  window.setTimeout(() => {
    toastEl.hidden = true;
  }, 2600);
}

/* ---------- gesta ---------- */

function bindSwipe(element) {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  element.addEventListener(
    "touchstart",
    (event) => {
      const touch = event.changedTouches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    },
    { passive: true }
  );

  element.addEventListener(
    "touchend",
    (event) => {
      if (!tracking) {
        return;
      }
      tracking = false;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      shift(dx < 0 ? 1 : -1);
    },
    { passive: true }
  );
}

/* ---------- start ---------- */

async function init() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(String(response.status));
    }
    procedures = await response.json();
    indexProcedures(procedures);
    selectedDate = clampToDataRange(todayISO());
    render();
    countdownTimer = window.setInterval(() => {
      if (currentView === "day") {
        renderDay();
      }
    }, 30000);
  } catch (error) {
    periodEl.textContent = "";
    viewEl.innerHTML = `<p class="error">Nepodařilo se načíst procedury. Zkontrolujte soubor data/procedures.json.</p>`;
    console.error(error);
  }
}

document.getElementById("btn-prev").addEventListener("click", () => shift(-1));
document.getElementById("btn-next").addEventListener("click", () => shift(1));
document.getElementById("btn-today").addEventListener("click", goToday);

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setView(/** @type {ViewMode} */ (tab.getAttribute("data-view")));
  });
});

viewEl.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open-date]");
  if (!target) {
    return;
  }
  openDay(target.getAttribute("data-open-date"));
});

bindSwipe(viewEl);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      /* offline registrace není nutná k běhu */
    });
  });
}

init();
