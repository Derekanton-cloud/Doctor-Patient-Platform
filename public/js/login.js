document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const errorMsg = document.getElementById("error-msg");
    const successMsg = document.getElementById("success-msg");
    const statusIcon = document.getElementById("status-icon");

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            // Get form values
            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value.trim();
            const role = document.getElementById("role").value;

            // Validate input
            if (!email || !password || !role) {
                showError("Please enter email, password, and select a role.");
                return;
            }

            try {
                // Show loading state
                showLoading("Logging in...");

                const response = await fetch("/auth/login", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    body: JSON.stringify({ email, password, role })
                });

                const data = await response.json();

                // Handle different response statuses
                switch (response.status) {
                    case 200:
                        if (data.showOtpModal) {
                            showInfo("OTP sent to your email. Please verify.");
                            showOTPModal();
                            return;
                        }

                        if (data.status === "success") {
                            // Store user data and token
                            sessionStorage.setItem("token", data.token);
                            sessionStorage.setItem("user", JSON.stringify(data.user));

                            // Add after storing the token in sessionStorage
                            console.log("Token stored:", sessionStorage.getItem("token"));
                            console.log("User stored:", sessionStorage.getItem("user"));

                            showSuccess(data.message || "Successfully logged in");

                            // Redirect after delay
                            setTimeout(() => {
                                if (data.redirect) {
                                    window.location.href = data.redirect;
                                } else {
                                    showError("Invalid redirection path.");
                                }
                            }, 1500);
                        }
                        break;

                    case 403:
                        showError(data.error || "Account pending approval");
                        break;

                    case 400:
                        showError(data.error || "Invalid credentials");
                        break;

                    default:
                        showError("An unexpected error occurred");
                }
            } catch (error) {
                console.error("Login Error:", error);
                showError("Server error. Please try again later.");
            }
        });
    }

    function showSuccess(message) {
        statusIcon.className = "green-tick";
        successMsg.textContent = message;
        successMsg.style.display = "block";
        errorMsg.style.display = "none";
    }

    function showError(message) {
        statusIcon.className = "red-cross";
        errorMsg.textContent = message;
        errorMsg.style.display = "block";
        successMsg.style.display = "none";
    }

    function showInfo(message) {
        statusIcon.className = "blue-info";
        successMsg.textContent = message;
        successMsg.style.display = "block";
        errorMsg.style.display = "none";
    }

    function showLoading(message) {
        statusIcon.className = "loading";
        successMsg.textContent = message;
        successMsg.style.display = "block";
        errorMsg.style.display = "none";
    }

    function showOTPModal() {
        const otpSection = document.getElementById("otp-section");
        if (otpSection) {
            otpSection.classList.remove("hidden");
            // Focus on first OTP input if exists
            const firstOtpInput = otpSection.querySelector('input[type="text"]');
            if (firstOtpInput) {
                firstOtpInput.focus();
            }
        }
    }
});