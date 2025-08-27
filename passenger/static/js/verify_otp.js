import { baseUrl } from './auth.js';


// Make helpers available to inline handlers when using type="module"
window.isNumberKey = function isNumberKey(evt) {
    const charCode = evt.which ? evt.which : evt.keyCode;
    return charCode >= 48 && charCode <= 57;
};


window.moveToNext = function moveToNext(current, nextFieldId) {
    if (current.value.length === 1) {
        document.getElementById(nextFieldId).focus();
    }
};


// Redirect target (absolute URL)
const VERIFY_REDIRECT_URL = 'https://www.passenger.lk/bus-owners/web/dashboard/';


// Handle OTP verification
document.getElementById('verifyBtn').addEventListener('click', async () => {
    const phoneNumber = localStorage.getItem('phone_number');
    if (!phoneNumber) {
        alert('Phone number not found. Please go back and login again.');
        return;
    }


    // Read OTP digits and form full code
    const otp = Array.from({ length: 6 }, (_, i) =>
        document.getElementById(`otp${i + 1}`).value
    ).join('');


    if (!/^\d{6}$/.test(otp)) {
        alert('Please enter a valid 6-digit OTP.');
        return;
    }


    // Optional: cookie helper if you want to inspect
    function getCookieValue(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }


    try {
        const response = await fetch(`${baseUrl}/bus-owners/verify-otp/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                phone_number: phoneNumber,
                otp_code: otp,
            }),
        });


        // Require explicit 200 for success
        if (response.status !== 200) {
            let errMsg = 'Unknown error';
            try {
                const err = await response.json();
                errMsg = err.detail || JSON.stringify(err);
            } catch { }
            alert('OTP verification failed: ' + errMsg);
            return;
        }


        const data = await response.json();


        // Store tokens in cookies (expires in 1 day)
        document.cookie = `access_token=${encodeURIComponent(data.access)}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `refresh_token=${encodeURIComponent(data.refresh)}; path=/; max-age=86400; SameSite=Lax`;


        // (Optional) debug
        console.log('All cookies:', document.cookie);
        console.log('Access Token:', getCookieValue('access_token'));
        console.log('Refresh Token:', getCookieValue('refresh_token'));


        // ✅ Redirect to the dashboard (absolute URL) and prevent back nav to OTP
        window.location.replace(VERIFY_REDIRECT_URL);
    } catch (err) {
        alert('Network error: ' + err.message);
    }
});