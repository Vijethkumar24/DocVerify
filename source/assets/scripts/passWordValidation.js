// Function to validate password
function validatePassword(password) {
  // Regular expression for password validation
  const passwordRegex =
    /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{10,}$/;
  return passwordRegex.test(password);
}

// Event listener for password input fields
document.getElementById("userpassword").addEventListener("input", function () {
  const password = this.value;
  const isValid = validatePassword(password);
  if (!isValid) {
    this.style.borderColor = "red";
  } else {
    this.style.borderColor = "";
  }
});

document
  .getElementById("userConfirmPass")
  .addEventListener("input", function () {
    const password = this.value;
    const isValid = validatePassword(password);
    if (!isValid) {
      this.style.borderColor = "red";
    } else {
      this.style.borderColor = "";
    }
  });

// Event listener for "Upload" buttons
document
  .getElementById("uploadModalBtn3")
  .addEventListener("click", function () {
    document.getElementById("Category").value = "Government";
    $("#uploadModal").modal("show");
  });

document
  .getElementById("uploadModalBtn2")
  .addEventListener("click", function () {
    document.getElementById("Category").value = "Financial";
    $("#uploadModal").modal("show");
  });

document
  .getElementById("uploadModalBtn1")
  .addEventListener("click", function () {
    document.getElementById("Category").value = "Educational";
    $("#uploadModal").modal("show");
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
      password2.getAttribute("type") === "password" ? "text" : "password";
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

    const password = document.getElementById("userpassword").value;
    const confirmPassword = document.getElementById("userConfirmPass").value;

    // Validate passwords
    const isValidPassword = validatePassword(password);
    const doPasswordsMatch = password === confirmPassword;

    // Check if passwords are valid
    if (!isValidPassword || !doPasswordsMatch) {
      Swal.fire({
        icon: "error",
        title: "Invalid Password",
        html:
          "Please enter a valid password and ensure both passwords match.<br><br>" +
          "Password should meet the following criteria:<br>" +
          "- Minimum 10 characters<br>" +
          "- At least one uppercase letter<br>" +
          "- At least one lowercase letter<br>" +
          "- At least one digit<br>" +
          "- At least one special character: !@#$%^&*",
      });
      return;
    }

    // Continue with form submission and transaction initiation
    const formData = new FormData(this);
    try {
      const response = await fetch(
        "https://docverify-i7cb.onrender.com/getdocHash",
        {
          method: "POST",
          body: formData,
          credentials: "include", // This ensures cookies are sent
        }
      );

      if (!response.ok) {
        throw new Error("Failed to get document hash");
      }

      const data = await response.json();
      const docHash = data.hash;
      const abi = data.Docabi;
      const res = await isFileAlreadyExists(docHash, abi);

      if (!res) {
        try {
          const response = await fetch(
            "https://docverify-i7cb.onrender.com/uploads",
            {
              method: "POST",
              body: formData,
              credentials: "include", // This ensures cookies are sent
            }
          );
          if (!response.ok) {
            throw new Error("Failed to get document hash");
          }
          const data = await response.json();
          const filename = data.fileName;
          const filetype = data.fileType;
          const filecategory = data.fileCategory;
          const properCID = data.resCid;
          const iv = data.iv;
          const hash = data.hash;
          const docabi = data.Docabi;
          const userkey = data.password;

          const transactionResult = await initiateTransaction(
            hash,
            filename,
            filetype,
            filecategory,
            properCID,
            iv,
            userkey,
            docabi
          );

          $("#uploadModal").modal("hide");
        } catch (error) {
          console.error(error);
        }
      } else {
        Swal.fire({
          icon: "error",
          title: "Failed to Upload Document",
          text: "Document already exists.",
        }).then(() => {
          window.location.reload(); // Reload the page after the user dismisses the popup
        });
      }
    } catch (error) {
      console.error(error);
      alert("Failed to initiate transaction: " + error.message);
    } finally {
      // Hide loading spinner
      Swal.hideLoading();
    }
  });

async function isFileAlreadyExists(docHash, abi) {
  if (window.ethereum) {
    const web3 = new Web3(window.ethereum);
    try {
      // Request account access if needed
      Swal.showLoading();
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const defaultAccount = accounts[0]; // Get the first account
      if (!defaultAccount) {
        throw new Error(
          "No accounts found. Please ensure MetaMask is properly configured."
        );
      }

      // Your contract address and ABI
      const contractAddress = await fetch(
        "https://docverify-i7cb.onrender.com/getContractAddress",
        {
          method: "GET",
          credentials: "include", // This ensures cookies are sent
        }
      )
        .then((response) => response.json())
        .then((data) => data.contractAddress)
        .catch((error) => console.log(error));
      const concAbi = abi;
      const contract = new web3.eth.Contract(concAbi, contractAddress);
      // Send document details to contract

      const flag = await contract.methods
        .verifyDocument(docHash)
        .call({ from: defaultAccount });
      // Listen for the disconnect event
      window.ethereum.on("disconnect", (error) => {
        if (error) {
          console.error("MetaMask disconnect error:", error);
        } else {
          console.log("MetaMask disconnected");
          // Handle disconnect event
        }
      });
      return flag;
    } catch (error) {
      console.error(error);
      throw new Error("Failed to initiate transaction: " + error.message);
    }
  } else {
    throw new Error("MetaMask not detected.");
  }
}

async function initiateTransaction(
  hash,
  filename,
  filetype,
  filecategory,
  properCID,
  iv,
  userkey,
  docabi
) {
  if (window.ethereum) {
    const web3 = new Web3(window.ethereum);
    try {
      // Request account access if needed
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const defaultAccount = accounts[0]; // Get the first account
      if (!defaultAccount) {
        throw new Error(
          "No accounts found. Please ensure MetaMask is properly configured."
        );
      }

      // Your contract address and ABI
      const contractAddress = await fetch(
        "https://docverify-i7cb.onrender.com/getContractAddress",
        {
          method: "GET",
          credentials: "include", // This ensures cookies are sent
        }
      )
        .then((response) => response.json())
        .then((data) => data.contractAddress)
        .catch((error) => console.log(error));

      const abi = docabi;
      const contract = new web3.eth.Contract(abi, contractAddress);

      // Send document details to contract
      const result = await contract.methods
        .addDocument(
          hash,
          filename,
          filetype,
          properCID,
          iv,
          userkey,
          filecategory
        )
        .send({ from: defaultAccount });

      // Listen for the disconnect event
      window.ethereum.on("disconnect", (error) => {
        if (error) {
          console.error("MetaMask disconnect error:", error);
        } else {
          console.log("MetaMask disconnected");
          // Handle disconnect event
        }
      });
      $("#uploadModal").modal("hide");
      Swal.hideLoading();
      Swal.fire({
        icon: "success",
        title: "Document Upload Success",
        text: "Hurray!!! Your Document Is Safe",
      }).then(() => {
        window.location.reload(); // Reload the page after the user dismisses the popup
      });
      // Replace alert with Swal.fire for error message
      return result;
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: "error",
        title: "Failed to initiate transaction",
        text: "An error occurred while uploading the document.",
      });
      throw new Error("Failed to initiate transaction: " + error.message);
    }
  } else {
    throw new Error("MetaMask not detected.");
  }
}
