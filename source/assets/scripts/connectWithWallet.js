// Function to connect with MetaMask and send user's address to server
async function connect() {
  // Check if MetaMask is installed and available
  if (window.ethereum) {
    const web3 = new Web3(window.ethereum);

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      // Get the first account from the array of accounts
      const userAddress = accounts[0];
      console.log("Connected with address:", userAddress);
      if (userAddress) {
        fetch("/", {
          method: "POST",
          credentials: "include", // Ensures cookies are sent
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userAddress: userAddress }),
        })
          .then((response) => {
            if (response.redirected) {
              window.location.href = response.url; // Handle redirects properly
            } else {
              return response.json(); // Only parse JSON if no redirect
            }
          })
          .then((data) => {
            if (data) console.log("Server Response:", data);
          })
          .catch((error) => console.error("Error:", error));
      }
    } catch (error) {
      console.error(error);
    }
  } else {
    Swal.fire({
      icon: "error",
      title: "Meta Mask Extension Not Found",
      text: "Please Add Meta Mask Extension!!",
    });
    console.log("MetaMask not detected.");
  }
}

// Attach event listener to connect button when DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectButton").addEventListener("click", connect);
});
