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
    };
    let otpTimer, otpTimeLeft = 60;

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
                showOTPModal();
                startOTPTimer();
            } else {
                alert(data.message || "Registration failed.");
            }
        } catch (error) {
            console.error("Network error:", error);
            alert("An error occurred during registration. Please try again.");
        }
    }
    

    function showOTPModal() {
        // Blur the registration page
        document.querySelector(".container").style.filter = "blur(5px)";
    
        // Show the overlay
        document.getElementById("overlay").classList.remove("hidden");
    
        // Show the OTP modal
        document.getElementById("otp-section").classList.remove("hidden");
    }

    function startOTPTimer() {
        otpTimeLeft = 60;
        elements.resendOTPBtn.disabled = true;
        elements.resendOTPBtn.textContent = `Resend OTP in ${otpTimeLeft}s`;
        otpTimer = setInterval(() => {
            otpTimeLeft--;
            elements.resendOTPBtn.textContent = `Resend OTP in ${otpTimeLeft}s`;
            if (otpTimeLeft <= 0) {
                clearInterval(otpTimer);
                elements.resendOTPBtn.disabled = false;
                elements.resendOTPBtn.textContent = "Resend OTP";
            }
        }, 1000);
    }

    // Ensure the otpInput element is correctly selected
const otpInput = document.getElementById("otp");

async function verifyOTP() {
  const otp = otpInput?.value.trim(); // Use optional chaining to avoid null errors
  if (!otp) return alert("Please enter the OTP.");

  try {
    const response = await fetch("/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: elements.emailField.value, otp }),
    });

    const data = await response.json();

    if (data.success) {
        alert(elements.roleSelect.value === "patient" ? "Successfully registered!" : "Application sent: Waiting for approval.");
        window.location.href = elements.roleSelect.value === "patient" ? "/dashboard" : "/";
        document.querySelector(".container").style.filter = "none";
        document.getElementById("overlay").classList.add("hidden");
        document.getElementById("otp-section").classList.add("hidden");
        if (elements.roleSelect.value === "doctor") sendDoctorDetailsToAdmins(data.doctor);
    } else {
      alert(data.message || "OTP verification failed.");
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
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
