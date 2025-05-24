document.addEventListener("DOMContentLoaded", function () {
  const router = new Router();

  // Add a route handler for the signup page
  router.addRoute("signup", "signupTemplate", setupSignupForm);

  router.start();
});

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
  } else {
    msgElement.style.backgroundColor = "#ddffdd";
    msgElement.style.color = "#008800";
  }

  // Add to form
  const form = document.getElementById("form");
  form
    .querySelector('button[type="submit"]')
    .insertAdjacentElement("beforebegin", msgElement);

  // Auto dismiss success messages
  if (!isError) {
    setTimeout(() => {
      msgElement.remove();
    }, 5000);
  }
}

// Router class for handling navigation
class Router {
  constructor() {
    this.routes = {};
    this.main = document.querySelector("main");
  }

  addRoute(path, templateId, callback) {
    this.routes[path] = { templateId, callback };
  }

  navigateTo(path) {
    history.pushState(null, null, `#${path}`);
    this.loadRoute();
  }

  loadRoute() {
    let path = window.location.hash.substring(1) || "/";
    const route = this.routes[path];

    if (route) {
      const template = document.getElementById(route.templateId);
      this.main.innerHTML = "";
      this.main.appendChild(document.importNode(template.content, true));

      if (route.callback) {
        route.callback();
      }
    }
  }

  start() {
    window.addEventListener("hashchange", () => this.loadRoute());
    if (!window.location.hash) {
      window.location.hash = "#/";
    } else {
      this.loadRoute();
    }
  }
}
