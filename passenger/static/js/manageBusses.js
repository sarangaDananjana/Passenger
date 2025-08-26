import { authFetch, baseUrl } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  // Add this function call to make the sidebar toggle work
  setupSidebar();
  populateStaticDropdowns();
  showSkeletons(3);
  setTimeout(initBusUI, 1000);
  fetchFareTypes();
});

// This function is now needed here for the toggle button
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

function showSkeletons(count = 3) {
  const container = document.querySelector('.bus-list');
  if (!container) return;
  container.innerHTML = Array.from({ length: count }).map(() => `
    <div class="bus-card">
      <div class="bus-header">
        <div class="skeleton skel-title"></div>
        <div class="skeleton skel-subtitle"></div>
      </div>
      <div class="bus-body">
        <div class="bus-field"><dt><div class="skeleton skel-field" style="width: 50%;"></div></dt><dd><div class="skeleton skel-field"></div></dd></div>
        <div class="bus-field"><dt><div class="skeleton skel-field" style="width: 50%;"></div></dt><dd><div class="skeleton skel-field"></div></dd></div>
        <div class="bus-field"><dt><div class="skeleton skel-field" style="width: 50%;"></div></dt><dd><div class="skeleton skel-field"></div></dd></div>
        <div class="bus-field"><dt><div class="skeleton skel-field" style="width: 50%;"></div></dt><dd><div class="skeleton skel-field"></div></dd></div>
        <div class="bus-field"><dt><div class="skeleton skel-field" style="width: 50%;"></div></dt><dd><div class="skeleton skel-field"></div></dd></div>
        <div class="bus-field"><dt><div class="skeleton skel-field" style="width: 50%;"></div></dt><dd><div class="skeleton skel-field"></div></dd></div>
      </div>
    </div>
  `).join('');
}

async function loadBusDetails() {
  try {
    const getRes = await authFetch(`${baseUrl}/bus-owners/owner-details/`);
    if (!getRes.ok) throw new Error(`GET failed: ${getRes.status}`);
    const data = await getRes.json();

    const companyNameEl = document.getElementById('companyName');
    if (companyNameEl) companyNameEl.textContent = data.company_name;

    if (!data.buses || data.buses.length === 0) return [];

    const payload = { ids: data.buses.map(b => b.bus_id) };

    const postRes = await authFetch(`${baseUrl}/bus-owners/owner-buses/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!postRes.ok) throw new Error(`POST failed: ${postRes.status}`);

    return await postRes.json();
  } catch (err) {
    console.error('Error loading bus details:', err);
    return [];
  }
}

async function initBusUI() {
  try {
    const buses = await loadBusDetails();
    renderBusCards(buses);
  } catch (err) {
    console.error('Could not initialize bus UI:', err);
    const container = document.querySelector('.bus-list');
    if (container) container.innerHTML = '<p>Could not load bus information. Please try again later.</p>';
  }
}

function renderBusCards(buses) {
  const container = document.querySelector('.bus-list');
  if (!container) return;

  if (buses.length === 0) {
    container.innerHTML = '<p>No buses found. Click the "+" button to add your first bus.</p>';
    return;
  }

  container.innerHTML = buses.map(bus => {
    const approved = bus.is_approved;
    const statusClass = approved ? 'status-approved' : 'status-pending';
    const statusText = approved ? 'Approved' : 'Pending Review';
    const machineText = bus.is_machine_connected ? 'On a Trip' : 'Idle';

    return `
      <div class="bus-card" data-bus-id="${bus._id}">
        <div class="bus-header">
          <div class="bus-title">${bus.bus_name || 'N/A'}</div>
          <div class="bus-number">${bus.bus_number || 'N/A'}</div>
        </div>
        <dl class="bus-body">
          <div class="bus-field">
            <dt>Bus Type</dt>
            <dd>${bus.bus_type || 'N/A'}</dd>
          </div>
          <div class="bus-field">
            <dt>Current Status</dt>
            <dd>${machineText}</dd>
          </div>
          <div class="bus-field">
            <dt>Seat Type</dt>
            <dd>${bus.seat_type || 'N/A'}</dd>
          </div>
          <div class="bus-field">
            <dt>Fare Type</dt>
            <dd>${bus.fare_type_name || 'N/A'}</dd>
          </div>
          <div class="bus-field ${statusClass}">
            <dt>Approval Status</dt>
            <dd>${statusText}</dd>
          </div>
        </dl>
      </div>
    `;
  }).join('');
  attachBusCardListeners();
}

const BUS_TYPES = ["Luxury", "Semi-Luxury", "Normal"];
const SEAT_TYPES = ["22 - Seater", "32 - Seater", "49 - Seater", "54 - Seater"];

async function fetchFareTypes() {
  try {
    const res = await authFetch(`${baseUrl}/bus-owners/list-fare-types/`);
    if (!res.ok) throw new Error('Failed to load fare types');
    const fares = await res.json();

    const createSelect = document.getElementById('create_fare_type_id');
    const editSelect = document.getElementById('fare_type_name_select');

    const optionsHtml = fares.map(f => `<option value="${f.id}">${f.name}</option>`).join('');

    if (createSelect) createSelect.innerHTML = optionsHtml;
    if (editSelect) editSelect.innerHTML = fares.map(f => `<option value="${f.name}">${f.name}</option>`).join('');

    if (createSelect) createSelect.addEventListener('change', syncCreateFareFields);
    if (editSelect) editSelect.addEventListener('change', () => {
      const selectedOption = editSelect.options[editSelect.selectedIndex];
      const correspondingFare = fares.find(f => f.name === selectedOption.value);
      if (correspondingFare) {
        document.getElementById('fare_type_id').value = correspondingFare.id;
        document.getElementById('fare_type_name_hidden').value = correspondingFare.name;
      }
    });

    syncCreateFareFields();
  } catch (err) {
    console.error(err);
  }
}

function populateStaticDropdowns() {
  const createBusType = document.getElementById('create_bus_type');
  const editBusType = document.getElementById('bus_type');
  if (createBusType) createBusType.innerHTML = BUS_TYPES.map(v => `<option>${v}</option>`).join('');
  if (editBusType) editBusType.innerHTML = BUS_TYPES.map(v => `<option>${v}</option>`).join('');

  const createSeatType = document.getElementById('create_seat_type');
  const editSeatType = document.getElementById('seat_type');
  if (createSeatType) createSeatType.innerHTML = SEAT_TYPES.map(v => `<option>${v}</option>`).join('');
  if (editSeatType) editSeatType.innerHTML = SEAT_TYPES.map(v => `<option>${v}</option>`).join('');
}

function syncCreateFareFields() {
  const sel = document.getElementById('create_fare_type_id');
  if (!sel || sel.selectedIndex < 0) return;
  const opt = sel.options[sel.selectedIndex];
  document.getElementById('create_fare_type_name_hidden').value = opt.text;
}

function attachBusCardListeners() {
  document.querySelectorAll('.bus-card').forEach(card => {
    card.addEventListener('click', async () => {
      const busId = card.dataset.busId;
      try {
        const res = await authFetch(`${baseUrl}/bus-owners/get-bus/?bus_id=${busId}`);
        if (!res.ok) throw new Error('Failed to load bus details');
        const bus = await res.json();

        if (bus.is_approved) {
          showNotification('Approved buses cannot be edited.');
          return;
        }
        openModal(bus);
      } catch (err) {
        console.error(err);
        showNotification('Error loading details');
      }
    });
  });
}

function showNotification(message) {
  let n = document.getElementById('notification');
  if (!n) {
    n = document.createElement('div');
    n.id = 'notification';
    n.style = `position: fixed; bottom: -100px; left: 50%; transform: translateX(-50%); background: var(--bg-card); color: var(--text-primary); padding: 1rem 1.5rem; border-radius: 12px; box-shadow: 0 4px 12px var(--shadow); z-index: 1100; transition: bottom 0.3s ease-out;`;
    document.body.appendChild(n);
  }
  n.textContent = message;
  setTimeout(() => { n.style.bottom = '2rem'; }, 10);
  setTimeout(() => { n.style.bottom = '-100px'; }, 3000);
}

function openModal(bus) {
  const overlay = document.getElementById('modalOverlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  document.getElementById('bus_id').value = bus._id;
  document.getElementById('bus_name').value = bus.bus_name;
  document.getElementById('bus_number').value = bus.bus_number;
  document.getElementById('bus_type').value = bus.bus_type;
  document.getElementById('seat_type').value = bus.seat_type;
  document.getElementById('route_permit_number').value = bus.route_permit_number;

  document.getElementById('fare_type_id').value = bus.fare_type_id;
  document.getElementById('fare_type_name_select').value = bus.fare_type_name;
  document.getElementById('fare_type_name_hidden').value = bus.fare_type_name;

  document.getElementById('file_name_display').textContent = bus.route_permit_image ? 'A permit is already uploaded.' : '';
  document.getElementById('route_permit_image').value = '';
}

document.getElementById('modalClose')?.addEventListener('click', () => {
  document.getElementById('modalOverlay').classList.add('hidden');
});

document.getElementById('saveButton')?.addEventListener('click', async () => {
  const form = document.getElementById('busForm');
  const fd = new FormData(form);

  const fareSelect = document.getElementById('fare_type_name_select');
  const selectedFareName = fareSelect.value;
  const fareId = document.getElementById('fare_type_id').value;
  fd.set('fare_type_name', selectedFareName);
  fd.set('fare_type_id', fareId);

  try {
    const res = await authFetch(`${baseUrl}/bus-owners/update-bus/`, { method: 'PATCH', body: fd });
    if (!res.ok) {
      const errorBody = await res.json();
      throw new Error(errorBody.detail || `Update failed: ${res.status}`);
    }
    showNotification('Bus updated successfully!');
    document.getElementById('modalOverlay').classList.add('hidden');
    initBusUI();
  } catch (err) {
    console.error('Update error:', err);
    showNotification(`Error: ${err.message}`);
  }
});

document.getElementById('addBusBtn')?.addEventListener('click', () => {
  document.getElementById('createModal').classList.remove('hidden');
});
document.getElementById('createClose')?.addEventListener('click', () => {
  document.getElementById('createModal').classList.add('hidden');
});

document.getElementById('create_route_permit_image')?.addEventListener('change', e => {
  const file = e.target.files[0];
  const img = document.getElementById('create_route_permit_image_preview');
  if (file && img) {
    img.src = URL.createObjectURL(file);
    img.style.display = 'block';
  } else if (img) {
    img.style.display = 'none';
  }
});

document.getElementById('createButton')?.addEventListener('click', async () => {
  const form = document.getElementById('createForm');
  const fd = new FormData(form);

  try {
    const res = await authFetch(`${baseUrl}/bus-owners/create-bus/`, { method: 'POST', body: fd });
    const body = await res.json();
    if (!res.ok) throw new Error(body.detail || `Create failed: ${res.status}`);

    showNotification('Bus created successfully! Awaiting approval.');
    document.getElementById('createModal').classList.add('hidden');
    form.reset();
    document.getElementById('create_route_permit_image_preview').style.display = 'none';
    initBusUI();
  } catch (err) {
    console.error('Create failed:', err);
    showNotification(`Error: ${err.message}`);
  }
});