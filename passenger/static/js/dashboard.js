import { authFetch, baseUrl } from './auth.js';

// Grab cookies
const panel = document.querySelector('.details-panel');
// Track currently selected bus for toggle API calls
let currentBusId = null;
let currentTripId = null;

// Once on DOM load, fetch owner→render bus buttons and set up sidebar
document.addEventListener('DOMContentLoaded', () => {
  loadOwnerDetails();
  setupSidebar();
});


// Sidebar Functionality
function setupSidebar() {
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  const sidebarToggle = document.getElementById('sidebarToggle');

  if (sidebar && mainContent && sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
      mainContent.classList.toggle('sidebar-collapsed');
    });
  }
}


// Database Functions *********************************************************************************************************************************************************

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
    if (!res) return;

    const data = await res.json();

    const el = document.getElementById('companyName');
    if (el) el.textContent = data.company_name;

    if (!data.buses || data.buses.length === 0) {
      console.log('No buses found for this owner.');
      if (busContentWrapper) busContentWrapper.classList.add('hidden');
      if (noBusesPlaceholder) noBusesPlaceholder.classList.remove('hidden');
      return;
    }

    if (busContentWrapper) busContentWrapper.classList.remove('hidden');
    if (noBusesPlaceholder) noBusesPlaceholder.classList.add('hidden');

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

        if (idx === 0) btn.classList.add('selected');

        btn.addEventListener('click', async () => {
          document.querySelectorAll('.bus-button')
            .forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
          await switchBus(bus.bus_id);
        });

        busContainer.appendChild(btn);
      });
    } else {
      console.warn('`#busSelection` not found — skipping bus button render');
    }

    if (data.buses[0]) {
      await switchBus(data.buses[0].bus_id);
    }
  } catch (err) {
    console.error('Error loading owner details', err);
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

  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const progressBar = document.getElementById('progressBar');
  const detailsSection = document.getElementById('tripDetailsSection');
  const noTripsPlaceholder = document.getElementById('noTripsPlaceholder');

  overlay.classList.remove('hidden');
  detailsSection.classList.add('hidden'); // Hide details until loaded
  noTripsPlaceholder.classList.add('hidden');

  progressBar.style.width = '0%';
  loadingText.textContent = 'Fetching Your Data';

  if (detailsSection) {
    const tripSelection = detailsSection.querySelector('#tripSelection');
    if (tripSelection) tripSelection.innerHTML = '';
  }

  clearIndexedDB();

  const totalDuration = 2000;
  const timerPromise = new Promise(r => setTimeout(r, totalDuration));

  const fetchPromise = authFetch(
    `${baseUrl}/bus-owners/bus-trip-details/?bus_id=${busId}`
  ).then(res => {
    if (!res) return;
    return res.json();
  });

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

  overlay.classList.add('hidden');

  if (!Array.isArray(trips) || trips.length === 0) {
    detailsSection.classList.add('hidden');
    noTripsPlaceholder.classList.remove('hidden');
    return;
  }

  detailsSection.classList.remove('hidden');

  saveTripsToDB(trips, () => {
    const toggle = document.getElementById('machineToggle');
    toggle.checked = !!bus.machine;
    toggle.onchange = () => toggleMachine(busId, toggle.checked);

    renderTripButtons(trips);
    if (trips[0]) {
      selectTrip(trips[0]);
      getBookingsInfo(trips[0]);
    }

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

    const day = parseInt(d.toLocaleDateString('en-US', { ...options, day: 'numeric' }));
    const weekday = d.toLocaleDateString('en-US', { ...options, weekday: 'short' });
    const time = d.toLocaleTimeString('en-US', { ...options, hour: '2-digit', minute: '2-digit', hour12: false });

    let suffix = 'th';
    if (day % 10 === 1 && day !== 11) suffix = 'st';
    if (day % 10 === 2 && day !== 12) suffix = 'nd';
    if (day % 10 === 3 && day !== 13) suffix = 'rd';

    const label = `${day}${suffix} ${weekday} ${time}`;

    const btn = document.createElement('button');
    btn.className = 'date-button';
    btn.textContent = label;
    btn.dataset.tripId = trip._id;

    btn.addEventListener('click', () => {
      container.querySelectorAll('.date-button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectTrip(trip);
      getBookingsInfo(trip);
    });

    container.appendChild(btn);
  });
}

function getTicketsInfo(trip) {
  const offlineBtn = document.getElementById('offlineSectionBtn');
  const offlineModal = document.getElementById('offlineModal');
  const offlineCloseBtn = document.getElementById('offlineClose');
  const listContainer = document.getElementById('offlineTicketList');

  if (!offlineBtn || !offlineModal || !offlineCloseBtn || !listContainer) {
    console.error('Missing required DOM elements for offline tickets');
    return;
  }

  const currentTripId = trip._id;
  const dbReady = openBusAppDB();

  offlineBtn.onclick = async () => {
    if (!currentTripId) return;

    try {
      const db = await dbReady;
      const tx = db.transaction('trips', 'readonly');
      const store = tx.objectStore('trips');

      const tripRecord = await new Promise((res, rej) => {
        const getReq = store.get(currentTripId);
        getReq.onsuccess = () => res(getReq.result);
        getReq.onerror = () => rej(getReq.error);
      });

      if (!tripRecord) {
        listContainer.innerHTML = `<p>No offline data for this trip.</p>`;
        offlineModal.classList.add('show');
        return;
      }

      if (!Array.isArray(tripRecord.tickets) || tripRecord.tickets.length === 0) {
        listContainer.innerHTML = `<p>No tickets have been saved offline for this trip.</p>`;
        offlineModal.classList.add('show');
        return;
      }

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
      offlineModal.classList.add('show');
    }
    catch (err) {
      console.error('Error loading tickets from IndexedDB', err);
      listContainer.innerHTML = `<div>Error loading offline tickets.</div>`;
      offlineModal.classList.add('show');
    }
  };

  offlineCloseBtn.addEventListener('click', () => {
    offlineModal.classList.remove('show');
  });

  window.addEventListener('click', e => {
    if (e.target === offlineModal) {
      offlineModal.classList.remove('show');
    }
  });
}


// Select a trip: update UI + details panel
async function selectTrip(trip) {
  currentTripId = trip && trip._id ? trip._id : null;
  window.currentTrip = trip;

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

  document.querySelectorAll('.trip-selection-container .date-button')
    .forEach(b => b.classList.remove('active'));

  const clearText = id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '-';
  };

  if (!currentTripId) {
    [
      'ownerName', 'detailBusName', 'detailRoute', 'detailStartTime',
      'detailBookingPrice', 'detailOnline', 'detailOffline',
      'bookedCount', 'onlineCount', 'onlineEarning', 'onlineFee',
      'onlineRevenue', 'offlineCount', 'offlineEarning'
    ].forEach(clearText);

    const statusEl = document.getElementById('detailRevenueStatus');
    if (statusEl) {
      statusEl.textContent = '-';
      statusEl.classList.remove('completed', 'pending');
    }
    return;
  }

  const btn = document.querySelector(
    `.trip-selection-container .date-button[data-trip-id="${trip._id}"]`
  );
  btn?.classList.add('active');

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
  if (!r) r = {};

  const asText = (v, fallback = '-') => (v != null && v !== '' ? String(v) : fallback);
  const asMoney = (v, fallback = '-') => (v != null ? `LKR ${Number(v).toLocaleString()}` : fallback);

  let dateLabel = '-';
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
    dateLabel = `Trip Details for ${day}${suffix} ${weekday}, ${time}`;
  }

  document.getElementById('ownerName').textContent = dateLabel;
  document.getElementById('detailBusName').textContent = asText(r.bus_name);
  document.getElementById('detailRoute').textContent = asText(r.route_name);
  document.getElementById('detailStartTime').textContent = r.trip_start_time
    ? new Date(
      new Date(r.trip_start_time).getTime()
      + 5.5 * 60 * 60 * 1000
    ).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
    : '-';
  document.getElementById('detailBookingPrice').textContent = asMoney(r.booking_price);

  document.getElementById('detailOnline').textContent = asText(r.booked_seats);
  document.getElementById('detailOffline').textContent = asText(r.number_of_tickets);
  document.getElementById('bookedCount').textContent = asText(r.booked_seats);

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
      statusEl.textContent = '-';
    }
  }

  const onlineEarn = r.booked_revenue;
  const onlineFee = onlineEarn != null ? Math.round(onlineEarn * 0.04) : null;
  const onlineNet = (onlineEarn != null && onlineFee != null) ? onlineEarn - onlineFee : null;

  document.getElementById('onlineCount').textContent = asText(r.booked_seats);
  document.getElementById('onlineEarning').textContent = asMoney(onlineEarn);
  document.getElementById('onlineFee').textContent = asMoney(onlineFee);
  document.getElementById('onlineRevenue').textContent = asMoney(onlineNet);

  const offlineEarn = r.tickets_revenue;
  document.getElementById('offlineCount').textContent = asText(r.number_of_tickets);
  document.getElementById('offlineEarning').textContent = asMoney(offlineEarn);

  getTicketsInfo(r);
}


async function getBookingsInfo(trip) {
  const currentTripId = trip._id;
  const seatType = trip.seat_type;
  let db;

  try {
    db = await openBusAppDB();
  } catch (err) {
    console.error('Error opening DB', err);
    return { seatType, bookings: [] };
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
    return { seatType, bookings: [] };
  }

  if (!tripRecord || !Array.isArray(tripRecord.bookings) || tripRecord.bookings.length === 0) {
    return { seatType, bookings: [] };
  }

  const bookings = tripRecord.bookings.map(({ seat_number, start_point, end_point, booked }) => ({
    seat_number,
    start_point,
    end_point,
    booked
  }));

  return { seatType, bookings };
}

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
    if (!res) return;
  } catch (err) {
    console.error('Failed to toggle machine', err);
  }
}

function renderRevenueChart(trips) {
  const labels = trips.map(t => {
    const d = new Date(new Date(t.trip_start_time).getTime() + 5.5 * 60 * 60 * 1000);
    const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Colombo' });
    return datePart;
  });
  const bookedData = trips.map(t => t.booked_revenue || 0);
  const ticketsData = trips.map(t => t.tickets_revenue || 0);

  const ctx = document.getElementById('revenueChart').getContext('2d');

  // UI improvement: Get colors from CSS variables for consistency
  const style = getComputedStyle(document.documentElement);
  const primaryColor = style.getPropertyValue('--primary-color').trim();
  const secondaryColor = '#2ac769'; // Green for offline tickets
  const textColor = style.getPropertyValue('--text-secondary').trim();
  const gridColor = style.getPropertyValue('--border-color').trim();

  if (window.revenueChart?.destroy) {
    window.revenueChart.destroy();
  }

  window.revenueChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Online Revenue',
          data: bookedData,
          backgroundColor: primaryColor,
          borderRadius: 4,
        },
        {
          label: 'Offline Revenue',
          data: ticketsData,
          backgroundColor: secondaryColor,
          borderRadius: 4,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: {
              family: "'Poppins', sans-serif",
              size: 14
            }
          }
        },
        tooltip: {
          backgroundColor: '#2C2F38',
          titleFont: { size: 14, family: "'Poppins', sans-serif" },
          bodyFont: { size: 12, family: "'Poppins', sans-serif" },
          callbacks: {
            label: function (context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'LKR' }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: textColor, font: { family: "'Poppins', sans-serif" } },
          grid: { color: 'transparent' }
        },
        y: {
          stacked: true,
          beginAtZero: true,
          ticks: { color: textColor, font: { family: "'Poppins', sans-serif" } },
          grid: { color: gridColor, borderDash: [2, 4] }
        }
      }
    }
  });
}

// Add Bus Trips Functionality
let selectedRoute = null;

const addTripBtn = document.getElementById('addTripButton');
if (addTripBtn) {
  addTripBtn.addEventListener('click', () => {
    const bus = window.currentBusData;
    if (bus && bus.is_approved === false) {
      const approvalModal = document.getElementById('approvalModal');
      if (approvalModal) approvalModal.classList.add('show');
    } else {
      const modal = document.getElementById('addTripModal');
      if (modal) modal.classList.add('show');
    }
  });
}

const closeBtn = document.getElementById('closeAddTripModal');
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    const modal = document.getElementById('addTripModal');
    if (modal) modal.classList.remove('show');
  });
}

window.addEventListener('click', (e) => {
  const modal = document.getElementById('addTripModal');
  if (modal && e.target === modal) {
    modal.classList.remove('show');
  }
});

const routeInput = document.getElementById('routeSearchInput');
if (routeInput) {
  routeInput.addEventListener('input', async (e) => {
    const query = e.target.value.trim();
    const suggestionsBox = document.getElementById('routeSuggestions');
    if (!suggestionsBox) return;

    // This line is crucial to prevent duplicates.
    suggestionsBox.innerHTML = '';

    if (query.length < 2) {
      selectedRoute = null; // Clear selection if query is too short
      return;
    }

    try {
      const res = await fetch(
        `${baseUrl}/core/routes/?route_name=${encodeURIComponent(query)}`
      );
      const routes = await res.json();

      // This ensures that even if the API returns duplicates, we only show unique route names.
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

    const tripDate = document.getElementById('tripDateInput').value;
    const tripTime = document.getElementById('tripTimeInput').value;
    const booking_price = parseInt(document.getElementById('bookingPriceInput').value);

    if (!tripDate || !tripTime) {
      alert('Please select both a date and a time for the trip.');
      return;
    }

    const localDateTimeString = `${tripDate}T${tripTime}:00`;
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
        trip_start_time: trip_start_time_utc,
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

      if (!res) return;

      if (res.ok) {
        alert('Trip added successfully!');
        document.getElementById('addTripModal').classList.remove('show');
        addTripForm.reset();
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

const placeholderAddTripBtn = document.getElementById('placeholderAddTripButton');
if (placeholderAddTripBtn) {
  placeholderAddTripBtn.addEventListener('click', () => {
    const bus = window.currentBusData;
    if (bus && bus.is_approved === false) {
      const approvalModal = document.getElementById('approvalModal');
      if (approvalModal) approvalModal.classList.add('show');
    } else {
      const modal = document.getElementById('addTripModal');
      if (modal) modal.classList.add('show');
    }
  });
}

const closeApprovalBtn = document.getElementById('closeApprovalModal');
if (closeApprovalBtn) {
  closeApprovalBtn.addEventListener('click', () => {
    const modal = document.getElementById('approvalModal');
    if (modal) modal.classList.remove('show');
  });
}

export { getBookingsInfo };