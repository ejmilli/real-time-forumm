// auth.js
export function isAuthenticated() {
  // We'll check with the server if the session is valid
  return fetch("/api/check-auth", {
    credentials: "include",
  })
    .then((response) => response.ok)
    .catch(() => false);
}

export function logout() {
  return fetch("/api/logout", {
    method: "POST",
    credentials: "include",
  });
}

export async function updateNavigation(router) {
  const nav = document.querySelector("nav");
  const isLoggedIn = await isAuthenticated();

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
