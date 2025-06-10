import { cleanupChat } from "./chat.js";

// Authentication check function
export async function isAuthenticated() {
  return fetch("/api/check-auth", {
    credentials: "include",
  })
    .then((response) => {
      if (response.ok) {
        return response.json().then((data) => {
          return true;
        });
      }
      return false;
    })
    .catch(() => false);
}

// Logout function
export function logout() {
  return fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
}

// Add global sidebar for online users
function addGlobalSidebar() {
  // Check if sidebar already exists
  if (document.getElementById("global-online-sidebar")) {
    console.log("ℹ️ Global sidebar already exists");
    return;
  }

  console.log("✅ Adding global sidebar");
  const sidebar = document.createElement("div");
  sidebar.id = "global-online-sidebar";
  sidebar.innerHTML = `
    <div class="global-sidebar-content">
      <h3>Online Users</h3>
      <ul id="global-user-list"></ul>
    </div>
  `;

  // Add CSS styles
  sidebar.style.cssText = `
    position: fixed;
    right: 0;
    top: 60px;
    width: 200px;
    height: calc(100vh - 60px);
    background: #f5f5f5;
    border-left: 1px solid #ddd;
    padding: 15px;
    overflow-y: auto;
    z-index: 1000;
    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
  `;

  // Style the content
  const style = document.createElement("style");
  style.textContent = `
    .global-sidebar-content h3 {
      margin-top: 0;
      color: #333;
      font-size: 16px;
      border-bottom: 1px solid #ddd;
      padding-bottom: 10px;
    }
    
    #global-user-list {
      list-style: none;
      padding: 0;
      margin: 10px 0;
    }
    
    #global-user-list li {
      margin-bottom: 8px;
    }
    
    #global-user-list .user-btn {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      background: #6366f1;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s;
    }
    
    #global-user-list .user-btn:hover {
      background: #e9e9e9;
      border-color: #6366f1;
    }
    
    #global-user-list .user-btn.new-message {
      background: #6366f1;
      color: white;
      font-weight: bold;
    }
    
    /* Adjust main content to make room for sidebar */
    body {
      margin-right: 220px;
    }
    
    @media (max-width: 768px) {
      #global-online-sidebar {
        display: none;
      }
      body {
        margin-right: 0;
      }
    }
  `;

  if (!document.getElementById("global-sidebar-styles")) {
    style.id = "global-sidebar-styles";
    document.head.appendChild(style);
  }

  document.body.appendChild(sidebar);
}

// Remove global sidebar
function removeGlobalSidebar() {
  const sidebar = document.getElementById("global-online-sidebar");
  if (sidebar) {
    sidebar.remove();
    console.log("🗑️ Global sidebar removed");
  }

  const styles = document.getElementById("global-sidebar-styles");
  if (styles) {
    styles.remove();
  }

  // Reset body margin
  document.body.style.marginRight = "0";
}

// Navigation management - Updated to include global sidebar
export async function updateNavigation(router) {
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
      <button id="logoutBtn">Logout</button>
    `;

    // Add global online users sidebar to body if not exists
    addGlobalSidebar();

    // Add logout handler
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await logout();
        // Clean up chat connections and data
        cleanupChat();
        // Remove global sidebar
        removeGlobalSidebar();

        router.navigateTo("/");
        updateNavigation(router);
      });
    }
  } else {
    nav.innerHTML = `
      <a href="#/" data-page="/">Home</a>
      <a href="#signup" data-page="signup">Sign Up</a>
      <a href="#login" data-page="login">Login</a>
    `;

    // Remove global sidebar when not authenticated
    removeGlobalSidebar();
  }
}

// Handle full logout process including cleanup
export async function handleLogout(router) {
  try {
    await logout();
    // Clean up chat connections and data
    cleanupChat();
    // Remove global sidebar
    removeGlobalSidebar();

    // Navigate to home and update navigation
    router.navigateTo("/");
    updateNavigation(router);

    console.log("✅ Logout completed successfully");
  } catch (error) {
    console.error("❌ Error during logout:", error);
  }
}
