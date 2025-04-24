document.addEventListener("DOMContentLoaded", () => {
    const elements = {
        roleSelect: document.getElementById("role"),
        doctorFields: document.getElementById("doctorFields"),
        patientFields: document.getElementById("patientFields"),
        registerBtn: document.getElementById("registerBtn"),
        registerForm: document.getElementById("registerForm"),
        emailField: document.getElementById("email"),
        passwordInput: document.getElementById("password"),
        confirmPasswordField: document.getElementById("confirmPassword"),
        phoneField: document.getElementById("phone"),
        otpSection: document.getElementById("otp-section"),
        otpInput: document.getElementById("otp-input"),
        resendOTPBtn: document.getElementById("resend-otp"),
        verifyOTPBtn: document.getElementById("verify-otp"),
        otpInputs: document.querySelectorAll('.otp-inputs input'),
        otpTimer: document.getElementById('otp-timer'),
        otpCountdown: document.getElementById('countdown'),
        otpEmail: document.getElementById('otp-email'),
        otpOverlay: document.getElementById('overlay')
    };
    let otpTimer, otpTimeLeft = 30;

    elements.roleSelect.addEventListener("change", toggleRoleFields);
    document.querySelectorAll("input, select").forEach(input => input.addEventListener("input", validateForm));
    elements.registerForm.addEventListener("submit", handleRegistration);
    elements.verifyOTPBtn.addEventListener("click", verifyOTP);

    function toggleRoleFields() {
        elements.doctorFields.classList.toggle("hidden", elements.roleSelect.value !== "doctor");
        elements.patientFields.classList.toggle("hidden", elements.roleSelect.value !== "patient");
        validateForm();
    }

    function validateForm() {
        const patterns = {
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            password: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            phone: /^\d{10}$/
        };
        let isValid = true;

        validateField(elements.emailField, patterns.email, "Invalid email format.");
        validateField(elements.passwordInput, patterns.password, "Password must have 8+ chars, uppercase, lowercase, number, special char.");
        validateField(elements.phoneField, patterns.phone, "Phone number must be 10 digits.");
        validateConfirmPassword();
        
        elements.registerBtn.disabled = !isValid;
    }

    function validateField(field, pattern, errorMsg) {
        if (!pattern.test(field.value.trim())) {
            showError(field, errorMsg);
            isValid = false;
        } else {
            clearError(field);
        }
    }

    function validateConfirmPassword() {
        if (elements.passwordInput.value !== elements.confirmPasswordField.value) {
            showError(elements.confirmPasswordField, "Passwords do not match.");
            isValid = false;
        } else {
            clearError(elements.confirmPasswordField);
        }
    }

    function showError(field, message) {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) errorElement.textContent = message;
        field.classList.add('error');
    }

    function clearError(field) {
        const errorElement = field.parentElement.querySelector('.error-message');
        if (errorElement) errorElement.textContent = '';
        field.classList.remove('error');
    }

    async function handleRegistration(event) {
        event.preventDefault();
        if (elements.registerBtn.disabled) return;
    
        const email = elements.emailField.value.trim();
        if (await checkUserExists(email)) {
            alert("User already exists. Redirecting to login.");
            window.location.href = "/login";
            return;
        }
    
        const formData = new FormData(elements.registerForm); // Collect form data
    
        try {
            const response = await fetch("/auth/register", {
                method: "POST",
                body: formData,
            });
    
            const data = await response.json(); // Parse the response JSON
    
            if (data.success) {
                showOTPModal(email);
                startOTPTimer();
            } else {
                alert(data.message || "Registration failed.");
            }
        } catch (error) {
            console.error("Network error:", error);
            alert("An error occurred during registration. Please try again.");
        }
    }
    

    function showOTPModal(email) {
        // Initialize OTP modal with email
        elements.otpEmail.textContent = email;
        elements.otpSection.classList.remove('hidden');
        elements.otpOverlay.style.display = 'block';
        elements.otpTimer.style.width = '100%';

        // Setup OTP input handling
        setupOTPInputs();
        startOTPTimer();
    }

    function setupOTPInputs() {
        elements.otpInputs.forEach((input, index) => {
            input.value = ''; // Clear previous values
            
            input.addEventListener('keyup', (e) => {
                if (e.key >= 0 && e.key <= 9) {
                    if (index < elements.otpInputs.length - 1) {
                        elements.otpInputs[index + 1].focus();
                    }
                    validateOTPInput();
                } else if (e.key === 'Backspace') {
                    if (index > 0) {
                        elements.otpInputs[index - 1].focus();
                    }
                }
            });

            input.addEventListener('paste', handleOTPPaste);
        });
    }

    function handleOTPPaste(e) {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').slice(0, 6);
        elements.otpInputs.forEach((input, index) => {
            if (index < pasteData.length) {
                input.value = pasteData[index];
            }
        });
        validateOTPInput();
    }

    function startOTPTimer() {
        otpTimeLeft = 30;
        elements.resendOTPBtn.classList.add('disabled');
        
        if (otpTimer) clearInterval(otpTimer);
        
        otpTimer = setInterval(() => {
            otpTimeLeft--;
            elements.otpCountdown.textContent = otpTimeLeft;
            elements.otpTimer.style.width = `${(otpTimeLeft/30) * 100}%`;

            if (otpTimeLeft <= 0) {
                clearInterval(otpTimer);
                elements.resendOTPBtn.classList.remove('disabled');
                document.getElementById('timer').style.display = 'none';
            }
        }, 1000);
    }

    function validateOTPInput() {
        const otp = Array.from(elements.otpInputs)
            .map(input => input.value)
            .join('');
        elements.verifyOTPBtn.disabled = otp.length !== 6;
        return otp;
    }
    // Ensure the otpInput element is correctly selected
const otpInput = document.getElementById("otp");

async function verifyOTP() {
    const otp = validateOTPInput();
    const email = elements.emailField.value;
    
    console.log('Attempting OTP verification:', { email, otpLength: otp?.length });

    if (!otp || otp.length !== 6) {
        alert('Please enter the complete 6-digit OTP');
        return;
    }

    try {
        const response = await fetch("/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: elements.emailField.value, otp }),
        });
    
        const data = await response.json();

        console.log('OTP verification response status:', response.status);
        
        console.log('OTP verification response:', data);

        if (data.success) {
            // First handle doctor notifications if needed
            if (elements.roleSelect.value === "doctor") {
                sendDoctorDetailsToAdmins(data.doctor);

            }

            // Clean up UI
            elements.otpOverlay.style.display = "none";
            elements.otpSection.classList.add("hidden");
            document.querySelector(".container").style.filter = "none";

            // Show success message and redirect
            const message = elements.roleSelect.value === "patient" 
                ? "Successfully registered!" 
                : "Application sent: Waiting for approval.";
                
            alert(message);
            window.location.replace("/login");
        } else {
            console.error('OTP verification failed:', data.message);
            alert(data.message || "OTP verification failed. Please try again.");
        }
    } catch (error) {
        console.error("Error during OTP verification:", error);
        alert("An error occurred while verifying OTP. Please try again.");
    }
}

    function sendDoctorDetailsToAdmins(doctor) {
        fetch("/admin/notify-doctors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doctor })
        });
    }

    function showSuccessMessage(role) {
        const message = role === "patient" 
            ? "Registration successful!" 
            : "Application submitted successfully! Awaiting admin approval.";
        alert(message);
    }

    async function checkUserExists(email) {
        const response = await fetch(`/auth/check-user?email=${email}`);
        const data = await response.json();
        return data.exists;
    }

    window.togglePassword = function (fieldId) {
        const passwordField = document.getElementById(fieldId);
        passwordField.type = passwordField.type === "password" ? "text" : "password";
    };
});
