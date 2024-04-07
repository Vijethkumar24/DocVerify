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
        // Send user address as a POST request to server
        fetch("/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ userAddress: userAddress }),
        })
          .then((response) => {
            // Handle response if needed
            // Redirect to home page after successful login
            window.location.href = "/home";
          })
          .catch((error) => {
            console.error("Error:", error);
          });
      }
    } catch (error) {
      console.error(error);
    }
  } else {
    console.log("MetaMask not detected.");
  }
}

// Attach event listener to connect button when DOM content is loaded
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectButton").addEventListener("click", connect);
});
