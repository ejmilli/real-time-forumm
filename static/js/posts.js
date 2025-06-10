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

  const postsContainer = document.getElementById("posts-container");
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

    const response = await fetch(url, {
      credentials: "include",
    });

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

//Render posts with proper clickable titles that work with router
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
    <div class="post-item" style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <h3 style="margin: 0 0 10px 0;">
        <a href="#post/${post.id}" 
           class="post-title-link" 
           style="text-decoration: none; color: #0066cc; cursor: pointer; transition: color 0.2s;" 
           data-post-id="${post.id}"
           data-page="post/${post.id}">
          ${escapeHTML(post.title)}
        </a>
      </h3>
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

  console.log("Posts rendered with clickable titles");
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
    console.log("Category list not found - might be on post details page");
    return;
  }

  // Remove existing event listeners
  const newCategoryList = categoryList.cloneNode(true);
  categoryList.parentNode.replaceChild(newCategoryList, categoryList);

  newCategoryList.addEventListener("click", (e) => {
    if (e.target.tagName === "LI" && e.target.hasAttribute("data-category")) {
      e.preventDefault();
      e.stopPropagation();

      // Remove active class from all items
      newCategoryList
        .querySelectorAll("li")
        .forEach((li) => li.classList.remove("active"));

      // Add active class to clicked item
      e.target.classList.add("active");

      const selectedCategory = e.target.getAttribute("data-category");
      console.log("Category selected:", selectedCategory);

      // Load posts for selected category (only if we're on posts page)
      if (window.location.hash === "#posts" || window.location.hash === "") {
        loadPosts(selectedCategory);
      }
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
export function setupPostsPage(router) {
  console.log("Setting up posts page with router:", !!router);

  const setupInterval = setInterval(() => {
    const submitBtn = document.getElementById("submit-post");
    const postsContainer = document.getElementById("posts-container");

    if (submitBtn && postsContainer) {
      clearInterval(setupInterval);

      console.log("All elements found, setting up posts page");

      // Set up post creation
      const newSubmitBtn = submitBtn.cloneNode(true);
      submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
      newSubmitBtn.addEventListener("click", createPost);

      // Set up category filtering
      setupCategoryFiltering();

      // Set up online users updates
      updateOnlineUsers();
      setInterval(updateOnlineUsers, 30000);

      // Load initial posts
      loadPosts();
    }
  }, 50);

  setTimeout(() => {
    clearInterval(setupInterval);
  }, 5000);
}

// Load post details with comments
async function loadPostDetails(postId) {
  console.log("Loading post details for:", postId);

  const postDetailsContainer = document.getElementById("post-details");
  const commentsContainer = document.getElementById("comments-container");

  if (!postDetailsContainer) {
    console.error("Post details container not found");
    return;
  }

  // Show loading state
  postDetailsContainer.innerHTML = "<p>Loading post...</p>";
  if (commentsContainer) {
    commentsContainer.innerHTML = "<p>Loading comments...</p>";
  }

  try {
    const response = await fetch(
      `/api/post-details?id=${encodeURIComponent(postId)}`,
      {
        credentials: "include",
      }
    );

    if (response.ok) {
      const data = await response.json();
      console.log("Received post details:", data);

      renderPostDetails(data.post);
      renderComments(data.comments || []);
    } else if (response.status === 401) {
      console.log("Unauthorized - redirecting to login");
      window.location.hash = "login";
    } else if (response.status === 404) {
      postDetailsContainer.innerHTML = "<p>Post not found.</p>";
    } else {
      const errorText = await response.text();
      console.error("Server error:", errorText);
      postDetailsContainer.innerHTML = `<p>Error loading post: ${errorText}</p>`;
    }
  } catch (err) {
    console.error("Network error:", err);
    postDetailsContainer.innerHTML =
      "<p>Network error occurred while loading post.</p>";
  }
}

// Render post details
function renderPostDetails(post) {
  const postDetailsContainer = document.getElementById("post-details");

  if (!postDetailsContainer || !post) {
    console.error("Cannot render post details - container or post missing");
    return;
  }

  postDetailsContainer.innerHTML = `
    <div class="post-header">
      <h1>${escapeHTML(post.title)}</h1>
      <div class="post-meta" style="margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
        <span class="post-category" style="background: #e9ecef; padding: 4px 8px; border-radius: 3px; margin-right: 15px; font-weight: bold;">
          ${escapeHTML(post.category_id)}
        </span>
        <span class="post-stats" style="margin-right: 15px;">
          👍 ${post.likes || post.like_count || 0} 👎 ${
    post.dislikes || post.dislike_count || 0
  }
        </span>
        <span class="post-date" style="color: #666; font-size: 0.9em;">
          Posted: ${new Date(post.created_at).toLocaleString()}
        </span>
      </div>
    </div>
    <div class="post-content" style="line-height: 1.6; margin: 20px 0; padding: 20px; background: #fff; border: 1px solid #e0e0e0; border-radius: 5px;">
      <div style="white-space: pre-wrap;">${escapeHTML(post.content)}</div>
    </div>
  `;
}

// Render comments
function renderComments(comments) {
  const commentsContainer = document.getElementById("comments-container");

  if (!commentsContainer) {
    console.error("Comments container not found");
    return;
  }

  if (!comments || comments.length === 0) {
    commentsContainer.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px; background: #f8f9fa; border-radius: 5px; margin-top: 15px;">
        <p>No comments yet. Be the first to comment!</p>
      </div>
    `;
    return;
  }

  commentsContainer.innerHTML = comments
    .map(
      (comment) => `
      <div class="comment" style="border: 1px solid #e0e0e0; padding: 15px; margin: 10px 0; border-radius: 5px; background: #fff;">
        <div class="comment-header" style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #333; font-size: 1.1em;">${escapeHTML(
            comment.nickname || comment.user_id
          )}</strong>
          <span style="color: #666; font-size: 0.9em;">
            ${new Date(comment.created_at).toLocaleString()}
          </span>
        </div>
        <div class="comment-body" style="line-height: 1.5; color: #555;">
          <div style="white-space: pre-wrap;">${escapeHTML(
            comment.content || comment.body
          )}</div>
        </div>
      </div>
    `
    )
    .join("");
}

// Create a new comment
async function createComment(postId) {
  const commentTextarea = document.getElementById("comment-text");
  const submitBtn = document.getElementById("submit-comment");

  if (!commentTextarea) {
    console.error("Comment textarea not found");
    return;
  }

  const commentBody = commentTextarea.value.trim();
  if (!commentBody) {
    alert("Please enter a comment.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Posting...";
  }

  try {
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        post_id: postId,
        body: commentBody, // Frontend sends 'body', backend converts to 'content'
      }),
    });

    if (response.ok) {
      const newComment = await response.json();
      console.log("Comment created successfully:", newComment);

      // Clear the textarea
      commentTextarea.value = "";

      // Reload the post details to show the new comment
      await loadPostDetails(postId);

      // Show success message
      showCommentSuccessMessage("Comment posted successfully!");
    } else {
      const errorText = await response.text();
      console.error("Failed to create comment:", errorText);
      alert(`Failed to post comment: ${errorText}`);
    }
  } catch (err) {
    console.error("Error creating comment:", err);
    alert("An error occurred while posting the comment.");
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Post Comment";
    }
  }
}

// Show success message for comments
function showCommentSuccessMessage(message) {
  const successMsg = document.createElement("div");
  successMsg.style.cssText =
    "background: #d4edda; color: #155724; padding: 10px; margin: 10px 0; border-radius: 5px; border: 1px solid #c3e6cb;";
  successMsg.textContent = message;

  const commentForm = document.querySelector(".comment-form");
  if (commentForm) {
    commentForm.appendChild(successMsg);
    setTimeout(() => successMsg.remove(), 3000);
  }
}

// Setup post details page
export function setupPostDetailsPage(postId, router) {
  console.log("Setting up post details page for post ID:", postId);

  const setupInterval = setInterval(() => {
    const postDetailsContainer = document.getElementById("post-details");
    const submitCommentBtn = document.getElementById("submit-comment");

    if (postDetailsContainer && submitCommentBtn) {
      clearInterval(setupInterval);

      console.log("Post details elements found, setting up page");

      // Set up comment submission
      const newSubmitBtn = submitCommentBtn.cloneNode(true);
      submitCommentBtn.parentNode.replaceChild(newSubmitBtn, submitCommentBtn);

      newSubmitBtn.addEventListener("click", (e) => {
        e.preventDefault();
        createComment(postId);
      });

      // Set up category filtering for sidebar (if present)
      setupCategoryFiltering();

      // Set up the back link
      const backLink = document.querySelector(".back-link");
      if (backLink) {
        backLink.addEventListener("click", (e) => {
          e.preventDefault();
          if (router) {
            router.navigateTo("posts");
          } else {
            window.location.hash = "posts";
          }
        });
      }

      // Load the post details and comments
      loadPostDetails(postId);
    }
  }, 50);

  setTimeout(() => {
    clearInterval(setupInterval);
    console.error(
      "Timeout: Could not find required elements for post details page"
    );
  }, 5000);
}
