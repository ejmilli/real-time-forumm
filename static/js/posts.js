// posts.js - Posts page functionality

// Escape HTML to prevent XSS
function escapeHTML(str) {
  if (!str) return "";
  return str.replace(/[&<>"']/g, function (match) {
    const escapeMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return escapeMap[match];
  });
}

// Show loading state for posts
function showPostsLoading() {
  const postsContainer = document.getElementById("posts-container");
  if (postsContainer) {
    postsContainer.innerHTML = "<p>Loading posts...</p>";
  }
}

// Show error message for posts
function showPostsError(message) {
  const postsContainer = document.getElementById("posts-container");
  if (postsContainer) {
    postsContainer.innerHTML = `<div class="error" style="color: red; padding: 10px;">Error: ${message}</div>`;
  }
}

// Fetch and display posts
async function loadPosts(category = "") {
  console.log("=== LOAD POSTS CALLED ===");
  console.log("Loading posts for category:", category);
  console.log("Current URL:", window.location.href);

  const postsContainer = document.getElementById("posts-container");
  console.log("Posts container found:", !!postsContainer);

  if (!postsContainer) {
    console.error("Posts container not found! Cannot load posts.");
    return;
  }

  showPostsLoading();

  try {
    let url = "/api/posts";
    if (category && category !== "all") {
      url += `?category=${encodeURIComponent(category)}`;
    }

    console.log("Fetching from URL:", url);

    const response = await fetch(url, {
      credentials: "include",
    });

    console.log("Posts response status:", response.status);
    console.log("Posts response headers:", response.headers);

    if (response.ok) {
      const posts = await response.json();
      console.log("Received posts:", posts);
      renderPosts(posts);
    } else if (response.status === 401) {
      console.log("Unauthorized - redirecting to login");
      showPostsError("You need to be logged in to view posts.");
      window.location.hash = "login";
    } else {
      const errorText = await response.text();
      console.error("Server error response:", errorText);
      showPostsError(`Failed to load posts: ${errorText}`);
    }
  } catch (err) {
    console.error("Network error:", err);
    showPostsError("Network error occurred while loading posts.");
  }
}

// Render posts in the container
function renderPosts(posts) {
  const postsContainer = document.getElementById("posts-container");

  if (!postsContainer) {
    console.error("Posts container not found");
    return;
  }

  if (!posts || posts.length === 0) {
    postsContainer.innerHTML =
      "<p>No posts found. Be the first to post something!</p>";
    return;
  }

  postsContainer.innerHTML = posts
    .map(
      (post) => `
    <div class="post-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px; cursor: pointer;" 
         onclick="viewPost('${post.id}')">
      <h3 style="margin: 0 0 10px 0;">${escapeHTML(post.title)}</h3>
      <div class="post-meta" style="margin-bottom: 10px;">
        <span class="post-category" style="background: #e9ecef; padding: 2px 6px; border-radius: 3px; margin-right: 10px;">
          ${escapeHTML(post.category_id)}
        </span>
        <span class="post-stats">
          👍 ${post.likes || 0} 👎 ${post.dislikes || 0}
        </span>
      </div>
      <div class="post-preview" style="color: #666; line-height: 1.4;">
        ${escapeHTML(post.content.substring(0, 200))}${
        post.content.length > 200 ? "..." : ""
      }
      </div>
      <div class="post-footer" style="color: #999; font-size: 0.8em; margin-top: 10px;">
        Posted: ${new Date(post.created_at).toLocaleString()}
      </div>
    </div>
  `
    )
    .join("");
}

// Navigate to post details
function viewPost(postId) {
  console.log("Viewing post:", postId);
  window.location.hash = `post/${postId}`;
}

// Create a new post
async function createPost() {
  const titleInput = document.getElementById("title");
  const contentInput = document.getElementById("content");
  const categorySelect = document.getElementById("category-select");
  const submitBtn = document.getElementById("submit-post");

  if (!titleInput || !contentInput || !categorySelect) {
    console.error("Post form elements not found");
    alert("Post form not found - check your HTML template");
    return;
  }

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const category = categorySelect.value;

  if (!title || !content) {
    alert("Please fill in both title and content.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting...";
  }

  try {
    console.log("Creating post:", { title, content, category });

    const response = await fetch("/api/posts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        title: title,
        content: content,
        category_id: category,
      }),
    });

    console.log("Create post response status:", response.status);

    if (response.ok) {
      const newPost = await response.json();
      console.log("Post created successfully:", newPost);

      // Clear form
      titleInput.value = "";
      contentInput.value = "";
      categorySelect.value = "general";

      // Reload posts to show the new one
      await loadPosts();

      // Show success message
      showSuccessMessage("Post created successfully!");
    } else {
      const errorText = await response.text();
      console.error("Failed to create post:", errorText);
      alert(`Failed to create post: ${errorText}`);
    }
  } catch (err) {
    console.error("Error creating post:", err);
    alert("An error occurred while creating the post.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Post";
    }
  }
}

// Show success message
function showSuccessMessage(message) {
  const successMsg = document.createElement("div");
  successMsg.style.cssText =
    "background: #d4edda; color: #155724; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #c3e6cb;";
  successMsg.textContent = message;

  const postCreator = document.getElementById("post-creator");
  if (postCreator) {
    postCreator.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3000);
  }
}

// Set up category filtering
function setupCategoryFiltering() {
  const categoryList = document.getElementById("category-list");

  if (!categoryList) {
    console.error("Category list not found");
    return;
  }

  categoryList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI" && e.target.hasAttribute("data-category")) {
      // Remove active class from all items
      categoryList
        .querySelectorAll("li")
        .forEach((li) => li.classList.remove("active"));

      // Add active class to clicked item
      e.target.classList.add("active");

      const selectedCategory = e.target.getAttribute("data-category");
      console.log("Category selected:", selectedCategory);

      // Load posts for selected category
      loadPosts(selectedCategory);
    }
  });
}

// Set up online users functionality
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

// Main setup function for posts page
export function setupPostsPage() {
  console.log("Setting up posts page");

  // Wait for DOM to be fully ready with a longer delay and better checks
  const setupInterval = setInterval(() => {
    const submitBtn = document.getElementById("submit-post");
    const postsContainer = document.getElementById("posts-container");
    const categoryList = document.getElementById("category-list");

    console.log("Checking for elements:", {
      submitBtn: !!submitBtn,
      postsContainer: !!postsContainer,
      categoryList: !!categoryList,
    });

    // Only proceed if all essential elements are found
    if (submitBtn && postsContainer && categoryList) {
      clearInterval(setupInterval);

      console.log("All elements found, setting up posts page");

      // Set up post creation
      // Remove any existing listeners
      const newSubmitBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);

      newSubmitBtn.addEventListener("click", createPost);
      console.log("Post submit button listener added");

      // Set up category filtering
      setupCategoryFiltering();

      // Set up online users updates
      updateOnlineUsers();
      setInterval(updateOnlineUsers, 30000);

      // Load initial posts - this is the important part!
      console.log("Loading initial posts");
      loadPosts();
    }
  }, 50);

  // Timeout after 5 seconds if elements aren't found
  setTimeout(() => {
    clearInterval(setupInterval);
    console.error("Timeout: Could not find required elements for posts page");
  }, 5000);
}

// Export function for post details (if needed by other files)
export function setupPostDetailsPage(postId) {
  // This would contain the post details functionality
  // For now, just log that we're setting up post details
  console.log("Setting up post details page for:", postId);

  // You can move the post-details.js content here if needed
  // or keep it separate and import it
}
