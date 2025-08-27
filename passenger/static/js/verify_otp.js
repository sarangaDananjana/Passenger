import { setCookie, baseUrl } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const otpForm = document.getElementById('otpForm');
    const otpInputs = document.querySelectorAll('.otp-input');
    const submitBtn = document.querySelector('.submit-btn');

    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.textContent = 'Verifying...';
            submitBtn.disabled = true;

            // Combine the OTP digits from the input fields
            let otp = '';
            otpInputs.forEach(input => {
                otp += input.value;
            });

            // Retrieve the phone number from session storage (saved from the previous page)
            const phoneNumber = sessionStorage.getItem('phoneNumber');
            if (!phoneNumber) {
                alert('Phone number not found. Please go back and try again.');
                submitBtn.textContent = 'Verify';
                submitBtn.disabled = false;
                return;
            }

            try {
                // Send the OTP and phone number to your verification endpoint
                const res = await fetch(`${baseUrl}/bus-owners/verify-otp/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        phone_number: phoneNumber,
                        otp: otp
                    })
                });

                if (res.ok) {
                    const data = await res.json();

                    // Assuming the server responds with access and refresh tokens
                    if (data.access_token && data.refresh_token) {
                        // Use the setCookie function from auth.js to store the tokens
                        setCookie('access_token', data.access_token, 7);
                        setCookie('refresh_token', data.refresh_token, 30);

                        // Redirect to the dashboard upon successful login
                        window.location.href = '/bus-owners/web/dashboard/';
                    } else {
                        throw new Error('Tokens not found in response.');
                    }
                } else {
                    const errorData = await res.json();
                    alert(`Verification failed: ${errorData.detail || 'Invalid OTP'}`);
                }
            } catch (error) {
                console.error('An error occurred during OTP verification:', error);
                alert('An error occurred. Please try again.');
            } finally {
                submitBtn.textContent = 'Verify';
                submitBtn.disabled = false;
            }
        });
    }

    // Auto-focus logic for OTP inputs
    otpInputs.forEach((input, index) => {
        input.addEventListener('input', () => {
            // Ensure only numbers are entered and move to the next input
            input.value = input.value.replace(/[^0-9]/g, '');
            if (input.value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
        });

        input.addEventListener('keydown', (e) => {
            // Move to the previous input on backspace if the current input is empty
            if (e.key === 'Backspace' && !input.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
    });
});
