import { authFetch, baseUrl } from './auth.js';

// Grab cookies
const panel = document.querySelector('.details-panel');
// Once on DOM load, fetch owner→render bus buttons
document.addEventListener('DOMContentLoaded', () => {
  loadOwnerDetails();
});
// Track currently selected bus for toggle API calls
let currentBusId = null;
let currentTripId = null;



// Darabase Functions *********************************************************************************************************************************************************

function saveTripsToDB(trips, cb) {
  const req = indexedDB.open('busApp', 1);
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('trips')) {
      db.createObjectStore('trips', { keyPath: '_id' });
    }
  };
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('trips', 'readwrite');
    const store = tx.objectStore('trips');
    trips.forEach(t => store.put(t));
    tx.oncomplete = cb;
  };
}

function clearIndexedDB() {
  const req = indexedDB.open('busApp', 1);

  // Make sure the 'trips' store exists
  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('trips')) {
      db.createObjectStore('trips', { keyPath: '_id' });
    }
  };

  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('trips', 'readwrite');
    tx.objectStore('trips').clear();
    tx.oncomplete = () => {
      console.log('All trips cleared.');
    };
    tx.onerror = err => {
      console.error('Failed to clear trips:', err.target.error);
    };
  };

  req.onerror = e => {
    console.error('Failed to open DB in clearIndexedDB():', e.target.error);
  };
}


function openBusAppDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('busApp', 1);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('trips')) {
        db.createObjectStore('trips', { keyPath: '_id' });
      }
    };

    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}




// 1) Load and render the bus list
async function loadOwnerDetails() {
  const busContentWrapper = document.getElementById('bus-content-wrapper');
  const noBusesPlaceholder = document.getElementById('noBusesPlaceholder');

  try {
    const res = await authFetch(`${baseUrl}/bus-owners/owner-details/`);
    // Add this check: If authFetch redirected, 'res' will be undefined. Stop execution.
    if (!res) return;

    const data = await res.json();

    // Sidebar
    const el = document.getElementById('companyName');
    if (el) el.textContent = data.company_name;

    // **NEW**: Check if there are any buses. If not, show placeholder and stop.
    if (!data.buses || data.buses.length === 0) {
      console.log('No buses found for this owner.');
      if (busContentWrapper) busContentWrapper.classList.add('hidden');
      if (noBusesPlaceholder) noBusesPlaceholder.classList.remove('hidden');
      return;
    }

    // If buses exist, ensure the main content is visible
    if (busContentWrapper) busContentWrapper.classList.remove('hidden');
    if (noBusesPlaceholder) noBusesPlaceholder.classList.add('hidden');

    // Bus buttons
    const busContainer = document.getElementById('busSelection');
    if (busContainer) {
      busContainer.innerHTML = '';

      data.buses.forEach((bus, idx) => {
        const btn = document.createElement('button');
        btn.className = 'bus-button';

        btn.innerHTML = `
         <span class="label">${bus.bus_name}</span>
         <span class="code">${bus.bus_number}</span>
       `;
        btn.dataset.busId = bus.bus_id;

        // make the first one “selected” by default
        if (idx === 0) btn.classList.add('selected');

        btn.addEventListener('click', async () => {
          // toggle the selected class
          document.querySelectorAll('.bus-button')
            .forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');

          // now fetch the new bus’s trips
          await switchBus(bus.bus_id);
        });

        busContainer.appendChild(btn);
      });
    } else {
      console.warn('`#busSelection` not found — skipping bus button render');
    }


    // Auto-load first bus if present
    if (data.buses[0]) {
      await switchBus(data.buses[0].bus_id);
    }
  } catch (err) {
    console.error('Error loading owner details', err);
    // Optionally show an error message to the user
    if (busContentWrapper) busContentWrapper.classList.add('hidden');
    if (noBusesPlaceholder) {
      noBusesPlaceholder.classList.remove('hidden');
      noBusesPlaceholder.querySelector('h1').textContent = 'Error Loading Data';
      noBusesPlaceholder.querySelector('p').textContent = 'Could not fetch your details. Please try again later.';
    }
  }
}

// 2) Handle bus switch: clear DB, wait 5s, fetch trips, store + render
async function switchBus(busId) {
  currentBusId = busId;

  // 1) grab UI elements
  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const progressBar = document.getElementById('progressBar');
  const detailsSection = document.getElementById('tripDetailsSection');
  const noTripsPlaceholder = document.getElementById('noTripsPlaceholder');

  // 2) reset visibility: show overlay & details, hide placeholder
  overlay.classList.remove('hidden');
  detailsSection.classList.remove('hidden');
  noTripsPlaceholder.classList.add('hidden');

  // reset spinner bar & text
  progressBar.style.width = '0%';
  loadingText.textContent = 'Fetching Your Data';

  // 3) clear old content & IndexedDB
  detailsSection.querySelector('#tripSelection').innerHTML = '';
  clearIndexedDB();

  // 4) fetch + timer in parallel
  const totalDuration = 2000;
  const timerPromise = new Promise(r => setTimeout(r, totalDuration));
  panel.classList.remove('open');

  const fetchPromise = authFetch(
    `${baseUrl}/bus-owners/bus-trip-details/?bus_id=${busId}`
  ).then(res => {
    // Add this check: If authFetch redirected, stop the promise chain.
    if (!res) return;

    return res.json();
  });

  // 5) animate spinner text & bar
  const messages = [
    'Fetching Your Data',
    'Collecting all the bus trips',
    'Mapping the graphs',
    'Calculating revenues'
  ];
  const interval = totalDuration / messages.length;
  messages.forEach((msg, i) => {
    setTimeout(() => { loadingText.textContent = msg; }, i * interval);
  });

  let startTime = null;
  function animate(time) {
    if (!startTime) startTime = time;
    const pct = Math.min((time - startTime) / totalDuration * 100, 100);
    progressBar.style.width = pct + '%';
    if (time - startTime < totalDuration) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);

  // 6) wait for both to finish
  let bus, trips;
  try {
    ({ bus, trips } = await Promise.all([timerPromise, fetchPromise])
      .then(([, data]) => data));
  } catch (err) {
    console.error('Fetch failed', err);
    overlay.classList.add('hidden');
    return;
  }
  window.currentBusData = bus;

  // 7) hide overlay
  overlay.classList.add('hidden');

  // 8) if no trips: show placeholder, hide details
  if (!Array.isArray(trips) || trips.length === 0) {
    detailsSection.classList.add('hidden');
    noTripsPlaceholder.classList.remove('hidden');
    return;
  }

  // 9) normal flow: save to DB and render into detailsSection
  saveTripsToDB(trips, () => {
    const toggle = document.getElementById('machineToggle');
    toggle.checked = !!bus.machine;
    toggle.onchange = () => toggleMachine(busId, toggle.checked);

    renderTripButtons(trips);
    if (trips[0]) selectTrip(trips[0]);
    getBookingsInfo(trips[0])

    renderRevenueChart(trips);
  });
  return { bus, trips };
}







// Render trip buttons
function renderTripButtons(trips) {
  const container = document.getElementById('tripSelection');
  container.innerHTML = '';

  trips.forEach(trip => {
    const d = new Date(
      new Date(trip.trip_start_time).getTime()
      + 5.5 * 60 * 60 * 1000
    );
    const options = { timeZone: 'Asia/Colombo' };

    // Get individual parts using the correct timezone
    const day = parseInt(d.toLocaleDateString('en-US', { ...options, day: 'numeric' }));
    const weekday = d.toLocaleDateString('en-US', { ...options, weekday: 'long' });
    const time = d.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });

    // Improved logic for date suffix (st, nd, rd, th)
    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    if (day % 10 === 2 && day !== 12) suffix = 'nd';
    if (day % 10 === 3 && day !== 13) suffix = 'rd';

    const label = `${day}${suffix} ${weekday} ${time}`;

    const btn = document.createElement('button');
    btn.className = 'date-button';
    btn.textContent = label;
    btn.dataset.tripId = trip._id;
    panel.classList.remove('closed');
    panel.classList.add('open');

    btn.addEventListener('click', () => {
      // remove active from all
      container.querySelectorAll('.date-button').forEach(b => b.classList.remove('active'));

      // mark this one
      btn.classList.add('active');
      // call your existing handler
      panel.classList.remove('open');

      // 3) After the CSS transition (300ms), update and slide back in
      setTimeout(() => {
        selectTrip(trip);
        getBookingsInfo(trip)     // refill the panel’s content
        panel.classList.add('open');
      }, 300);
    });

    container.appendChild(btn);
  });
}

function getTicketsInfo(trip) {
  const offlineBtn = document.getElementById('offlineSection');
  const offlineModal = document.getElementById('offlineModal');
  const offlineCloseBtn = document.getElementById('offlineClose');
  const listContainer = document.getElementById('offlineTicketList');

  if (!offlineBtn || !offlineModal || !offlineCloseBtn || !listContainer) {
    console.error('Missing required DOM elements for offline tickets');
    return;
  }

  const currentTripId = trip._id;
  const dbReady = openBusAppDB();

  offlineBtn.addEventListener('click', async () => {
    if (!currentTripId) return;

    try {
      const db = await dbReady;
      const tx = db.transaction('trips', 'readonly');
      const store = tx.objectStore('trips');

      // fetch the trip record
      const tripRecord = await new Promise((res, rej) => {
        const getReq = store.get(currentTripId);
        getReq.onsuccess = () => res(getReq.result);
        getReq.onerror = () => rej(getReq.error);
      });

      // handle missing record
      if (!tripRecord) {
        console.warn('No offline record found for trip', currentTripId);
        listContainer.innerHTML = `<div>No offline data for this trip.</div>`;
        offlineModal.style.display = 'block';
        return;
      }

      // handle missing or empty tickets array
      if (!Array.isArray(tripRecord.tickets) || tripRecord.tickets.length === 0) {
        console.warn('No offline tickets saved for trip', currentTripId);
        listContainer.innerHTML = `<div>No tickets have been saved offline for this trip.</div>`;
        offlineModal.style.display = 'block';
        return;
      }

      // build the list HTML
      const listHtml = tripRecord.tickets.map((t, i) => {
        const when = new Date(
          new Date(t.ticket_date_time).getTime()
          + 5.5 * 60 * 60 * 1000
        ).toLocaleString('en-US', { timeZone: 'Asia/Colombo' });
        return `
          <div class="ticket-card">
            <div class="ticket-header">
              <span class="ticket-index">#${i + 1}</span>
              <time class="ticket-time">${when}</time>
            </div>
            <div class="ticket-body">
              <span class="ticket-route">${t.start_point} → ${t.end_point}</span>
              <span class="ticket-price">LKR ${t.ticket_price.toLocaleString()}</span>
            </div>
          </div>
        `;
      }).join('');

      listContainer.innerHTML = listHtml;
      offlineModal.style.display = 'block';
    }
    catch (err) {
      console.error('Error loading tickets from IndexedDB', err);
      listContainer.innerHTML = `<div>Error loading offline tickets.</div>`;
      offlineModal.style.display = 'block';
    }
  });

  offlineCloseBtn.addEventListener('click', () => {
    offlineModal.style.display = 'none';
  });

  window.addEventListener('click', e => {
    if (e.target === offlineModal) {
      offlineModal.style.display = 'none';
    }
  });
}


// Select a trip: update UI + details panel
async function selectTrip(trip) {
  // 1) Track the currentTripId (or null)
  currentTripId = trip && trip._id ? trip._id : null;
  window.currentTrip = trip;
  // After: currentTripId = trip && trip._id ? trip._id : null;
  const graphLink = document.getElementById('ticketGraphBtn');
  if (graphLink) {
    const tpl = graphLink.dataset.urlTemplate || '/web/ticket-graph/__ID__/';
    if (currentTripId) {
      graphLink.setAttribute('href', tpl.replace('__ID__', encodeURIComponent(currentTripId)));
      graphLink.classList.remove('disabled');
    } else {
      graphLink.setAttribute('href', '#');
      graphLink.classList.add('disabled');
    }
  }



  // 2) Remove any “active” class from date‐buttons
  document.querySelectorAll('#tripSelection .date-button')
    .forEach(b => b.classList.remove('active'));

  // 3) Helper to clear textContent/innerHTML
  const clearText = id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '';
  };
  const clearHTML = id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  };

  // 4) If no trip selected, clear everything and bail out
  if (!currentTripId) {
    [
      'ownerName', 'detailBusName', 'detailRoute', 'detailStartTime',
      'detailBookingPrice', 'detailOnline', 'detailOffline',
      'bookedCount', 'onlineCount', 'onlineEarning', 'onlineFee',
      'onlineRevenue', 'offlineCount', 'offlineEarning', 'offlineFee',
      'offlineRevenue', 'finalRevenue'
    ].forEach(clearText);

    const graphLink = document.getElementById('ticketGraphBtn');
    if (graphLink) {
      graphLink.setAttribute('href', '#');
      graphLink.classList.add('disabled');
    }


    const statusEl = document.getElementById('detailRevenueStatus');
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.classList.remove('completed', 'pending');
    }

    return;
  }

  // 5) Highlight the correct date-button
  const btn = document.querySelector(
    `#tripSelection .date-button[data-trip-id="${trip._id}"]`
  );
  btn?.classList.add('active');

  // 6) Load the full trip record from IndexedDB
  let r;
  try {
    const db = await openBusAppDB();
    const tx = db.transaction('trips', 'readonly');
    const store = tx.objectStore('trips');
    r = await new Promise((res, rej) => {
      const getReq = store.get(currentTripId);
      getReq.onsuccess = () => res(getReq.result);
      getReq.onerror = () => rej(getReq.error);
    });
  } catch (err) {
    console.error('IndexedDB error', err);
  }
  if (!r) r = {};  // missing record → use empty object

  // 7) Safely pull every field, falling back to empty string
  const asText = v => (v != null ? String(v) : '');
  const asMoney = v => (v != null ? `LKR ${Number(v).toLocaleString()}` : '');

  // Date label
  let dateLabel = '';
  if (r.trip_start_time) {
    const d = new Date(
      new Date(r.trip_start_time).getTime()
      + 5.5 * 60 * 60 * 1000
    );
    const options = { timeZone: 'Asia/Colombo' };

    const day = parseInt(d.toLocaleDateString('en-US', { ...options, day: 'numeric' }));
    const weekday = d.toLocaleDateString('en-US', { ...options, weekday: 'long' });
    const time = d.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });

    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    if (day % 10 === 2 && day !== 12) suffix = 'nd';
    if (day % 10 === 3 && day !== 13) suffix = 'rd';
    dateLabel = `${day}${suffix} ${weekday} ${time}`;
  }

  // Populate DOM
  document.getElementById('ownerName').textContent = dateLabel;
  document.getElementById('detailBusName').textContent = asText(r.bus_name);
  document.getElementById('detailRoute').textContent = asText(r.route_name);
  document.getElementById('detailStartTime').textContent = r.trip_start_time
    ? new Date(
      new Date(r.trip_start_time).getTime()
      + 5.5 * 60 * 60 * 1000
    ).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
    : '';
  document.getElementById('detailBookingPrice').textContent = r.booking_price != null
    ? `Rs. ${r.booking_price}`
    : '';

  document.getElementById('detailOnline').textContent = asText(r.booked_seats);
  document.getElementById('detailOffline').textContent = asText(r.number_of_tickets);
  document.getElementById('bookedCount').textContent = asText(r.booked_seats);

  // Revenue status
  const statusEl = document.getElementById('detailRevenueStatus');
  if (statusEl) {
    statusEl.classList.remove('completed', 'pending');
    if (r.is_revenue_released === true) {
      statusEl.textContent = 'Completed';
      statusEl.classList.add('completed');
    } else if (r.is_revenue_released === false) {
      statusEl.textContent = 'Pending';
      statusEl.classList.add('pending');
    } else {
      statusEl.textContent = '';
    }
  }

  // Online sale calculations
  const onlineEarn = r.booked_revenue;
  const onlineFee = onlineEarn != null ? Math.round(onlineEarn * 0.04) : null;
  const onlineNet = (onlineEarn != null && onlineFee != null) ? onlineEarn - onlineFee : null;
  const pctLabel = (onlineEarn > 0 && onlineFee != null)
    ? `<small>(-${Math.round((onlineFee / onlineEarn) * 100)}%)</small>`
    : '';

  document.getElementById('onlineCount').textContent = asText(r.booked_seats);
  document.getElementById('onlineEarning').textContent = asMoney(onlineEarn);
  document.getElementById('onlineFee').innerHTML = onlineFee != null
    ? `LKR ${onlineFee.toLocaleString()} ${pctLabel}`
    : '';
  document.getElementById('onlineRevenue').textContent = asMoney(onlineNet);

  // Offline sale calculations
  const offlineEarn = r.tickets_revenue;
  const offlineFee = r.number_of_tickets != null ? r.number_of_tickets * 2 : null;
  const offlineNet = (offlineEarn != null && offlineFee != null) ? offlineEarn - offlineFee : null;
  const offLabel = r.number_of_tickets != null
    ? `<small>(-${r.number_of_tickets}×2)</small>`
    : '';

  document.getElementById('offlineCount').textContent = asText(r.number_of_tickets);
  document.getElementById('offlineEarning').textContent = asMoney(offlineEarn);
  document.getElementById('offlineFee').innerHTML = offlineFee != null
    ? `LKR ${offlineFee.toLocaleString()} ${offLabel}`
    : '';
  document.getElementById('offlineRevenue').textContent = asMoney(offlineNet);

  // Final revenue
  const totalRev = (onlineNet != null && offlineNet != null)
    ? onlineNet + offlineNet
    : null;
  //document.getElementById('finalRevenue').textContent = asMoney(totalRev);

  // 8) Finally show offline tickets for the loaded record
  getTicketsInfo(r);
}


async function getBookingsInfo(trip) {
  const currentTripId = trip._id;
  const seatType = trip.seat_type;
  let db;

  try {
    // openBusAppDB() should return a Promise<IDBDatabase>
    db = await openBusAppDB();
  } catch (err) {
    console.error('Error opening DB', err);
    const result = { seatType, bookings: [] };
    console.log('Returning (DB open error):', result);
    return result;
  }

  const tx = db.transaction('trips', 'readonly');
  const store = tx.objectStore('trips');

  let tripRecord;
  try {
    tripRecord = await new Promise((resolve, reject) => {
      const req = store.get(currentTripId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`Error fetching trip ${currentTripId}`, err);
    const result = { seatType, bookings: [] };
    console.log('Returning (fetch error):', result);
    return result;
  }

  if (!tripRecord || !Array.isArray(tripRecord.bookings) || tripRecord.bookings.length === 0) {
    const result = { seatType, bookings: [] };
    console.log('Returning (no bookings):', result);
    return result;
  }

  // Map bookings to an array of detail objects
  const bookings = tripRecord.bookings.map(({ seat_number, start_point, end_point, booked }) => ({
    seat_number,
    start_point,
    end_point,
    booked
  }));

  const result = { seatType, bookings };
  console.log('Returning:', result);
  return result;
}



// POST to toggle-machine-button
async function toggleMachine(busId, isOn) {
  try {
    const res = await authFetch(`${baseUrl}/bus-owners/toggle-machine-button/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: busId,
        status: isOn ? 'on' : 'off'
      })
    });
    // Add this check to ensure the function exits if a redirect occurred.
    if (!res) return;

  } catch (err) {
    console.error('Failed to toggle machine', err);
  }
}


function renderRevenueChart(trips) {
  // 1. Build the X-axis labels (HH:MM) and the two data arrays
  const labels = trips.map(t => {
    const d = new Date(
      new Date(t.trip_start_time).getTime()
      + 5.5 * 60 * 60 * 1000
    );
    const datePart = d.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      timeZone: 'Asia/Colombo'
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Colombo'
    });
    return `${datePart} ${timePart}`;
  });
  const bookedData = trips.map(t => t.booked_revenue);
  const ticketsData = trips.map(t => t.tickets_revenue);

  // 2. Grab the canvas context
  const ctx = document.getElementById('revenueChart').getContext('2d');

  // 3. If there’s an existing chart instance, destroy it to avoid overlaps
  if (window.revenueChart?.destroy) {
    window.revenueChart.destroy();
  }

  // 4. Create a new Chart.js bar chart
  window.revenueChart = new Chart(ctx, {
    type: 'bar',
    backgroundColor: 'white',
    data: {
      labels,
      datasets: [
        {
          label: 'Booked Revenue',
          data: bookedData,

          labelColor: 'white',
          backgroundColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--blue').trim()
        },
        {
          label: 'Tickets Revenue',

          data: ticketsData,
          backgroundColor: getComputedStyle(document.documentElement)
            .getPropertyValue('--dark-blue').trim()
        }
      ]
    },
    options: {
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true }
      }
    }
  });
}

// ******************************************************* Add Bus Trips Function ***********************************************************************************************

let selectedRoute = null;

// Find and replace this event listener
const addTripBtn = document.getElementById('addTripButton');
if (addTripBtn) {
  addTripBtn.addEventListener('click', () => {
    const bus = window.currentBusData;
    // --- NEW LOGIC ---
    if (bus && bus.is_approved === false) {
      // If the bus is explicitly NOT approved, show the approval modal
      const approvalModal = document.getElementById('approvalModal');
      if (approvalModal) approvalModal.style.display = 'block';
    } else {
      // Otherwise, proceed as normal
      const modal = document.getElementById('addTripModal');
      if (modal) modal.style.display = 'block';
    }
  });
}

const closeBtn = document.getElementById('closeAddTripModal');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    const modal = document.getElementById('addTripModal');
    const suggestions = document.getElementById('routeSuggestions');
    if (modal) modal.style.display = 'none';
    if (suggestions) suggestions.innerHTML = '';
    selectedRoute = null;
  });
}

window.addEventListener('click', (e) => {
  const modal = document.getElementById('addTripModal');
  const suggestions = document.getElementById('routeSuggestions');
  if (modal && e.target === modal) {
    modal.style.display = 'none';
    if (suggestions) suggestions.innerHTML = '';
    selectedRoute = null;
  }
});

const routeInput = document.getElementById('routeSearchInput');
if (routeInput) {
  routeInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const suggestionsBox = document.getElementById('routeSuggestions');
    if (!suggestionsBox) return;
    suggestionsBox.innerHTML = '';

    if (query.length < 2) return;

    try {
      const res = await fetch(
        `${baseUrl}/core/routes/?route_name=${encodeURIComponent(query)}`
      );
      const routes = await res.json();

      // **FIX**: Prevent duplicate route suggestions
      const uniqueRoutes = [...new Map(routes.map(route => [route.route_name, route])).values()];

      uniqueRoutes.forEach(route => {
        const item = document.createElement('div');
        item.textContent = route.route_name;
        item.addEventListener('click', () => {
          selectedRoute = route;
          routeInput.value = route.route_name;
          suggestionsBox.innerHTML = '';
        });
        suggestionsBox.appendChild(item);
      });
    } catch (err) {
      console.error('Route search failed:', err);
    }
  });
}

const addTripForm = document.getElementById('addTripForm');
if (addTripForm) {
  addTripForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    // **IMPROVEMENT**: Read from new date and time inputs
    const tripDate = document.getElementById('tripDateInput').value;
    const tripTime = document.getElementById('tripTimeInput').value;
    const booking_price = parseInt(document.getElementById('bookingPriceInput').value);

    // Validate date and time are not empty
    if (!tripDate || !tripTime) {
      alert('Please select both a date and a time for the trip.');
      return;
    }

    // **IMPROVEMENT**: Convert local Sri Lanka time to UTC
    // 1. Combine date and time into a single string.
    const localDateTimeString = `${tripDate}T${tripTime}:00`;

    // 2. Create a Date object assuming SL time (+05:30) and convert to ISO string (UTC)
    // The 'Z' at the end of the toISOString() output indicates UTC.
    const trip_start_time_utc = new Date(localDateTimeString + '+05:30').toISOString();

    try {
      const bus = window.currentBusData;

      if (!bus) {
        alert("Bus data not loaded. Please select a bus first.");
        return;
      }

      if (!selectedRoute) {
        alert('Please select a route from the suggestions.');
        return;
      }

      const postData = {
        route_id: selectedRoute.route_id,
        route_name: selectedRoute.route_name,
        trip_start_time: trip_start_time_utc, // Send UTC time to backend
        booking_price,
        bus_id: bus._id,
        bus_number: bus.bus_number,
        bus_name: bus.bus_name,
        seat_type: bus.seat_type,
        number_of_seats: parseInt(bus.seat_type.split(' ')[0]) || 0,
        fare_type_id: bus.fare_type_id || null,
        fare_type_name: bus.fare_type_name || null
      };

      const res = await authFetch(`${baseUrl}/core/bus-trip/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });

      // Add this check before trying to access the .ok property.
      if (!res) return;

      if (res.ok) {
        alert('Trip added successfully!');
        document.getElementById('addTripModal').style.display = 'none';
        addTripForm.reset(); // Reset form fields
        await switchBus(currentBusId);
      } else {
        const errorText = await res.text();
        alert('Error: ' + errorText);
      }
    } catch (err) {
      console.error('Failed to add trip:', err);
      alert('A network or server error occurred while adding the trip.');
    }
  });
}



// Find and replace this event listener
const placeholderAddTripBtn = document.getElementById('placeholderAddTripButton');
if (placeholderAddTripBtn) {
  placeholderAddTripBtn.addEventListener('click', () => {
    const bus = window.currentBusData;
    // --- NEW LOGIC (Identical to the other button) ---
    if (bus && bus.is_approved === false) {
      const approvalModal = document.getElementById('approvalModal');
      if (approvalModal) approvalModal.style.display = 'block';
    } else {
      const modal = document.getElementById('addTripModal');
      if (modal) modal.style.display = 'block';
    }
  });
}

// Add this new block of code for the approval modal
const closeApprovalBtn = document.getElementById('closeApprovalModal');
if (closeApprovalBtn) {
  closeApprovalBtn.addEventListener('click', () => {
    const modal = document.getElementById('approvalModal');
    if (modal) modal.style.display = 'none';
  });
}

export { getBookingsInfo };