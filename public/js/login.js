document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const errorMsg = document.getElementById("error-msg");
    const successMsg = document.getElementById("success-msg");
    const statusIcon = document.getElementById("status-icon");

    if (loginForm) {
        loginForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const email = document.getElementById("email").value.trim();
            const password = document.getElementById("password").value.trim();

            if (!email || !password) {
                showError("Please enter both email and password.");
                return;
            }

            try {
                const response = await fetch("http://localhost:3000/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, password })
                });

                const data = await response.json();

                if (response.ok && data) {
                    showSuccess("Successfully logged in");
                    sessionStorage.setItem("token", data.token); // Store the token in sessionStorage

                    setTimeout(() => {
                        if (data.role === "patient") {
                            window.location.href = "/dashboard/patient";
                        } else if (data.role === "doctor" && data.approved) {
                            window.location.href = "/dashboard/doctor";
                        } else if (data.role === "admin") {
                            window.location.href = "/admin/dashboard";
                        } else {
                            showError("Admin approval required or invalid role.");
                        }
                    }, 1500);
                } else {
                    showError(data?.message || "Invalid credentials");
                }
            } catch (error) {
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
});

// Function to delete user
async function deleteUser(email) {
    try {
        const token = sessionStorage.getItem("token"); // Retrieve the token from sessionStorage

        if (!token) {
            console.error("User is not authenticated.");
            return;
        }

        const response = await fetch("/auth/delete-user", {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}` // Attach the token in the Authorization header
            },
            body: JSON.stringify({ email })
        });

        const data = await response.json();
        if (response.ok) {
            console.log("User deleted successfully:", data);
        } else {
            console.error("Failed to delete user:", data.error);
        }
    } catch (error) {
        console.error("Error:", error);
    }
}
