import { authFetch, baseUrl } from './auth.js';
const apiUrl = `${baseUrl}/bus-owners/owner-details/`; // replace this

let isVerified = false;

async function fetchOwnerData() {
    const response = await authFetch(apiUrl);
    const data = await response.json();

    document.getElementById("phone_number").value = data.phone_number;
    document.getElementById("company_name").value = data.company_name;
    document.getElementById("company_address").value = data.company_address;
    document.getElementById("company_number").value = data.company_number;
    document.getElementById("company_registration_number").value = data.company_registration_number;
    document.getElementById("company_owner_name").value = data.company_owner_name;

    isVerified = data.is_verified;

    if (isVerified) {
        document.getElementById("verified-badge").classList.remove("hidden");
        enableEditFeatures();
    }

    const busContainer = document.getElementById("buses-container");
    data.buses.forEach(bus => {
        const div = document.createElement("div");
        div.className = "bus-group";
        div.innerHTML = `
      <strong class="bus-name">${bus.bus_name}</strong><br>
      <strong class="bus-number">${bus.bus_number}</strong><br>

    `;
        busContainer.appendChild(div);
    });
}

function enableEditFeatures() {
    const editIcons = document.querySelectorAll(".edit-icon");
    const saveBtn = document.getElementById("save-button");

    editIcons.forEach(icon => {
        icon.classList.remove("hidden");
        icon.addEventListener("click", () => {
            const input = icon.previousElementSibling;
            input.disabled = false;
            input.focus();
            saveBtn.classList.remove("hidden");
        });
    });
}

document.getElementById("save-button").addEventListener("click", async () => {
    const updatedData = {
        company_name: document.getElementById("company_name").value,
        company_address: document.getElementById("company_address").value,
        company_number: document.getElementById("company_number").value,
        company_registration_number: document.getElementById("company_registration_number").value,
        company_owner_name: document.getElementById("company_owner_name").value
    };

    const response = await authFetch(apiUrl, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(updatedData)
    });

    if (response.ok) {
        alert("Changes saved successfully!");
    } else {
        alert("Failed to save changes.");
    }
});

window.onload = fetchOwnerData;
