// Setup signup form functionality
export function setupSignupForm(router) {
  console.log("Setting up signup form");
  const form = document.querySelector("#form");

  if (!form) {
    console.error("Signup form not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    console.log("Form submitted");

    const formData = new FormData(form);

    // Log all form fields (except password)
    console.log("Form data collected:");
    for (const [name, value] of formData.entries()) {
      if (name !== "password" && name !== "confirmPassword") {
        console.log(` ${name}: ${value}`);
      } else {
        console.log(` ${name}: [HIDDEN]`);
      }
    }

    try {
      const response = await fetch("/signup", {
        method: "POST",
        body: formData,
      });

      const result = await response.text();
      console.log("Server response:", result);

      if (response.ok) {
        showMessage("Signup successful! Redirecting to login...", false);
        setTimeout(() => {
          router.navigateTo("login");
        }, 2000);
      } else {
        showMessage(result || "Signup failed", true);
      }
    } catch (error) {
      console.error("Error during signup:", error);
      showMessage("An error occurred. Please try again.", true);
    }
  });
}

// Message display function for signup
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

  // Add to the signup form
  const form = document.getElementById("form");
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
