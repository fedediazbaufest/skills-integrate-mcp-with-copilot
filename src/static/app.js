document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminStatus = document.getElementById("admin-status");
  const adminLoginToggle = document.getElementById("admin-login-toggle");
  const adminLogout = document.getElementById("admin-logout");
  const loginModal = document.getElementById("login-modal");
  const closeModalButton = document.getElementById("close-modal");
  const loginForm = document.getElementById("login-form");
  const adminRequiredNote = document.getElementById("admin-required-note");

  let adminToken = localStorage.getItem("adminToken") || "";
  let isTeacherLoggedIn = false;
  let teacherUsername = "";

  function authHeaders() {
    return adminToken ? { "X-Admin-Token": adminToken } : {};
  }

  function showMessage(type, text) {
    messageDiv.textContent = text;
    messageDiv.classList.add("message");
    messageDiv.classList.remove("success", "error", "info");
    if (type) {
      messageDiv.classList.add(type);
    }
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    if (isTeacherLoggedIn) {
      adminStatus.textContent = `Teacher: ${teacherUsername}`;
      adminLogout.classList.remove("hidden");
      adminRequiredNote.classList.add("hidden");
      signupForm.classList.remove("disabled");
      signupForm.querySelectorAll("input, select, button").forEach((el) => {
        el.disabled = false;
      });
    } else {
      adminStatus.textContent = "Student view";
      adminLogout.classList.add("hidden");
      adminRequiredNote.classList.remove("hidden");
      signupForm.classList.add("disabled");
      signupForm.querySelectorAll("input, select, button").forEach((el) => {
        el.disabled = true;
      });
    }
  }

  async function fetchAuthStatus() {
    try {
      const response = await fetch("/auth/status", {
        headers: authHeaders(),
      });
      const result = await response.json();
      isTeacherLoggedIn = result.logged_in === true;
      teacherUsername = result.username || "";

      if (!isTeacherLoggedIn) {
        adminToken = "";
        localStorage.removeItem("adminToken");
      }
    } catch (error) {
      isTeacherLoggedIn = false;
      teacherUsername = "";
      adminToken = "";
      localStorage.removeItem("adminToken");
    }
    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML =
        '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        isTeacherLoggedIn
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!isTeacherLoggedIn) {
      showMessage("error", "Only teachers can unregister students.");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage("success", result.message);

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage("error", result.detail || "An error occurred");
      }
    } catch (error) {
      showMessage("error", "Failed to unregister. Please try again.");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isTeacherLoggedIn) {
      showMessage("error", "Only teachers can register students.");
      return;
    }

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage("success", result.message);
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage("error", result.detail || "An error occurred");
      }
    } catch (error) {
      showMessage("error", "Failed to sign up. Please try again.");
      console.error("Error signing up:", error);
    }
  });

  adminLoginToggle.addEventListener("click", () => {
    loginModal.classList.remove("hidden");
  });

  closeModalButton.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginForm.reset();
  });

  adminLogout.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } finally {
      adminToken = "";
      localStorage.removeItem("adminToken");
      isTeacherLoggedIn = false;
      teacherUsername = "";
      updateAuthUI();
      fetchActivities();
      showMessage("info", "Teacher logged out.");
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        showMessage("error", result.detail || "Login failed");
        return;
      }

      adminToken = result.token;
      localStorage.setItem("adminToken", adminToken);
      await fetchAuthStatus();
      await fetchActivities();
      loginModal.classList.add("hidden");
      loginForm.reset();
      showMessage("success", `Welcome, ${result.username}.`);
    } catch (error) {
      showMessage("error", "Failed to login. Please try again.");
      console.error("Login error:", error);
    }
  });

  // Initialize app
  fetchAuthStatus().then(fetchActivities);
});
