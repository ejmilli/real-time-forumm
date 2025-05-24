// Updated setupLoginForm function for js/app.js
function setupLoginForm() {
  console.log("Setting up login form");
  const form = document.querySelector("#login form");

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

    // Get form data manually to ensure correct values
    const loginType = form.querySelector('input[name="loginType"]:checked').value;
    const nickname = loginType === "nickname" ? form.querySelector('#nickname').value.trim() : "";
    const email = loginType === "email" ? form.querySelector('#email').value.trim() : "";
    const password = form.querySelector('#password').value;

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

    // Create FormData object
    const formData = new FormData();
    formData.append("loginType", loginType);
    formData.append("nickname", nickname);
    formData.append("email", email);
    formData.append("password", password);

    try {
      const response = await fetch("/login", {
        method: "POST",
        body: formData
      });

      const result = await response.text();

      if (response.ok) {
        showMessage("Login successful! Redirecting...", false);
        // Redirect to posts page after successful login
        setTimeout(() => {
          window.location.hash = "#posts";
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