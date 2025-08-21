import { fetchWithAuth } from "./auth.js";
import {
  initBuses,
  attachAutocomplete,
  fetchBusTripDetails,
  buses,
  input
} from "./sidebar.js";

// your page-specific loader
async function loadManageBusTripsData() {
  console.log("[manageBusTrips] loading trips list…");
  // …fetch /bus-owners/bus-list/ and render your list of trips…
}

(async function initAll() {
  // 1) initialize the shared sidebar
  await initBuses();
  attachAutocomplete();

  // 2) rehydrate the last-picked bus and render its detail panel
  const stored = localStorage.getItem("selectedBusId");
  console.log("[manageBusTrips] storedBusId =", stored);
  if (stored && buses.length) {
    input.value = buses.find(b => b.id === stored)?.name || "";
    await fetchBusTripDetails(stored);
  }

  // 3) now load THIS page’s list of all trips
  await loadManageBusTripsData();
})();



// 1) ROUTE autocomplete

const routeInput = document.getElementById("route-search");
const routeSuggestList = document.getElementById("route-suggestions");
const hiddenRouteId = document.getElementById("route-id-input");
const hiddenRouteName = document.getElementById("route-name-input");

// helper to clear suggestions
function clearRouteSuggestions() {
  routeSuggestList.innerHTML = "";
  routeSuggestList.classList.add("hidden");
  hiddenRouteId.value = "";
  hiddenRouteName.value = "";
}

// when user types, fetch matching routes
routeInput.addEventListener("input", async () => {
  const q = routeInput.value.trim();
  if (!q) return clearRouteSuggestions();

  try {
    const res = await fetchWithAuth(
      `/core/routes/?route_name=${encodeURIComponent(q)}`
    );
    if (!res.ok) throw new Error(res.statusText);
    const routes = await res.json(); // expect an array of { route_id, route_name }
    routeSuggestList.innerHTML = "";

    if (!routes.length) {
      routeSuggestList.classList.add("hidden");
      return;
    }

    routes.forEach(r => {
      const li = document.createElement("li");
      li.textContent = r.route_name;
      li.dataset.routeId = r.route_id;
      li.dataset.routeName = r.route_name;
      li.className = "px-3 py-1 hover:bg-gray-200 cursor-pointer";
      routeSuggestList.appendChild(li);
    });

    routeSuggestList.classList.remove("hidden");
  } catch (err) {
    console.error("Route autocomplete error:", err);
    clearRouteSuggestions();
  }
});

// when they click one suggestion…
routeSuggestList.addEventListener("click", e => {
  if (e.target.tagName !== "LI") return;
  const selId = e.target.dataset.routeId;
  const selName = e.target.dataset.routeName;
  routeInput.value = selName;
  hiddenRouteId.value = selId;
  hiddenRouteName.value = selName;
  routeSuggestList.classList.add("hidden");
});

// if they blur without choosing, clear
routeInput.addEventListener("blur", () => {
  setTimeout(() => {
    if (!hiddenRouteId.value) {
      // invalid or no selection
      clearRouteSuggestions();
      routeInput.value = "";
    }
  }, 200);
});


// grab modal elements
const openBtn = document.getElementById("openAddTripBtn");
const modal = document.getElementById("addTripModal");
const cancelBtn = document.getElementById("cancelAddTrip");
const form = document.getElementById("addTripForm");

// show the modal
openBtn.addEventListener("click", () => {
  // only allow if a bus is selected
  const busId = localStorage.getItem("selectedBusId");
  if (!busId) {
    return alert("Please pick a bus from the sidebar first.");
  }
  modal.classList.remove("hidden");
});

// hide the modal
cancelBtn.addEventListener("click", () => {
  form.reset();
  modal.classList.add("hidden");
});




// handle form submission
// … keep your modal open/close code above …

form.addEventListener("submit", async e => {
  e.preventDefault();

  if (!hiddenRouteId.value) {
    return alert("Please pick a route from the list.");
  }


  // 1) get the busId that you’ve already stored
  const busId = localStorage.getItem("selectedBusId");
  const match = buses.find(b => b.id === busId);
  const busName = match ? match.name : "";

  if (!busId) {
    return alert("Pick a bus before creating a trip.");
  }

  // 2) pull *all* inputs from the form, including bus_name & bus_number
  const data = Object.fromEntries(new FormData(form).entries());
  // data now has: { route_id, route_name, bus_name, bus_number, trip_start_time, number_of_seats }

  // 3) build payload
  const payload = {
    route_id: hiddenRouteId.value,    // ← use the hidden input
    route_name: hiddenRouteName.value,
    bus_id: busId,
    bus_name: busName,
    bus_number: data.bus_number,
    trip_start_time: data.trip_start_time,
    number_of_seats: Number(data.number_of_seats),
    booking_price: Number(data.booking_price)
  };
  console.log("[manageBusTrips] 🟢 POST payload:", payload);
  console.log("[manageBusTrips] 🟢Creating trip for bus", busId, payload);

  try {
    const res = await fetchWithAuth(
      "/core/bus-trip/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Status ${res.status}: ${errText}`);
    }

    const newTrip = await res.json();
    console.log("[manageBusTrips] Trip created:", newTrip);

    // 4) re-fetch the details & trip-list for that bus
    await fetchBusTripDetails(busId);
    await loadManageBusTripsData();

    // 5) close & reset
    modal.classList.add("hidden");
    form.reset();
  } catch (err) {
    console.error("[manageBusTrips] Failed to create trip:", err);
    alert("Error creating trip: " + err.message);
  }
});
