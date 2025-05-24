// Updated router.js with authentication integration
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

    loadRoute() {
        let path = window.location.hash.substring(1) || "/";
        const route = this.routes[path];

        if (route) {
            const template = document.getElementById(route.templateId);
            if (template) {
                this.main.innerHTML = "";
                this.main.appendChild(document.importNode(template.content, true));

                if (route.callback) {
                    route.callback();
                }
            } else {
                console.warn(`Template not found for route: ${path}`);
            }
        } else {
            console.warn(`No route found for ${path}`);
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