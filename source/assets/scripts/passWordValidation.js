document.querySelectorAll(".btn-primary").forEach(function (btn) {
  btn.addEventListener("click", function () {
    $("#uploadModal").modal("show");
  });
});

// Password visibility toggler for password field 1
document
  .getElementById("togglePassword1")
  .addEventListener("click", function () {
    const password1 = document.getElementById("userpassword");
    const type1 =
      password1.getAttribute("type") === "password" ? "text" : "password";
    password1.setAttribute("type", type1);
    const icon1 = this.querySelector("i");
    icon1.classList.toggle("fa-eye");
    icon1.classList.toggle("fa-eye-slash");
  });

// Password visibility toggler for password field 2
document
  .getElementById("togglePassword2")
  .addEventListener("click", function () {
    const password2 = document.getElementById("userConfirmPass");
    const type2 =
      spassword2.getAttribute("type") === "password" ? "text" : "password";
    password2.setAttribute("type", type2);
    const icon2 = this.querySelector("i");
    icon2.classList.toggle("fa-eye");
    icon2.classList.toggle("fa-eye-slash");
  });

// Form submission event listener
document
  .getElementById("uploadForm")
  .addEventListener("submit", async function (event) {
    event.preventDefault();

    const formData = new FormData(this);
    try {
      const response = await fetch("/uploads", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload document");
      }

      const data = await response.json();
      console.log(data);
      alert("Document uploaded successfully! File Hash: " + data.cid);
      // Optionally, redirect user or perform additional actions
    } catch (error) {
      console.error("Error:", error);
      alert("Failed to upload document");
    }
  });
