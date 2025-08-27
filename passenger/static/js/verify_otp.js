import { setCookie, baseUrl } from './auth.js';

// This file is now much cleaner as the OTP input logic is handled directly in the HTML.
// The main purpose of this script is to handle the form submission for OTP verification.

document.addEventListener('DOMContentLoaded', () => {
    // Find the main button on the page to attach the click event listener.
    // Note: It's better to use an ID for the button for more reliable selection.
    const verifyButton = document.querySelector("button[type='submit']");

    if (verifyButton) {
        verifyButton.addEventListener("click", async (e) => {
            e.preventDefault(); // Prevent default form submission behavior

            // Retrieve the phone number from localStorage (or sessionStorage).
            // Make sure this is being set correctly on the login page.
            const phoneNumber = localStorage.getItem("phone_number");
            if (!phoneNumber) {
                alert("Phone number not found. Please go back and login again.");
                return;
            }

            // Read all OTP digits from the input fields and combine them.
            const otp = Array.from({ length: 6 }, (_, i) =>
                document.getElementById(`otp${i + 1}`).value
            ).join("");

            // Basic validation to ensure a 6-digit OTP was entered.
            if (!/^\d{6}$/.test(otp)) {
                alert("Please enter a valid 6-digit OTP.");
                return;
            }

            try {
                // Send the verification request to the server.
                const response = await fetch(`${baseUrl}/bus-owners/verify-otp/`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        phone_number: phoneNumber,
                        otp_code: otp // Ensure your backend expects 'otp_code'
                    })
                });

                // Handle cases where the server returns an error.
                if (!response.ok) {
                    const err = await response.json();
                    alert("OTP verification failed: " + (err.detail || "Unknown error"));
                    return;
                }

                // On success, parse the JSON response.
                const data = await response.json();

                // ✅ Use the imported setCookie function to store tokens.
                // This is cleaner and more consistent with auth.js.
                setCookie('access_token', data.access, 7); // Set access token for 7 days
                setCookie('refresh_token', data.refresh, 30); // Set refresh token for 30 days


                // ✅ Redirect to the dashboard page after successful verification.
                window.location.href = "/bus-owners/web/dashboard/";

            } catch (err) {
                // Handle network or other unexpected errors.
                alert("A network error occurred: " + err.message);
            }
        });
    }
});
