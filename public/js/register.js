document.addEventListener("DOMContentLoaded", () => {
    const roleSelect = document.getElementById("role"); 
    const doctorFields = document.getElementById("doctorFields");
    const patientFields = document.getElementById("patientFields");
    const registerBtn = document.getElementById("registerBtn");
    const registerForm = document.getElementById("registerForm");

    const emailField = document.getElementById("email"); 
    const passwordInput = document.getElementById("password"); // Moved this declaration up

    const confirmPasswordField = document.getElementById("confirmPassword");
    const phoneField = document.getElementById("phone");

    const otpSection = document.getElementById("otp-section");
    const otpInput = document.getElementById("otp-input");
    const successMessage = document.getElementById("success-message");
    const resendOTPBtn = document.getElementById("resend-otp");
    const verifyOTPBtn = document.getElementById("verify-otp");

    let otpTimer;
    let otpTimeLeft = 60;

    // Show/hide fields based on role
    roleSelect.addEventListener("change", () => {
        doctorFields.classList.toggle("hidden", roleSelect.value !== "doctor");
        patientFields.classList.toggle("hidden", roleSelect.value !== "patient");
        validateForm();
    });

    // Toggle password visibility
    function togglePassword(fieldId) {
        const passwordField = document.getElementById(fieldId);
        passwordField.type = passwordField.type === "password" ? "text" : "password";
    }

    // Validate Form Fields
    function validateForm() {
        const email = emailField.value.trim();
        const password = passwordInput.value.trim();
        const confirmPassword = confirmPasswordField.value.trim();
        const phone = phoneField.value.trim();
        const role = roleSelect.value;

        // Regex patterns
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        const phonePattern = /^[0-9]{10,15}$/;

        let isValid = true;

        // Email validation
        if (!emailPattern.test(email)) {
            showError(emailField, "Invalid email format.");
            isValid = false;
        } else {
            clearError(emailField);
        }

        // Password validation
        passwordInput.addEventListener("input", function () {
            const password = passwordInput.value;
            const errorMessage = document.getElementById("password-error");

            const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

            if (!passwordPattern.test(password)) {
                showError(passwordInput, "Password must be at least 8 characters, include uppercase, lowercase, number, and special character.");
            } else {
                clearError(passwordInput);
            }
        });

        // Confirm password match
        if (password !== confirmPassword) {
            showError(confirmPasswordField, "Passwords do not match.");
            isValid = false;
        } else {
            clearError(confirmPasswordField);
        }

        // Phone number validation
        if (!phonePattern.test(phone)) {
            showError(phoneField, "Phone number should contain only digits and be between 10-15 characters.");
            isValid = false;
        } else {
            clearError(phoneField);
        }

        // Check file uploads
        if (role === "doctor") {
            isValid &= checkRequiredFiles(["licenseCertificate1", "boardIssuedDocument", "governmentIssuedId"]);
        } else if (role === "patient") {
            isValid &= checkRequiredFiles(["medicalFiles", "governmentIssuedIdPatient"]);
        }

        registerBtn.disabled = !isValid;
    }

    // Display error messages
    function showError(input, message) {
        const errorElement = input.nextElementSibling;
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.color = "red";
        }
    }

    // Clear error messages
    function clearError(input) {
        const errorElement = input.nextElementSibling;
        if (errorElement) {
            errorElement.textContent = "";
        }
    }

    // Check required file uploads
    function checkRequiredFiles(fileIds) {
        let allFilesPresent = true;
        fileIds.forEach(id => {
            const fileInput = document.getElementById(id);
            if (!fileInput.files.length) {
                showError(fileInput, "This file is required.");
                allFilesPresent = false;
            } else {
                clearError(fileInput);
            }
        });
        return allFilesPresent;
    }

    // Enable register button dynamically
    document.querySelectorAll("input, select").forEach(input => {
        input.addEventListener("input", validateForm);
    });

    // OTP Section - Show overlay modal instead of hiding form
    function showOTPModal() {
        document.querySelector(".container").style.filter = "blur(5px)";
        otpSection.classList.remove("hidden");
    }

    function hideOTPModal() {
        document.querySelector(".container").style.filter = "none";
        otpSection.classList.add("hidden");
    }

    // Register Form Submission
    registerForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        validateForm();
    
        if (registerBtn.disabled) {
            return;
        }
    
        const formData = new FormData(registerForm);
    
        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                body: formData
            });
    
            const data = await response.json();
            
            if (data.success) {
                showOTPModal();
                startOTPTimer();
            } else {
                alert(data.message || "Registration failed.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong. Please try again.");
        }
    });
    

    // Start OTP Resend Countdown
    function startOTPTimer() {
        otpTimeLeft = 60;
        resendOTPBtn.disabled = true;
        resendOTPBtn.textContent = `Resend OTP in ${otpTimeLeft}s`;

        otpTimer = setInterval(() => {
            otpTimeLeft--;
            resendOTPBtn.textContent = `Resend OTP in ${otpTimeLeft}s`;

            if (otpTimeLeft <= 0) {
                clearInterval(otpTimer);
                resendOTPBtn.disabled = false;
                resendOTPBtn.textContent = "Resend OTP";
            }
        }, 1000);
    }

    // Verify OTP (Backend Integration)
    verifyOTPBtn.addEventListener("click", async function () {
        const otp = otpInput.value.trim();
        if (!otp) {
            alert("Please enter the OTP.");
            return;
        }

        try {
            const response = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailField.value, otp })
            });

            const data = await response.json();
            if (data.success) {
                successMessage.style.display = "block";
                hideOTPModal();
                alert("Registration successful! Redirecting...");

                if (roleSelect.value === "patient") {
                    window.location.href = "/dashboard"; // Patient redirected to their dashboard
                } else if (roleSelect.value === "doctor") {
                    // Show "Waiting for Approval" message for doctors
                    alert("Registration successful! Waiting for approval.");
                    window.location.href = "/doctor/waiting"; // Redirect to waiting page for doctors
                    sendDoctorDetailsToAdmins(data.doctor); // Send doctor info to admins
                }
            } else {
                alert(data.message || "Invalid OTP.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Failed to verify OTP. Please try again.");
        }
    });

    // Resend OTP
    resendOTPBtn.addEventListener("click", async function () {
        if (otpTimeLeft > 0) return;

        try {
            const response = await fetch("/api/auth/resend-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailField.value })
            });

            const data = await response.json();
            if (data.success) {
                alert("New OTP sent to your email!");
                startOTPTimer();
            } else {
                alert(data.message || "Failed to resend OTP.");
            }
        } catch (error) {
            console.error("Error:", error);
            alert("Something went wrong. Please try again.");
        }
    });

    // Function to send doctor's details to admins
    function sendDoctorDetailsToAdmins(doctor) {
        fetch("/api/admin/notify-doctors", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ doctor })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log("Doctor details sent to admins.");
            } else {
                console.error("Failed to notify admins.");
            }
        })
        .catch(error => {
            console.error("Error notifying admins:", error);
        });
    }
});
