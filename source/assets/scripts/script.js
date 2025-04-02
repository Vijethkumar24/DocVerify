function submitForm(event) {
  event.preventDefault(); // Prevent default form submission behavior

  const form = event.target; // Get the form element

  // Get form data
  const formData = new FormData(form);

  // Send form data asynchronously using fetch
  fetch(form.action, {
    method: form.method,
    body: formData,
  })
    .then((response) => {
      if (response.ok) {
        return response.text(); // Return the response text if request is successful
      } else {
        throw new Error("Network response was not ok."); // Throw an error if request is not successful
      }
    })
    .then(() => {
      // Show success popup notification
      Swal.fire({
        title: "Success!",
        text: "Your message has been sent successfully!",
        icon: "success",
      });
      form.reset(); // Reset the form after successful submission
    })
    .catch((error) => {
      // Show error popup notification
      console.error("Error:", error); // Log any errors that occur during sending
      Swal.fire({
        title: "Error!",
        text: "An error occurred while sending your message. Please try again later.",
        icon: "error",
      });
    });
}

// Add form submission event listener
document.getElementById("contact-form").addEventListener("submit", submitForm);
