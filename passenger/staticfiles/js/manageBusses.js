import { authFetch } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  populateStaticDropdowns();
  showSkeletons(3);
  setTimeout(initBusUI, 2000);
  fetchFareTypes();
});



function showSkeletons(count = 3) {
  const container = document.querySelector('.bus-list');
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="bus-card">
      <div class="bus-header">
        <!-- title placeholder -->
        <div class="bus-title"><div class="skeleton skel-title"></div></div>
        <div class="bus-subtitle">
          <!-- number + type placeholders -->
          <div class="bus-number"><div class="skeleton skel-subnum"></div></div>
        </div>
      </div>
      <dl class="bus-body">
        <!-- 6 fields, all using the same skeleton bar -->
        ${['Bus Type', 'Bus Status', 'Seat Type', 'Bus Number', 'Overall Status', 'Fare Type']
      .map(_ => `
            <div class="bus-field">
              <dt>${_}</dt>
              <dd><div class="skeleton skel-field"></div></dd>
            </div>
          `).join('')}
      </dl>
    </div>
  `).join('');
}


// Bind the trip-button container clicks (delegated below)
async function loadBusDetails() {
  try {
    // 1) GET the owner details
    const getRes = await authFetch('https://www.passenger.lk/bus-owners/owner-details/');
    if (!getRes.ok) {
      throw new Error(`GET failed: ${getRes.status} ${getRes.statusText}`);
    }
    const data = await getRes.json();
    document.getElementById('companyName').textContent = data.company_name;

    // 2) build payload
    const payload = { ids: data.buses.map(b => b.bus_id) };

    // 3) POST the payload***********************************************************************************************************************************************************
    const postRes = await authFetch('https://www.passenger.lk/bus-owners/owner-buses/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!postRes.ok) {
      throw new Error(`POST failed: ${postRes.status} ${postRes.statusText}`);
    }

    // 4) parse & return the POST response*******************************************************************************************************************************************
    return await postRes.json();

  } catch (err) {
    console.error('Error loading bus details:', err);
    throw err;
  }
}

// static/js/manageBusses.js
// ————————————————————————————————————————————————————————————————
// Assumes you already have `loadBusDetails()` defined as in our last step,
// which returns the array of bus‐detail objects.
// ————————————————————————————————————————————————————————————————



async function initBusUI() {
  try {
    // 1) fetch & POST your IDs, then get the bus‐detail array:
    const buses = await loadBusDetails();

    // 2) populate the sidebar company name if you like:
    //    document.getElementById('companyName').textContent = data.company_name;

    // 3) render a card for each bus:
    renderBusCards(buses);
  } catch (err) {
    console.error('Could not load buses:', err);
  }
}

function renderBusCards(buses) {
  const container = document.querySelector('.bus-list');
  container.innerHTML = buses.map(bus => {
    // determine CSS class & text for approval status
    const approved = bus.is_approved;
    const statusClass = approved ? 'status-approved' : 'status-pending';
    const statusText = approved ? 'Approved' : 'Pending';

    // determine machine‐connection text
    const machineText = bus.is_machine_connected
      ? 'On a Turn'
      : 'Stopped';

    return `
      <div class="bus-card" data-bus-id="${bus._id}">
        <div class="bus-header">
          <div class="bus-title">${bus.bus_name}</div>
          <div class="bus-subtitle">
            <div class="bus-number">${bus.bus_number}</div>
          </div>
        </div>
        <dl class="bus-body">
          <div class="bus-field">
            <dt>Bus Type</dt>
            <dd>${bus.bus_type}</dd>
          </div>
          <div class="bus-field">
            <dt>Bus Status</dt>
            <dd>${machineText}</dd>
          </div>
          <div class="bus-field">
            <dt>Seat Type</dt>
            <dd>${bus.seat_type}</dd>
          </div>
          <div class="bus-field">
            <dt>Bus Number</dt>
            <dd>${bus.bus_number}</dd>
          </div>
          <div class="bus-field ${statusClass}">
            <dt>Status</dt>
            <dd>${statusText}</dd>
          </div>
          <div class="bus-field">
            <dt>Fare Type</dt>
            <dd>${bus.fare_type_name}</dd>
          </div>
        </dl>
      </div>
    `;
  }).join('');
  attachBusCardListeners();
}

// ——— Static lists for bus & seat types ———
const BUS_TYPES = [
  "Luxury",


];
const SEAT_TYPES = [
  "22 - Seater",
];

// ——— Fetch & render all the fare types ———

async function fetchFareTypes() {
  try {
    const res = await authFetch(
      'https://www.passenger.lk/bus-owners/list-fare-types/'
    );
    if (!res.ok) throw new Error('Failed to load fare types');
    const fares = await res.json(); // array of { id, name }


    const select = document.getElementById('fare_type_name_select');
    const hiddenId = document.getElementById('fare_type_id');
    const hiddenName = document.getElementById('fare_type_name_hidden');

    // 1) Populate the <select>
    select.innerHTML = fares
      .map(f => `<option value="${f.id}">${f.name}</option>`)
      .join('');
    console.log('All fare‐type options:', Array.from(select.options)
      .map((o, i) => ({ index: i, id: o.value, name: o.text }))
    );

    // 2) Helper to sync hidden inputs
    function syncFareFields() {
      const idx = select.selectedIndex;
      const opt = select.options[idx];
      hiddenId.value = opt.value;   // the fare_type_id
      hiddenName.value = opt.text;    // the fare_type_name
    }

    // 3) Wire up on change
    select.addEventListener('change', syncFareFields);

    // 4) Initialize them right away so they're never blank
    syncFareFields();

  } catch (err) {
    console.error(err);
  }
}

// ——— Fill bus-type & seat-type selects ———
function populateStaticDropdowns() {
  const bt = document.getElementById('bus_type');
  bt.innerHTML = BUS_TYPES
    .map(v => `<option value="${v}">${v}</option>`)
    .join('');
  const st = document.getElementById('seat_type');
  st.innerHTML = SEAT_TYPES
    .map(v => `<option value="${v}">${v}</option>`)
    .join('');
}

// ——— Wire up file-input preview ———
document
  .getElementById('route_permit_image')
  .addEventListener('change', e => {
    const file = e.target.files[0];
    const img = document.getElementById('route_permit_image_preview');
    if (file) {
      img.src = URL.createObjectURL(file);
      img.style.display = 'block';
    } else {
      img.src = '';
      img.style.display = 'none';
    }
  });

// ——— Initialize everything on page load ———
document.addEventListener('DOMContentLoaded', () => {
  fetchFareTypes();
  populateStaticDropdowns();
  showSkeletons(3);
  setTimeout(initBusUI, 2000);
});


function attachBusCardListeners() {
  document.querySelectorAll('.bus-card').forEach(card => {
    card.addEventListener('click', async () => {
      const busId = card.dataset.busId;
      try {
        const res = await authFetch(
          `https://www.passenger.lk/bus-owners/get-bus/?bus_id=${busId}`
        );
        if (!res.ok) throw new Error('Failed to load bus details');
        const bus = await res.json();

        // 3) if already approved → show a bottom notification
        if (bus.is_approved) {
          showNotification('Bus is already approved');
          return;
        }

        // 4) otherwise → open the modal & populate inputs
        openModal(bus);

      } catch (err) {
        console.error(err);
        showNotification('Error loading details');
      }
    });
  });
}

// ── 3) simple bottom notification banner ──
function showNotification(message) {
  let n = document.getElementById('notification');
  if (!n) {
    n = document.createElement('div');
    n.id = 'notification';
    n.style = `
      position: fixed;
      bottom: 1rem;
      left: 50%;
      transform: translateX(-50%);
      background: var(--blue);
      color: #fff;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      box-shadow: 0 4px 12px var(--shadow);
      z-index: 1100;
      opacity: 0;
      transition: opacity 0.3s;
    `;
    document.body.appendChild(n);
  }
  n.textContent = message;
  n.style.opacity = '1';
  setTimeout(() => n.style.opacity = '0', 3000);
}

// ── 4) open modal & populate form fields ──
function openModal(bus) {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('hidden');

  // populate each input
  document.getElementById('bus_id').value = bus._id;
  document.getElementById('bus_name').value = bus.bus_name;
  document.getElementById('bus_number').value = bus.bus_number;
  document.getElementById('bus_type').value = bus.bus_type;
  document.getElementById('seat_type').value = bus.seat_type;
  document.getElementById('route_permit_number').value = bus.route_permit_number;
  const img = document.getElementById('route_permit_image_preview');
  img.src = bus.route_permit_image;
  img.style.display = bus.route_permit_image ? 'block' : 'none';

  const fileInput = document.getElementById('route_permit_image');
  fileInput.value = '';

  // set hidden ID + select for fare type
  document.getElementById('fare_type_id').value = bus.fare_type_id;
  document.getElementById('fare_type_name_select').value = bus.fare_type_name;
}

// ── 5) close modal when “×” clicked ──
document.getElementById('modalClose').addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.add('hidden');
});

document.getElementById('saveButton').addEventListener('click', async () => {
  const form = document.getElementById('busForm');
  const fd = new FormData(form);
  const fare_type_id = document.getElementById('fare_type_id').value
  const fare_type_name = document.getElementById('fare_type_name_hidden').value
  fd.set('fare_type_name', fare_type_name);
  fd.set('fare_type_id', fare_type_id);

  try {
    const res = await authFetch(
      'https://www.passenger.lk/bus-owners/update-bus/',
      { method: 'PATCH', body: fd }
    );

    // parse the JSON body into a variable
    const body = await res.json();

    // print the entire response body
    console.log('Full response:', body);

    if (!res.ok) {
      // if you want to see error details, you already have them in `body`
      console.error('Update failed:', body);
      throw new Error(`Update failed: ${res.status}`);
    }

    // now destructure what you actually need
    const updatedBus = body.results;
    console.log('Updated bus object:', updatedBus);

    showNotification('Bus updated successfully!');
    document.getElementById('modalOverlay').classList.add('hidden');
    initBusUI();

  } catch (err) {
    console.error('Network or parsing error:', err);
    showNotification('Error updating bus');
  }
});

// —————— 1) Open/close modal ——————
document.getElementById('addBusBtn').addEventListener('click', () => {
  document.getElementById('createModal').classList.remove('hidden');
});
document.getElementById('createClose').addEventListener('click', () => {
  document.getElementById('createModal').classList.add('hidden');
});

// —————— 2) Populate dropdowns on load ——————

function populateCreateDropdowns() {
  document.getElementById('create_bus_type').innerHTML =
    BUS_TYPES.map(v => `<option>${v}</option>`).join('');
  document.getElementById('create_seat_type').innerHTML =
    SEAT_TYPES.map(v => `<option>${v}</option>`).join('');
}

// fetch fare types into the create‐form select
async function fetchCreateFareTypes() {
  const res = await authFetch('https://www.passenger.lk/bus-owners/list-fare-types/');
  const fares = await res.json();
  document.getElementById('create_fare_type_id').innerHTML =
    fares.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  // set hidden name and preview initial
  syncCreateFareFields();
  document.getElementById('create_fare_type_id')
    .addEventListener('change', syncCreateFareFields);
}

// sync hidden fare_type_name
function syncCreateFareFields() {
  const sel = document.getElementById('create_fare_type_id');
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('create_fare_type_name_hidden').value = opt.text;
}

// —————— 3) Image preview ——————
document.getElementById('create_route_permit_image')
  .addEventListener('change', e => {
    const file = e.target.files[0];
    const img = document.getElementById('create_route_permit_image_preview');
    if (file) {
      img.src = URL.createObjectURL(file);
      img.style.display = 'block';
    } else {
      img.style.display = 'none';
    }
  });

// —————— 4) Create Bus handler ——————
document.getElementById('createButton').addEventListener('click', async () => {
  // pick up values
  const name = document.getElementById('create_bus_name').value;
  const num = document.getElementById('create_bus_number').value;
  const type = document.getElementById('create_bus_type').value;
  const seat = document.getElementById('create_seat_type').value;
  const permit = document.getElementById('create_route_permit_number').value;
  const imgEl = document.getElementById('create_route_permit_image_preview');
  const imgURL = imgEl.src || '';
  const fareId = document.getElementById('create_fare_type_id').value;
  const fareNm = document.getElementById('create_fare_type_name_hidden').value;

  // build payload
  const payload = {
    bus_name: name,
    bus_number: num,
    bus_type: type,
    seat_type: seat,
    route_permit_number: permit,
    route_permit_image: imgURL,
    fare_type_id: fareId,
    fare_type_name: fareNm
  };

  try {
    console.log('POST payload:', payload);
    const res = await authFetch(
      'https://www.passenger.lk/bus-owners/create-bus/',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );
    const body = await res.json();
    console.log('Create response:', body);
    if (!res.ok) throw new Error(body.error || res.status);

    showNotification('Bus created!');
    document.getElementById('createModal').classList.add('hidden');
    initBusUI();
  } catch (err) {
    console.error('Create failed:', err);
    showNotification('Error creating bus');
  }
});

// —————— 5) Kick it all off on page load ——————
document.addEventListener('DOMContentLoaded', () => {
  populateCreateDropdowns();
  fetchCreateFareTypes();
});
