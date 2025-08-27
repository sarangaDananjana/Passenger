import { baseUrl } from './auth.js';
// Allow only numbers
function isNumberKey(evt) {
    const charCode = evt.which ? evt.which : evt.keyCode;
    return charCode >= 48 && charCode <= 57;
}

// Move to next input on entry
function moveToNext(current, nextFieldId) {
    if (current.value.length === 1) {
        document.getElementById(nextFieldId).focus();
    }
}

// Handle OTP verification
document.querySelector("button").addEventListener("click", async () => {
    const phoneNumber = localStorage.getItem("phone_number");
    if (!phoneNumber) {
        alert("Phone number not found. Please go back and login again.");
        return;
    }
    // You can get this from localStorage or previous page

    // Read OTP digits and form full code
    const otp = Array.from({ length: 6 }, (_, i) =>
        document.getElementById(`otp${i + 1}`).value
    ).join("");

    if (!/^\d{6}$/.test(otp)) {
        alert("Please enter a valid 6-digit OTP.");
        return;
    }

    // Optional: Parse and log individual token values
    function getCookieValue(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    try {
        const response = await fetch(`${baseUrl}/bus-owners/verify-otp/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                phone_number: phoneNumber,
                otp_code: otp
            })
        });

        if (!response.ok) {
            const err = await response.json();
            alert("OTP verification failed: " + (err.detail || "Unknown error"));
            return;
        }

        const data = await response.json();

        // ✅ Store tokens in cookies (expires in 1 day)
        document.cookie = `access_token=${encodeURIComponent(data.access)}; path=/; max-age=86400`;
        document.cookie = `refresh_token=${encodeURIComponent(data.refresh)}; path=/; max-age=86400`;

        const savedAccess = getCookieValue("access_token");
        const savedRefresh = getCookieValue("refresh_token");

        /* if (savedAccess && savedRefresh) {
           alert("Access and Refresh tokens saved successfully in cookies! 🎉");
         } else {
           alert("❌ Failed to save tokens in cookies.");
         }*/
        console.log("All cookies:", document.cookie);
        console.log("Access Token:", getCookieValue("access_token"));
        console.log("Refresh Token:", getCookieValue("refresh_token"));

        setTimeout(() => {
            console.log("Cookie Check:", document.cookie);
        }, 500);


        // ✅ Redirect to dashboard or success page
        window.location.href = "/bus-owners/web/dashboard/";

    } catch (err) {
        alert("Network error: " + err.message);
    }
});
