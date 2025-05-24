// Fixed app.js with proper posts integration
import { Router } from "./router.js";
import { setupPostsPage, setupPostDetailsPage } from "./posts.js";

document.addEventListener("DOMContentLoaded", () => {
  const router = new Router();

  // Home route (landing page)
  router.addRoute("/", "homeTemplate");

  // Auth routes
  router.addRoute("signup", "signupTemplate", () => {
    setupSignupForm(router);
  });

  router.addRoute("login", "loginTemplate", () => {
    setupLoginForm(router);
  });

  // Posts route - FIXED: Only defined once
  router.addRoute("posts", "postsTemplate", () => {
    // Check authentication first
    isAuthenticated().then((auth) => {
      if (!auth) {
        router.navigateTo("login");
      } else {
        // Set up the posts page
        setupPostsPage();
      }
    });
  });

  // Post details route (for individual posts)
  router.addRoute("post/:id", "postDetailsTemplate", (params) => {
    isAuthenticated().then((auth) => {
      if (!auth) {
        router.navigateTo("login");
      } else {
        setupPostDetailsPage(params.id);
      }
    });
  });

  // Start router and update navigation
  router.start();
  updateNavigation(router);
});

// Auth functions
function isAuthenticated() {
  // Check with the server if the session is valid
  return fetch("/api/check-auth", {
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false);
}

function logout() {
  return fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
}

async function updateNavigation(router) {
  console.log("Updating navigation...");
  const nav = document.querySelector("nav");
  if (!nav) {
    console.error("Navigation element not found");
    return;
  }

  const isLoggedIn = await isAuthenticated();
  console.log("User logged in:", isLoggedIn);

  if (isLoggedIn) {
    nav.innerHTML = `
      <a href="#posts" data-page="posts">Posts</a>
      <a href="#profile" data-page="profile">Profile</a>
      <button id="logoutBtn">Logout</button>
    `;

    // Add logout handler
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      router.navigateTo("/");
      updateNavigation(router);
    });
  } else {
    nav.innerHTML = `
      <a href="#/" data-page="/">Home</a>
      <a href="#signup" data-page="signup">Sign Up</a>
      <a href="#login" data-page="login">Login</a>
    `;
  }
}

function setupSignupForm(router) {
  console.log("Setting up signup form");
  const form = document.querySelector("#form");

  if (!form) {
    console.error("Signup form not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Form submitted");

    // Create FormData object directly from form
    const formData = new FormData(form);

    // Log all form fields (except password)
    console.log("Form data collected:");
    for (const [name, value] of formData.entries()) {
      if (name !== "password" && name !== "confirmPassword") {
        console.log(` ${name}: ${value}`);
      } else {
        console.log(` ${name}: [HIDDEN]`);
      }
    }

    try {
      const response = await fetch("/signup", {
        method: "POST",
        body: formData,
      });

      const result = await response.text();
      console.log("Server response:", result);

      if (response.ok) {
        showMessage("Signup successful! Redirecting to login...", false);

        // Redirect to login after successful signup
        setTimeout(() => {
          router.navigateTo("login");
        }, 2000);
      } else {
        showMessage(result || "Signup failed", true);
      }
    } catch (error) {
      console.error("Error during signup:", error);
      showMessage("An error occurred. Please try again.", true);
    }
  });
}

function setupLoginForm(router) {
  console.log("Setting up login form");
  const form = document.querySelector("#loginForm");

  if (!form) {
    console.error("Login form not found");
    return;
  }

  // Handle login type toggle
  const nicknameRadio = form.querySelector("#nicknameRadio");
  const emailRadio = form.querySelector("#emailRadio");
  const nicknameInput = form.querySelector("#nicknameInput");
  const emailInput = form.querySelector("#emailInput");

  if (nicknameRadio && emailRadio) {
    // Set default selection
    nicknameRadio.checked = true;
    emailInput.style.display = "none";

    nicknameRadio.addEventListener("change", () => {
      nicknameInput.style.display = "block";
      emailInput.style.display = "none";
    });

    emailRadio.addEventListener("change", () => {
      nicknameInput.style.display = "none";
      emailInput.style.display = "block";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Login form submitted");

    try {
      // Get form data manually to ensure correct values
      const loginTypeElement = form.querySelector(
        'input[name="loginType"]:checked'
      );

      if (!loginTypeElement) {
        showMessage("Please select login type (Nickname or Email)", true);
        return;
      }

      const loginType = loginTypeElement.value;
      console.log("Login type selected:", loginType);

      const nickname =
        loginType === "nickname"
          ? form.querySelector("#nickname").value.trim()
          : "";
      const email =
        loginType === "email" ? form.querySelector("#email").value.trim() : "";
      const password = form.querySelector("#password").value;

      console.log("Form values:", {
        loginType,
        nickname: nickname ? "✓" : "",
        email: email ? "✓" : "",
        password: password ? "✓" : "",
      });

      // Validation
      if (loginType === "nickname" && !nickname) {
        showMessage("Nickname is required", true);
        return;
      }

      if (loginType === "email" && !email) {
        showMessage("Email is required", true);
        return;
      }

      if (!password) {
        showMessage("Password is required", true);
        return;
      }

      // Use URL-encoded form data since that's what the server expects
      const formData = new URLSearchParams();
      formData.append("loginType", loginType);
      formData.append("nickname", nickname);
      formData.append("email", email);
      formData.append("password", password);

      console.log("Sending data to server:", formData.toString());

      const response = await fetch("/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
      });

      const result = await response.text();
      console.log("Server response:", result);

      if (response.ok) {
        showMessage("Login successful! Redirecting...", false);

        // Important: Update navigation BEFORE redirecting
        await updateNavigation(router);

        // Redirect to posts page after successful login
        setTimeout(() => {
          router.navigateTo("posts");
        }, 1500);
      } else {
        showMessage(result || "Login failed", true);
      }
    } catch (error) {
      console.error("Error during login:", error);
      showMessage("An error occurred. Please try again.", true);
    }
  });
}

function showMessage(message, isError = true) {
  // Remove any existing message
  const existingMsg = document.querySelector(".message");
  if (existingMsg) existingMsg.remove();

  // Create message element
  const msgElement = document.createElement("div");
  msgElement.className = `message ${isError ? "error" : "success"}`;
  msgElement.textContent = message;

  // Style the message
  msgElement.style.padding = "10px";
  msgElement.style.margin = "10px 0";
  msgElement.style.borderRadius = "5px";

  if (isError) {
    msgElement.style.backgroundColor = "#ffdddd";
    msgElement.style.color = "#ff0000";
    msgElement.style.border = "1px solid #ff0000";
  } else {
    msgElement.style.backgroundColor = "#ddffdd";
    msgElement.style.color = "#008800";
    msgElement.style.border = "1px solid #008800";
  }

  // Add to the appropriate form
  const currentPage = window.location.hash.substring(1);
  if (currentPage === "signup") {
    const form = document.getElementById("form");
    if (form)
      form
        .querySelector('button[type="submit"]')
        .insertAdjacentElement("beforebegin", msgElement);
  } else if (currentPage === "login") {
    const form = document.querySelector("#loginForm");
    if (form)
      form
        .querySelector('button[type="submit"]')
        .insertAdjacentElement("beforebegin", msgElement);
  }

  // Auto dismiss success messages
  if (!isError) {
    setTimeout(() => {
      msgElement.remove();
    }, 5000);
  }
}

// Register event listeners for navigation links
document.addEventListener("click", (e) => {
  if (e.target.matches("[data-page]")) {
    e.preventDefault();
    const page = e.target.getAttribute("data-page");
    window.location.hash = page;
  }
});

// WebSocket for real-time updates
function setupWebSocket() {
  const socket = new WebSocket(`wss://${window.location.host}/ws`);

  socket.onmessage = (event) => {
    if (event.data === "presence_update") {
      // Update online users if we're on posts page
      if (window.location.hash === "#posts") {
        updateOnlineUsers();
      }
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return socket;
}

// Set up WebSocket connection
const socket = setupWebSocket();

// Function to update online users (used by WebSocket)
function updateOnlineUsers() {
  fetch("/api/online-users", { credentials: "include" })
    .then((response) => response.json())
    .then((users) => {
      const list = document.getElementById("onlineUsersList");
      if (list) {
        list.innerHTML = users
          .map(
            (user) =>
              `<li class="online-user" data-nickname="${user}">${user}</li>`
          )
          .join("");
      }
    })
    .catch((err) => {
      console.error("Error fetching online users:", err);
    });
}
