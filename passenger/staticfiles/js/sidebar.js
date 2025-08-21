// static/js/sidebar.js
import { fetchWithAuth } from "./auth.js";
import { renderSeatMap } from "./bookedSeat.js";

console.log("🟢 sidebar.js loaded");      // in sidebar.js
console.log("🟢 bookedSeat.js loaded");    // in bookedSeat.js


// export these so other scripts can import them
export let buses = [];
export const input = document.getElementById("bus-search");
const suggestions = document.getElementById("suggestions");
const tripSelector = document.getElementById("trip-selector");




export async function initBuses() {
  console.log("[sidebar] initBuses");
  try {
    const res = await fetchWithAuth("/bus-owners/owner-details/");
    if (!res.ok) throw new Error("Owner-details error " + res.status);
    const data = await res.json();
    buses = (data.buses || []).map(b => ({
      id: b.bus_id.$oid || b.bus_id,
      name: b.bus_name
    }));
    console.log("[sidebar] loaded", buses.length, "buses");
  } catch (err) {
    console.error("[sidebar] initBuses error:", err);
  }
}

export function attachAutocomplete() {
  console.log("[sidebar] 🟢 attachAutocomplete");
  input.addEventListener("input", () => {
    const val = input.value.trim().toLowerCase();
    suggestions.innerHTML = "";
    if (!val) return suggestions.classList.add("hidden");
    const matches = buses.filter(b => b.name.toLowerCase().includes(val));
    if (!matches.length) return suggestions.classList.add("hidden");
    matches.forEach(b => {
      const li = document.createElement("li");
      li.textContent = b.name;
      li.dataset.busId = b.id;
      li.className = "px-3 py-1 hover:bg-gray-200 cursor-pointer";
      suggestions.appendChild(li);
    });
    suggestions.classList.remove("hidden");
  });

  suggestions.addEventListener("click", e => {
    if (e.target.tagName === "LI") {
      const busId = e.target.dataset.busId;
      const busName = e.target.textContent;

      input.value = busName;


      input.value = e.target.textContent;
      suggestions.classList.add("hidden");

      localStorage.setItem("selectedBusId", busId);
      localStorage.setItem("selectedBusName", busName);

      console.log("[sidebar] 🟢 selected busN ame:", busName);
      console.log("[sidebar] 🟢 selected busId:", busId);

      fetchSeatInfo(busId);
      fetchBusTripDetails(busId);
      fetchTicketDetails(busId);
      fetchBusDetails(busId);

    }
  });
}

function buildTripSelector(trips) {
  tripSelector.innerHTML = "";

  trips.forEach((trip, index) => {
    let raw = trip.trip_start_time;
    if (raw.includes("T") && raw.length === 15) {
      const [datePart, timePart] = raw.split("T");
      raw = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T` +
        `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
    }
    const dateObj = new Date(raw);
    const label = isNaN(dateObj.getTime())
      ? "Invalid Date"
      : dateObj.toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className =
      "px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-100";
    btn.textContent = label;

    btn.addEventListener("click", () => {
      // Un‐highlight all buttons, then highlight this one:
      document
        .querySelectorAll("#trip-selector button")
        .forEach(el => el.classList.remove("bg-sky-200"));
      btn.classList.add("bg-sky-200");

      const headingEl = document.getElementById("bus-heading");
      if (headingEl) headingEl.textContent = trip.bus_name || "-";

      renderTripDetails(trip);
    });

    tripSelector.appendChild(btn);

    // Auto‐click the very first trip
    if (index === 0) {
      btn.click();
    }
  });
}



function renderTripDetails(trip) {

  const busType = trip.seat_type || trip.bus_type;  // Use the correct property name

  // Seats data must include seat_number and booked flag, e.g.
  // [{ seat_number: "1", booked: true }, { seat_number: "2", booked: false }, ...]
  const seatsData = trip.seats || [];
  // 1) Earnings (full bus revenue = booked_revenue + tickets_revenue):

  const fullRevEl = document.getElementById("full-bus-revenue");
  if (fullRevEl) {
    const full = Number(trip.booked_revenue || 0) + Number(trip.tickets_revenue || 0);
    fullRevEl.textContent = `$${full.toFixed(2)}`;
  }


  const seatMapEl = document.getElementById("seat-map");
  if (seatMapEl && trip.seat_type && Array.isArray(trip.seats)) {
    renderSeatMap(trip.seat_type, trip.seats);
  }

  // 2) Summary cards:
  const ticketCountEl = document.getElementById("number-of-tickets");
  if (ticketCountEl) ticketCountEl.textContent = trip.number_of_tickets ?? "0";

  const onlineRevEl = document.getElementById("booked-revenue");
  if (onlineRevEl) onlineRevEl.textContent = `$${Number(trip.booked_revenue || 0).toFixed(2)}`;

  const offlineRevEl = document.getElementById("tickets-revenue");
  if (offlineRevEl) offlineRevEl.textContent = `$${Number(trip.tickets_revenue || 0).toFixed(2)}`;

  const devCutEl = document.getElementById("company-cut");
  if (devCutEl) devCutEl.textContent = `$${Number(trip.company_3_percent_cut || 0).toFixed(2)}`;

  const cleanRevEl = document.getElementById("clean-revenue");
  if (cleanRevEl) {
    const clean =
      Number(trip.booked_revenue || 0) +
      Number(trip.tickets_revenue || 0) -
      Number(trip.company_3_percent_cut || 0);
    cleanRevEl.textContent = `$${clean.toFixed(2)}`;
  }

  // 3) Right-panel fields:
  const busNameEl = document.getElementById("bus-name");
  if (busNameEl) busNameEl.textContent = trip.bus_name || "-";

  const routeEl = document.getElementById("bus-route");
  if (routeEl) routeEl.textContent = trip.route_name || "-";

  // Format the start time again:
  let raw = trip.trip_start_time;
  if (raw.includes("T") && raw.length === 15) {
    const [datePart, timePart] = raw.split("T");
    raw = `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}T` +
      `${timePart.slice(0, 2)}:${timePart.slice(2, 4)}:${timePart.slice(4, 6)}`;
  }
  const parsed = new Date(raw);
  const displayStart = isNaN(parsed.getTime())
    ? "Invalid Date"
    : parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });





  const startEl = document.getElementById("trip-start-time");
  if (startEl) startEl.textContent = displayStart;

  const onlineBookedEl = document.getElementById("online-booked");
  if (onlineBookedEl) onlineBookedEl.textContent = trip.booked_seats ?? "0";

  const offlineBookedEl = document.getElementById("offline-booked");
  if (offlineBookedEl) offlineBookedEl.textContent = trip.number_of_tickets ?? "0";

  const typeEl = document.getElementById("bus-type");
  if (typeEl) typeEl.textContent = trip.bus_type || "-";
  const tickets = Array.isArray(trip.tickets) ? trip.tickets : [];
  const container = document.getElementById("ticket-buttons-container");
  const countEl = document.getElementById("physical-ticket-count");
  if (countEl) {
    countEl.textContent = tickets.length;
  }
  if (container) {
    container.innerHTML = ""; // clear old buttons
    tickets.forEach((tk) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "px-5 py-3 bg-blue-400 border border-gray-300 rounded-xl text-sm flex items-center space-x-1 hover:bg-gray-50";

      const from = document.createElement("span");
      from.textContent = tk.start_point;
      from.className = "font-medium text-white text-md";

      const arrow = document.createElement("span");
      arrow.textContent = "→";
      arrow.className = "mx-1 text-white";

      const to = document.createElement("span");
      to.textContent = tk.end_point;
      to.className = "font-medium text-white text-md";

      // show “(HH:mm)” from tk.ticket_date_time:
      const timeSpan = document.createElement("span");
      try {
        const dt = new Date(tk.ticket_date_time);
        if (!isNaN(dt.getTime())) {
          const hh = dt.getHours().toString().padStart(2, "0");
          const mm = dt.getMinutes().toString().padStart(2, "0");
          timeSpan.textContent = `(${hh}:${mm})`;
          timeSpan.className = "ml-1 text-s text-white";
        }
      } catch (e) {
        // ignore
      }

      btn.append(from, arrow, to, timeSpan);
      container.appendChild(btn);
    });
  }
  renderSeatMap(busType, seatsData);
}







export async function fetchSeatInfo(busId) {
  console.log("[sidebar] ▶ 🟢🟢🟢🟢 fetchSeatInfo(", busId, ") called");

  try {
    const res = await fetchWithAuth(
      `/bus-owners/bus-trip-details/?bus_id=${encodeURIComponent(busId)}`
    );

    if (!res.ok) {
      console.error("[sidebar] ✖ fetchSeatInfo error: status", res.status);
      throw new Error("status " + res.status);
    }

    const data = await res.json();
    console.log("[sidebar] ✅ fetchSeatInfo raw data:", data);

    // Extract seat_type
    const busType = data.bus?.seat_type;
    if (!busType) {
      console.warn("[sidebar] ⚠️ fetchSeatInfo: no seat_type in data.bus");
    } else {
      console.log("[sidebar] ℹ️ fetchSeatInfo busType →", busType);
    }

    // Extract seats array
    const seatsData =
      Array.isArray(data.trips) && Array.isArray(data.trips[0]?.seats)
        ? data.trips[0].seats
        : [];
    console.log(
      "[sidebar] ℹ️ fetchSeatInfo seatsData length →",
      seatsData.length
    );

    const seatMapEl = document.getElementById("seat-map");
    if (seatMapEl) {
      renderSeatMap(busType, seatsData);
    } else {
      // (Optional) Console‐debug instead of error:
      console.debug("[sidebar] Skipping renderSeatMap; no #seat-map in DOM.");
    }

    // Now invoke renderSeatMap with just busType and seatsData

  } catch (err) {
    console.error("[sidebar] ✖ fetchSeatInfo caught error:", err);
  }
}

export async function fetchTicketDetails(busId) {
  console.log(`[sidebar] ▶ fetchTicketDetails(${busId}) called`);
  try {
    const res = await fetchWithAuth(
      `/bus-owners/bus-trip-details/?bus_id=${encodeURIComponent(busId)}`
    );
    if (!res.ok) {
      console.error(`[sidebar] ✖ fetchTicketDetails error: status`, res.status);
      throw new Error("status " + res.status);
    }

    const data = await res.json();
    console.log("[sidebar] ✅ fetchTicketDetails raw data:", data);

    // Find the first trip (if your API returns multiple, pick whichever index you need).
    const trip = Array.isArray(data.trips) ? data.trips[0] : null;
    if (!trip) {
      console.warn("[sidebar] ⚠️ No trip data found for busId", busId);
      return;
    }

    // The API’s response (per your screenshot) shows:
    //   trip.tickets is an array of objects like
    //     { ticket_date_time, start_point, end_point, … }
    // If you store tickets under a different key, adjust accordingly:
    const tickets = Array.isArray(trip.tickets) ? trip.tickets : [];

    // Show total count
    const countEl = document.getElementById("physical-ticket-count");
    if (countEl) {
      countEl.textContent = tickets.length;
    }

    // Get the container where we inject <button> elements
    const container = document.getElementById("ticket-buttons-container");
    if (!container) {
      console.error("[sidebar] ✖ Could not find #ticket-buttons-container in DOM");
      return;
    }

    // Clear out any old buttons
    container.innerHTML = "";

    // Loop through tickets array, create one button per ticket
    tickets.forEach((tk, idx) => {
      // Example tk object (from your screenshot) looks like:
      //   {
      //     ticket_date_time: "2025-05-28T10:42:29.466000",
      //     start_point: "Kandana",
      //     end_point: "Udahamulla",
      //     …other fields…
      //   }

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "px-5 py-3 bg-blue-400 border border-gray-300 rounded-xl text-sm flex items-center space-x-1 hover:bg-gray-50";

      // You can customize what each button shows; e.g. “Kandana → Udahamulla (10:42)”
      const from = document.createElement("span");
      from.textContent = tk.start_point;
      from.className = "font-medium text-white text-md";

      const arrow = document.createElement("span");
      arrow.textContent = "→";
      arrow.className = "mx-1 text-white";

      const to = document.createElement("span");
      to.textContent = tk.end_point;
      to.className = "font-medium text-white text-md";

      // Optionally, show the time (HH:mm) from ticket_date_time
      const timeSpan = document.createElement("span");
      try {
        const dt = new Date(tk.ticket_date_time);
        if (!isNaN(dt.getTime())) {
          const hh = dt.getHours().toString().padStart(2, "0");
          const mm = dt.getMinutes().toString().padStart(2, "0");
          timeSpan.textContent = `(${hh}:${mm})`;
          timeSpan.className = "ml-1 text-s text-white";
        }
      } catch (e) {
        // ignore parsing failure
      }

      btn.append(from, arrow, to, timeSpan);

      // If you want each button to do something on click, you can:
      // btn.addEventListener("click", () => {
      //   // e.g. open a detail modal, or let them mark the ticket as “used,” etc.
      //   console.log("Clicked ticket", idx, tk);
      // });

      container.appendChild(btn);
    });
  } catch (err) {
    console.error("[sidebar] ✖ fetchTicketDetails caught error:", err);
  }
}



export async function fetchBusDetails(busId) {
  console.log(`[sidebar] fetchBusDetails(${busId})`);
  try {
    // Make the GET request to the updated API endpoint
    const url = `https://www.passenger.lk/bus-owners/get-bus/?bus_id=${encodeURIComponent(busId)}`;
    console.log(`[sidebar] GET Request URL: ${url}`);




    // Make the GET request to the updated API endpoint
    const res = await fetchWithAuth(url);

    console.log("🟢 API Response:", res);
    // Check for successful response
    if (!res.ok) throw new Error("status " + res.status);

    const data = await res.json();
    console.log("🟢 Data received from API:", data);

    const { bus } = data;  // Assuming your API returns { bus: { ... } }

    // Update the UI with the bus details


    const nameEl = document.getElementById("bus-name");
    if (nameEl) nameEl.textContent = data.bus_name;

    const busNumberEl = document.getElementById("bus-number");
    if (busNumberEl) busNumberEl.textContent = data.bus_number;

    const statusEl = document.getElementById("status");
    if (statusEl) statusEl.textContent = data.is_approved ? "Approved" : "Pending";

    const routePermitNumberEl = document.getElementById("route-permit-number");
    if (routePermitNumberEl) routePermitNumberEl.textContent = data.route_permit_number;

    const seatTypeEl = document.getElementById("seat-type");
    if (seatTypeEl) seatTypeEl.textContent = data.seat_type;

    const busTypeEl = document.getElementById("bus-type");
    if (busTypeEl) busTypeEl.textContent = data.bus_type;

    // Additional fields can be added as necessary
    const machineEl = document.getElementById("machine");
    if (machineEl) {
      machineEl.checked = data.machine; // Display 'Yes' or 'No' based on the value of bus.machine
    }

    const machineConnectedEl = document.getElementById("machine-connected");
    if (machineConnectedEl) {
      machineConnectedEl.checked = data.is_machine_connected; // Display 'Yes' or 'No' based on bus.is_machine_connected
    }


  } catch (err) {
    console.error("[sidebar] fetchBusDetails error:", err);
  }
}

export async function fetchBusTripDetails(busId) {
  console.log(`[sidebar] ▶ fetchBusTripDetails(${busId}) called`);
  try {
    const res = await fetchWithAuth(
      `/bus-owners/bus-trip-details/?bus_id=${encodeURIComponent(busId)}`
    );
    if (!res.ok) {
      console.error(`[sidebar] 🚨 fetch error: status ${res.status}`);
      throw new Error("status " + res.status);
    }

    const data = await res.json();
    console.log("[sidebar] ✅ Raw data received:", data);

    // Always pull out the trips array:
    const trips = Array.isArray(data.trips) ? data.trips : [];

    // If the dashboard “trip-selector” exists, build the button‐bar and let
    // renderTripDetails(trip) drive everything from there:
    if (tripSelector) {
      if (!trips.length) {
        tripSelector.innerHTML =
          "<p class='text-sm text-gray-500'>No trips available</p>";
        return;
      }
      buildTripSelector(trips);
      return; // stop here, since renderTripDetails() will fill the UI
    }

    // —————— Otherwise (no #trip-selector on this page) ——————
    // fall back to your original inline rendering logic.
    // e.g., pick the first trip and populate all fields immediately:

    // (1) grab the “first” trip object
    const trip = trips[0] || {};
    // (2) update your heading and right‐panel spans:
    const headingEl = document.getElementById("bus-heading");
    if (headingEl) headingEl.textContent = trip.bus_name;

    const nameEl = document.getElementById("bus-name");
    if (nameEl) nameEl.textContent = trip.bus_name;

    const routeEl = document.getElementById("bus-route");
    if (routeEl) routeEl.textContent = trip.route_name;

    const startTimeEl = document.getElementById("trip-start-time");
    if (startTimeEl) startTimeEl.textContent = trip.trip_start_time;

    const onlineBookedE1 = document.getElementById("online-booked");
    if (onlineBookedE1) onlineBookedE1.textContent = trip.booked_seats;

    const offlineBookedE1 = document.getElementById("offline-booked");
    if (offlineBookedE1) offlineBookedE1.textContent = trip.number_of_tickets;

    const ticketNumberEl = document.getElementById("number-of-tickets");
    if (ticketNumberEl) ticketNumberEl.textContent = trip.number_of_tickets;

    const companyCutEl = document.getElementById("company-cut");
    if (companyCutEl) companyCutEl.textContent = trip.company_3_percent_cut;

    const bookedRevenueEl = document.getElementById("booked-revenue");
    if (bookedRevenueEl) bookedRevenueEl.textContent = trip.booked_revenue;

    const bookedSeatsEl = document.getElementById("booked-seats");
    if (bookedSeatsEl) bookedSeatsEl.textContent = trip.booked_seats;

    const ticketRevenueEl = document.getElementById("tickets-revenue");
    if (ticketRevenueEl) ticketRevenueEl.textContent = trip.tickets_revenue;

    const butTypeEl = document.getElementById("bus-type");
    if (butTypeEl) {
      butTypeEl.textContent = trip.bus_type || "(undefined)";
    }

    const cleanRevenue =
      Number(trip.booked_revenue || 0) +
      Number(trip.tickets_revenue || 0) -
      Number(trip.company_3_percent_cut || 0);

    const cleanEl = document.getElementById("clean-revenue");
    if (cleanEl) {
      cleanEl.textContent = `$${cleanRevenue.toFixed(2)}`;
    }

    const fullBusRevenue =
      Number(trip.booked_revenue || 0) + Number(trip.tickets_revenue || 0);

    const fullEl = document.getElementById("full-bus-revenue");
    if (fullEl) {
      fullEl.textContent = `$${fullBusRevenue.toFixed(2)}`;
    }

    // (3) If you also want the “trip-cards” template section on non-dashboard pages,
    // you can keep your existing data.trips.forEach(...) here. Otherwise just return.

    // Example:
    const container = document.getElementById("trip-cards");
    if (container) {
      container.innerHTML = "";
      const tpl = document.getElementById("trip-card-template");
      if (tpl) {
        trips.forEach((trip) => {
          const clone = tpl.content.cloneNode(true);
          clone.querySelector(".trip-name").textContent = trip.bus_name;
          clone.querySelector(".trip-route").textContent = trip.route_name;
          clone.querySelector(".trip-online-booked").textContent = trip.booked_seats;
          clone.querySelector(".trip-offline-booked").textContent = trip.number_of_tickets;
          clone.querySelector(".trip-tickets-rev").textContent = `$${trip.tickets_revenue}`;
          clone.querySelector(".trip-company-cut").textContent = `$${trip.company_3_percent_cut}`;

          let raw = trip.trip_start_time;
          if (raw.includes("T") && raw.length === 15) {
            const [datePart, timePart] = raw.split("T");
            raw =
              datePart.slice(0, 4) +
              "-" +
              datePart.slice(4, 6) +
              "-" +
              datePart.slice(6, 8) +
              "T" +
              timePart.slice(0, 2) +
              ":" +
              timePart.slice(2, 4) +
              ":" +
              timePart.slice(4, 6);
          }

          const parsed = new Date(raw);
          const display = isNaN(parsed.getTime())
            ? "Invalid Date"
            : parsed.toLocaleString();
          clone.querySelector(".trip-start-time").textContent = display;

          const statusEl = clone.querySelector(".trip-status");
          if (trip.is_bus_trip_cancelled) {
            statusEl.textContent = "Cancelled";
            statusEl.classList.replace("text-green-500", "text-red-500");
          } else {
            statusEl.textContent = "Completed";
          }

          container.appendChild(clone);
        });
      }
    }
    // End of “non-dashboard” path.

  } catch (err) {
    console.error("[sidebar] 🚨 fetchBusTripDetails error:", err);
  }
}




// Optional: any other protected data fetch
async function loadDashboardData() {
  //console.log("[dashboard] loadDashboardData running");
  try {
    const res = await fetchWithAuth("/bus-owners/owner-details/");
    if (!res.ok) {
      //console.error("[dashboard] owner-details error:", res.status);
      return;
    }
    const data = await res.json();
    // console.log("[dashboard] data:", data);
    // …render earnings cards, summary cards, right-panel…
  } catch (err) {
    // console.error("[dashboard] load error:", err);
  }
}
// one initAll to wire up your sidebar on every page—you can leave it here:
(async function initAll() {
  await initBuses();
  attachAutocomplete();

  const stored = localStorage.getItem("selectedBusId");
  if (stored && buses.length) {
    const match = buses.find(b => b.id === stored);
    if (match) {
      input.value = match.name;
      //console.log("[sidebar] re-fetching for", stored, match.name);
      await fetchBusTripDetails(stored);
      await fetchTicketDetails(stored);
    }
  }
  await loadDashboardData();
})();
