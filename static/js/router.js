export class Router {
  constructor() {
    this.routes = {};
    this.main = document.querySelector("main");
  }

  addRoute(path, templateId, callback) {
    this.routes[path] = { templateId, callback };
  }

  navigateTo(path) {
    window.location.hash = `#${path}`;
  }

  // Extract parameters from a parameterized route
  extractParams(routePattern, actualPath) {
    const params = {};
    const routeParts = routePattern.split("/");
    const pathParts = actualPath.split("/");

    if (routeParts.length !== pathParts.length) {
      return null; // Routes don't match
    }

    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];

      if (routePart.startsWith(":")) {
        // This is a parameter
        const paramName = routePart.substring(1);
        params[paramName] = pathPart;
      } else if (routePart !== pathPart) {
        // Routes don't match
        return null;
      }
    }

    return params;
  }

  // Find matching route and extract parameters
  findRoute(path) {
    // First try exact match
    if (this.routes[path]) {
      return { route: this.routes[path], params: {} };
    }

    // Then try parameterized routes
    for (const routePath in this.routes) {
      if (routePath.includes(":")) {
        const params = this.extractParams(routePath, path);
        if (params !== null) {
          return { route: this.routes[routePath], params };
        }
      }
    }

    return null;
  }

  loadRoute() {
    let path = window.location.hash.substring(1) || "/";
    console.log("Loading route:", path);

    const matchResult = this.findRoute(path);

    if (matchResult) {
      const { route, params } = matchResult;
      const template = document.getElementById(route.templateId);

      if (template) {
        console.log("Template found, loading content");
        this.main.innerHTML = "";
        this.main.appendChild(document.importNode(template.content, true));

        if (route.callback) {
          console.log("Executing callback with params:", params);
          route.callback(params);
        }
      } else {
        console.warn(`Template not found for route: ${path}`);
        this.main.innerHTML = `<h1>Template not found: ${route.templateId}</h1>`;
      }
    } else {
      console.warn(`No route found for ${path}`);
      this.main.innerHTML = `<h1>Page not found: ${path}</h1>`;
    }
  }

  start() {
    console.log("Starting router...");

    // Set up hash change listener
    window.addEventListener("hashchange", () => {
      console.log("Hash changed to:", window.location.hash);
      this.loadRoute();
    });

    // Load initial route
    if (!window.location.hash) {
      console.log("No hash found, setting default route");
      window.location.hash = "#/";
    } else {
      console.log("Loading existing hash:", window.location.hash);
      this.loadRoute();
    }
  }
}