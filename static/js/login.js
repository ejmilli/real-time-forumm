// Setup login form functionality
export function setupLoginForm(router, updateNavigation) {
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
    nicknameRadio.checked = true;
    if (emailInput) emailInput.style.display = "none";

    nicknameRadio.addEventListener("change", () => {
      if (nicknameInput) nicknameInput.style.display = "block";
      if (emailInput) emailInput.style.display = "none";
    });

    emailRadio.addEventListener("change", () => {
      if (nicknameInput) nicknameInput.style.display = "none";
      if (emailInput) emailInput.style.display = "block";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Login form submitted");

    try {
      const loginTypeElement = form.querySelector(
        'input[name="loginType"]:checked'
      );

      if (!loginTypeElement) {
        showMessage("Please select login type (Nickname or Email)", true);
        return;
      }

      const loginType = loginTypeElement.value;
      const nickname =
        loginType === "nickname"
          ? form.querySelector("#nickname")?.value.trim()
          : "";
      const email =
        loginType === "email" ? form.querySelector("#email")?.value.trim() : "";
      const password = form.querySelector("#password")?.value;

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

// Message display function for login
function showMessage(message, isError = true) {
  const existingMsg = document.querySelector(".message");
  if (existingMsg) existingMsg.remove();

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

  // Add to the login form
  const form = document.querySelector("#loginForm");
  if (form) {
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.insertAdjacentElement("beforebegin", msgElement);
    }
  }

  // Auto dismiss success messages
  if (!isError) {
    setTimeout(() => {
      if (msgElement.parentNode) {
        msgElement.remove();
      }
    }, 5000);
  }
}
