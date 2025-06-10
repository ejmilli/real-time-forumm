import { Router } from "./router.js";
import { setupPostsPage, setupPostDetailsPage } from "./posts.js";
import { setupSignupForm } from "./signup.js";
import { setupLoginForm } from "./login.js";
import {
  initChatFeatures,
  loadUsers,
  checkPendingChatUser,
  sendMessage,
  cleanupChat,
  handleChatSocketReconnect,
} from "./chat.js";
import { isAuthenticated, updateNavigation } from "./auth.js";

let currentRouter; // Store router globally for access

document.addEventListener("DOMContentLoaded", () => {
  const router = new Router();
  currentRouter = router; // Store for global access

  // Home route (landing page)
  router.addRoute("/", "homeTemplate");

  // Auth routes
  router.addRoute("signup", "signupTemplate", () => {
    setupSignupForm(router);
  });

  router.addRoute("login", "loginTemplate", () => {
    setupLoginForm(router, updateNavigation);
  });

  // Posts route
  router.addRoute("posts", "postsTemplate", () => {
    // Check authentication first
    isAuthenticated().then((auth) => {
      if (!auth) {
        router.navigateTo("login");
      } else {
        // Set up the posts page
        setupPostsPage(router); // Pass router to posts page
        // Initialize global features for authenticated users
        initGlobalFeatures();
      }
    });
  });

  // Post details route (for individual posts)
  router.addRoute("post/:id", "postDetailsTemplate", (params) => {
    isAuthenticated().then((auth) => {
      if (!auth) {
        router.navigateTo("login");
      } else {
        console.log("Setting up post details for ID:", params.id);
        setupPostDetailsPage(params.id, router); // Pass router to post details
        // Initialize global features for authenticated users
        initGlobalFeatures();
      }
    });
  });

  // Chat route
  router.addRoute("chat", "chatTemplate", () => {
    isAuthenticated().then((auth) => {
      if (!auth) {
        router.navigateTo("login");
      } else {
        // Initialize global features first
        initGlobalFeatures();
        // Check for pending chat user after a short delay to ensure DOM is ready
        setTimeout(() => {
          checkPendingChatUser();
        }, 100);
      }
    });
  });

  // Start router and update navigation
  router.start();
  updateNavigation(router);
});

// Initialize global features for authenticated users
function initGlobalFeatures() {
  console.log("🌐 Initializing global features...");
  initChatFeatures(); // This will handle chat WebSocket and load users
}

// Event delegation for navigation and post links
document.addEventListener("click", (e) => {
  // Handle navigation links with data-page attribute
  if (e.target.matches("[data-page]")) {
    e.preventDefault();
    const page = e.target.getAttribute("data-page");
    if (currentRouter) {
      currentRouter.navigateTo(page);
    } else {
      window.location.hash = page;
    }
  }

  // Handle post title links specifically
  if (
    e.target.matches(".post-title-link") ||
    e.target.closest(".post-title-link")
  ) {
    e.preventDefault();
    e.stopPropagation();

    const link = e.target.matches(".post-title-link")
      ? e.target
      : e.target.closest(".post-title-link");
    const postId = link.getAttribute("data-post-id");

    console.log("Post title clicked, navigating to post:", postId);

    if (postId && currentRouter) {
      currentRouter.navigateTo(`post/${postId}`);
    } else {
      console.error("No post ID found or router not available");
    }
  }

  // Handle send message button - delegate to chat module
  if (e.target && e.target.id === "sendMessageBtn") {
    e.preventDefault();
    sendMessage();
  }
});

// Allow Enter key to send message
document.addEventListener("keypress", (e) => {
  if (
    e.target &&
    e.target.id === "messageInput" &&
    e.key === "Enter" &&
    !e.shiftKey
  ) {
    e.preventDefault();
    document.getElementById("sendMessageBtn").click();
  }
});

// Listen for custom events from chat module
window.addEventListener("navigateToChat", () => {
  if (currentRouter) {
    currentRouter.navigateTo("chat");
  }
});

window.addEventListener("chatSocketReconnect", () => {
  isAuthenticated().then((auth) => {
    if (auth) {
      handleChatSocketReconnect(auth);
    }
  });
});

// Export router for use in other modules
export { currentRouter };
