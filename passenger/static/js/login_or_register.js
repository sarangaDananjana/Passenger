import { refreshTokens, baseUrl } from './auth.js'; // Import DEBUG value



// Attempt refresh token on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        await refreshTokens();
        // ✅ Redirect if token refresh succeeded
        window.location.href = '/bus-owners/web/dashboard/';
    } catch (err) {
        console.log('No valid refresh token. Staying on login.');
    }
});

// Set the API base URL based on the DEBUG value from auth.js


// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const phoneInput = document.getElementById('phone_number');
    const phone = phoneInput.value.trim();

    // Basic client-side check
    if (!/^\d{10}$/.test(phone)) {
        document.getElementById('phone_numberError').textContent = 'Enter a valid 10-digit number.';
        return;
    } else {
        document.getElementById('phone_numberError').textContent = ''; // Clear error
    }

    try {
        const response = await fetch(`${baseUrl}/bus-owners/register-or-login/`, { // Use dynamic baseUrl
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                role: 'OWNER',
                phone_number: phone
            })
        });

        if (response.ok) {
            const results = await response.json();
            console.log('Login success:', results);
            localStorage.setItem('phone_number', phone);
            window.location.href = `${baseUrl}/bus-owners/web/verify-otp/`; // Use dynamic baseUrl
        } else {
            const errorData = await response.json();
            alert('Login failed: ' + (errorData.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
});
