import { authFetch } from './auth.js';


// Track currently selected bus for toggle API calls
let currentTripId = null;


// Once on DOM load, fetch owner→render bus buttons
document.addEventListener('DOMContentLoaded', () => {
  loadOwnerDetails();

  // Bind the trip-button container clicks (delegated below)
});

// 1) Load and render the bus list
async function loadOwnerDetails() {
  try {
    const res = await authFetch('https://www.passenger.lk/bus-owners/owner-details/');
    const data = await res.json();

    // Sidebar
    document.getElementById('companyName').textContent = data.company_name;
    document.getElementById('ownerName').textContent = data.company_owner_name;

    // Bus buttons
    const busContainer = document.getElementById('busSelection');
    busContainer.innerHTML = '';

    data.buses.forEach((bus, idx) => {
      const btn = document.createElement('button');
      btn.className = 'bus-button';
      // NOTE: innerHTML so we can style each part separately
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


    // Auto-load first bus if present
    if (data.buses[0]) {
      await switchBus(data.buses[0].bus_id);
    }
  } catch (err) {
    console.error('Error loading owner details', err);
  }
}

// 2) Handle bus switch: clear DB, wait 5s, fetch trips, store + render
async function switchBus(busId) {
  currentBusId = busId;

  const overlay = document.getElementById('loadingOverlay');
  const loadingText = document.getElementById('loadingText');
  const progressBar = document.getElementById('progressBar');
  overlay.classList.remove('hidden');

  // Define messages and timing
  const messages = [
    'Fetching Your Data',
    'Collecting all the bus trips',
    'Mapping the graphs',
    'Calculating revenues'
  ];
  const totalDuration = 5000;
  const interval = totalDuration / messages.length;

  // Schedule text updates
  messages.forEach((msg, i) => {
    setTimeout(() => {
      loadingText.textContent = msg;
    }, i * interval);
  });

  // Animate progress bar
  let startTime = null;
  function animate(time) {
    if (!startTime) startTime = time;
    const elapsed = time - startTime;
    const pct = Math.min((elapsed / totalDuration) * 100, 100);
    progressBar.style.width = pct + '%';
    if (elapsed < totalDuration) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);

  // Simulate load delay
  await new Promise(r => setTimeout(r, totalDuration));

  // Hide loader
  overlay.classList.add('hidden');

  try {
    // Clear old UI & IndexedDB
    document.getElementById('tripSelection').innerHTML = '';
    clearIndexedDB();

    // Fetch & parse
    const res = await authFetch(
      `https://www.passenger.lk/bus-owners/bus-trip-details/?bus_id=${busId}`
    );
    const { bus, trips } = await res.json();

    // Save & render
    saveTripsToDB(trips, () => {
      const toggle = document.getElementById('machineToggle');
      toggle.checked = !!bus.machine;
      toggle.onchange = () => toggleMachine(busId, toggle.checked);

      renderTripButtons(trips);
      if (trips[0]) selectTrip(trips[0]);
      renderRevenueChart(trips);
    });

  } catch (err) {
    console.error('Error loading owner details', err);
  } finally {
    // 2) hide spinner
    overlay.classList.add('hidden');
  }
}


// IndexedDB helpers
function clearIndexedDB() {
  const req = indexedDB.open('busApp', 1);
  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction('trips', 'readwrite');
    tx.objectStore('trips').clear();
  };
}

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

// Render trip buttons
function renderTripButtons(trips) {
  const container = document.getElementById('tripSelection');
  container.innerHTML = '';

  trips.forEach(trip => {
    const d = new Date(trip.trip_start_time);
    const suffix = ['th', 'st', 'nd', 'rd'][Math.min(d.getDate() % 10, 3)];
    const label = `${d.getDate()}${suffix} ${d.toLocaleDateString('en-US', { weekday: 'long' })} ` +
      `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

    const btn = document.createElement('button');
    btn.className = 'date-button';
    btn.textContent = label;

    btn.addEventListener('click', () => {
      // remove active from all
      container
        .querySelectorAll('.date-button')
        .forEach(b => b.classList.remove('active'));
      // mark this one
      btn.classList.add('active');
      // call your existing handler
      selectTrip(trip);
    });

    container.appendChild(btn);
  });
}

// Select a trip: update UI + details panel
function selectTrip(trip) {

  currentTripId = trip._id;
  document.querySelectorAll('#tripSelection .date-button')
    .forEach(b => b.classList.remove('active'));
  // find the matching button
  [...document.querySelectorAll('#tripSelection .date-button')]
    .find(b => b.textContent.startsWith(
      new Date(trip.trip_start_time).getDate()
    )).classList.add('active');

  // Update detail fields
  document.getElementById('detailBusName').textContent = trip.bus_name;
  document.getElementById('detailRoute').textContent = trip.route_name;
  document.getElementById('detailStartTime').textContent =
    new Date(trip.trip_start_time)
      .toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('detailBookingPrice').textContent = `Rs. ${trip.booking_price}`;
  document.getElementById('detailOnline').textContent = trip.booked_seats;
  document.getElementById('detailOffline').textContent = trip.number_of_tickets;
  document.getElementById('bookedCount').textContent = trip.booked_seats;


  const statusEl = document.getElementById('detailRevenueStatus');
  statusEl.textContent = trip.is_revenue_released ? 'Completed' : 'Pending';
  statusEl.classList.toggle('completed', trip.is_revenue_released);
  statusEl.classList.toggle('pending', !trip.is_revenue_released);

  // --- inside selectTrip(trip), after setting detail fields ---

  // Online sale
  const onlineCount = trip.booked_seats;
  const onlineEarn = trip.booked_revenue;
  const onlineFeeAmt = Math.round(onlineEarn * 0.04);
  const onlineNet = onlineEarn - onlineFeeAmt;

  document.getElementById('onlineCount').textContent = onlineCount;
  document.getElementById('onlineEarning').textContent = `LKR ${onlineEarn.toLocaleString()}`;
  document.getElementById('onlineFee').innerHTML =
    `LKR ${onlineFeeAmt.toLocaleString()} <small>(-${Math.round((onlineFeeAmt / onlineEarn) * 100)}%)</small>`;
  document.getElementById('onlineRevenue').textContent = `LKR ${onlineNet.toLocaleString()}`;

  // Offline sale
  const offlineCount = trip.number_of_tickets;
  const offlineEarn = trip.tickets_revenue;
  const offlineFeeAmt = offlineCount * 2;
  const offlineNet = offlineEarn - offlineFeeAmt;

  document.getElementById('offlineCount').textContent = offlineCount;
  document.getElementById('offlineEarning').textContent = `LKR ${offlineEarn.toLocaleString()}`;
  document.getElementById('offlineFee').innerHTML =
    `LKR ${offlineFeeAmt.toLocaleString()} <small>(-${offlineCount}×2)</small>`;
  document.getElementById('offlineRevenue').textContent = `LKR ${offlineNet.toLocaleString()}`;

  // Final revenue
  const totalRevenue = onlineNet + offlineNet;
  document.getElementById('finalRevenue').textContent = `LKR ${totalRevenue.toLocaleString()}`;

}


// POST to toggle-machine-button
async function toggleMachine(busId, isOn) {
  try {
    await authFetch('https://www.passenger.lk/bus-owners/toggle-machine-button/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: busId,
        status: isOn ? 'on' : 'off'
      })
    });
  } catch (err) {
    console.error('Failed to toggle machine', err);
  }
}


function renderRevenueChart(trips) {
  // 1. Build the X-axis labels (HH:MM) and the two data arrays
  const labels = trips.map(t => {
    const d = new Date(t.trip_start_time);
    return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
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
    data: {
      labels,
      datasets: [
        {
          label: 'Booked Revenue',
          data: bookedData,
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
// ——————————————————————
// Offline-tickets popup
// ——————————————————————
document.addEventListener('DOMContentLoaded', () => {
  const offlineBtn = document.getElementById('offlineSection');
  const offlineModal = document.getElementById('offlineModal');
  const offlineCloseBtn = document.getElementById('offlineClose');

  offlineBtn.addEventListener('click', async () => {
    if (!currentTripId) return;  // no trip selected yet

    try {
      const res = await authFetch(
        `https://www.passenger.lk/bus-owners/trips/view-tickets/?trip_id=${currentTripId}`
      );
      const tickets = await res.json();

      // build HTML list
      const listHtml = tickets.map(t => {
        const dt = new Date(t.ticket_date_time).toLocaleString();
        return `<div>${dt} – ${t.start_point} → ${t.end_point} @ LKR ${t.ticket_price}</div>`;
      }).join('');

      document.getElementById('offlineTicketList').innerHTML = listHtml;
      offlineModal.style.display = 'block';
    } catch (err) {
      console.error('Error fetching offline tickets', err);
    }
  });

  offlineCloseBtn.addEventListener('click', () => {
    offlineModal.style.display = 'none';
  });
  window.addEventListener('click', e => {
    if (e.target === offlineModal) offlineModal.style.display = 'none';
  });
});
