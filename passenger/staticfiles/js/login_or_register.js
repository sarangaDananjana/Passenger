import { refreshTokens } from './auth.js'; // ✅ adjust this path as needed

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
        const response = await fetch('http://127.0.0.1:8000/bus-owners/register-or-login/', {
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
            window.location.href = 'https://www.passenger.lk/bus-owners/web/verify-otp/';
        } else {
            const errorData = await response.json();
            alert('Login failed: ' + (errorData.message || 'Unknown error'));
        }
    } catch (err) {
        alert('Network error: ' + err.message);
    }
});
