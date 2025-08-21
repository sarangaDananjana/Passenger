// static/js/bookedSeat.js
// ──────────────────────────
// This version of renderSeatMap expects each layout to come in as
//   { rows: <number>, columns: <number>, seats: [ { id, row, col }, … ] }
//
// and places each seat exactly at (row, col) in a CSS Grid of size (rows × columns).

import { seatLayouts } from "./seatLayout.js";
import {
  initBuses,
  attachAutocomplete,

  fetchSeatInfo,
  buses,
  input
} from "./sidebar.js";




// ───────────────────────────────────────────────────────────────────
// TAB SWITCHING: show/hide 'Online' vs 'Physical' containers
// ───────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", () => {
  // 1) Grab references to the two tab buttons
  const onlineTabBtn = document.getElementById("online-tab");
  const physicalTabBtn = document.getElementById("physical-tab");
  const seatMapEl = document.getElementById("seat-map");
  const ticketsEl = document.getElementById("ticket-buttons-container");
  const inputEl = document.getElementById("bus-search"); // if you need to set the input value

  // 2) Define your show/hide logic, but only call classList if the element is non-null
  function showOnlineView() {
    if (!onlineTabBtn || !physicalTabBtn) return;

    document.getElementById("online-booking-view").classList.remove("hidden");
    document.getElementById("physical-booking-view").classList.add("hidden");

    onlineTabBtn.classList.add("border-b-2", "border-sky-500", "text-sky-600", "font-semibold");
    physicalTabBtn.classList.remove("border-b-2", "border-sky-500", "text-sky-600", "font-semibold");
    physicalTabBtn.classList.add("text-gray-600");
  }

  function showPhysicalView() {
    if (!onlineTabBtn || !physicalTabBtn) return;

    document.getElementById("online-booking-view").classList.add("hidden");
    document.getElementById("physical-booking-view").classList.remove("hidden");

    physicalTabBtn.classList.add("border-b-2", "border-sky-500", "text-sky-600", "font-semibold");
    onlineTabBtn.classList.remove("border-b-2", "border-sky-500", "text-sky-600", "font-semibold");
    onlineTabBtn.classList.add("text-gray-600");
  }

  // 3) Wire up the tab‐click handlers, but only if the buttons exist
  if (onlineTabBtn && physicalTabBtn) {
    onlineTabBtn.addEventListener("click", async () => {
      showOnlineView();
      const busId = localStorage.getItem("selectedBusId");
      if (busId && seatMapEl) {
        // Only fetch seat‐info if the #seat-map container is present
        await fetchSeatInfo(busId);
      }
    });

    physicalTabBtn.addEventListener("click", async () => {
      showPhysicalView();
      const busId = localStorage.getItem("selectedBusId");
      if (busId && ticketsEl) {
        // Only fetch tickets if #ticket-buttons-container exists
        await fetchTicketDetails(busId);
      }
    });
  }

  // 4) Initialize the sidebar dropdown (bus autocomplete)
  initBuses().then(attachAutocomplete);

  // 5) If a bus was already selected in localStorage, populate the input
  const storedBusId = localStorage.getItem("selectedBusId");
  const storedBusName = localStorage.getItem("selectedBusName");
  if (storedBusName && inputEl) {
    inputEl.value = storedBusName;
  }

  // 6) By default, show the Online pane and immediately load its seat‐map
  showOnlineView();
  if (storedBusId) {
    // If #trip-selector is on this page, build the trip-buttons + detail view:
    if (document.getElementById("trip-selector")) {
      // This will create the row of buttons and auto-click the first one,
      // which in turn calls renderTripDetails(...) for that trip.
      fetchBusTripDetails(storedBusId);
    }
    else if (seatMapEl) {
      // no trip-selector here, fall back to your old logic:
      fetchSeatInfo(storedBusId);
    }
  }
});




export function renderSeatMap(busType, seatsData) {
  // console.log(">>>🟢🟢🟢🟢 renderSeatMap fired with busType =", busType, "seatsData =", seatsData);
  // console.log("--- renderSeatMap start ---");
  // console.log("busType:", busType);
  // console.log("seatsData:", seatsData);

  // 1) Grab the correct layout object for this busType
  const layout = seatLayouts[busType];
  if (!layout) {
    console.error(`No layout found for bus type "${busType}"`);
    return;
  }

  // 2) Find <div id="seat-map"> in the DOM
  const container = document.getElementById("seat-map");
  if (!container) {
    console.error("Could not find #seat-map container in the DOM");
    return;
  }

  // 3) Clear out anything previously rendered
  container.innerHTML = "";

  // 4) Set up CSS Grid: grid-template-rows and grid-template-columns
  //    We want "rows" equally-sized rows, and "columns" equally-sized columns.
  container.style.display = "grid";
  container.style.gridTemplateRows = `repeat(${layout.rows}, 1fr)`;
  container.style.gridTemplateColumns = `repeat(${layout.columns}, minmax(0, 1fr))`;
  // You can adjust “1fr” / “minmax(0,1fr)” if you want fixed heights/widths,
  // or add `gap: 0.25rem;` (Tailwind’s gap-1) in CSS. For example:
  container.style.gap = "0.25rem"; // same as Tailwind's "gap-1"

  // 5) Build a Set of booked seat IDs for quick lookup
  //    seatsData is an array like [ { seat_number: "1", booked: true }, … ]
  const bookedSet = new Set(
    seatsData
      .filter((s) => s.booked)
      .map((s) => String(s.seat_number))
  );
  console.log("🟢🟢🟢 bookedSet:", bookedSet);


  // 6) Loop through each seat in layout.seats (an array of seat-objects)
  layout.seats.forEach((seatInfo, idx) => {
    // `idx` is 0-based, so seat # = idx + 1
    const seatIndexNumber = String(idx + 1);

    // Check if this array position is booked
    const isBooked = bookedSet.has(seatIndexNumber);

    const seatDiv = document.createElement("div");
    seatDiv.textContent = seatInfo.id;               // e.g. "1A", "1B", etc.
    seatDiv.dataset.seatNumber = seatInfo.id;


    seatDiv.className = [
      "w-10 h-10 flex items-center justify-center rounded cursor-pointer",
      isBooked
        ? "bg-red-500 text-white"
        : "bg-white border border-gray-300"
    ].join(" ");

    seatDiv.style.gridRow = seatInfo.row;
    seatDiv.style.gridColumn = seatInfo.col;
    container.appendChild(seatDiv);

    container.appendChild(seatDiv);

    console.log(
      `Placed seat ${seatInfo.id} at (row ${seatInfo.row}, col ${seatInfo.col}) – ${isBooked ? "BOOKED" : "available"
      }`
    );
  });

  console.log("--- renderSeatMap end ---");
}

async function loadManageBusTripsData() {
  //  console.log(">>>🟢🟢🟢🟢 renderSeatMap fired with busType =", busType, "seatsData =", seatsData);
  // …fetch /bus-owners/bus-list/ and render your list of trips…
}

(async function initAll() {
  // 1) initialize the shared sidebar
  await initBuses();
  attachAutocomplete();

  // 2) rehydrate the last-picked bus and render its detail panel
  const stored = localStorage.getItem("selectedBusId");
  console.log("[manageBusTrips] storedBusId =", stored);
  if (stored && buses.length && document.getElementById("seat-map")) {
    input.value = buses.find(b => b.id === stored)?.name || "";
    await fetchSeatInfo(stored);
  } else {
    console.debug("[manageBusTrips] skipping fetchSeatInfo; no #seat-map in DOM");
  }


  // 3) now load THIS page’s list of all trips
  await loadManageBusTripsData();
})();
