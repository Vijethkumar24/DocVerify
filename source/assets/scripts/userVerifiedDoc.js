// Function to request MetaMask connection
async function connectMetaMask() {
  if (window.ethereum) {
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });
      window.web3 = new Web3(window.ethereum);
    } catch (error) {
      console.error("User denied MetaMask connection", error);
    }
  } else {
    console.error("MetaMask is not installed.");
  }
}

// Function to fetch Infura URL
async function getInfuraUrl() {
  try {
    const response = await fetch("/getInfuraUrl", {
      method: "GET",
      credentials: "include", // This ensures cookies are sent
    });
    const data = await response.json();
    return data.infuraUrl;
  } catch (error) {
    console.error("Failed to fetch Infura URL:", error);
    return null;
  }
}

// Function to fetch contract address
async function getContractAddress() {
  try {
    const response = await fetch("/getContractAddress", {
      method: "GET",
      credentials: "include", // This ensures cookies are sent
    });
    const data = await response.json();
    return data.contractAddress;
  } catch (error) {
    console.error("Failed to fetch contract address:", error);
    return null;
  }
}

// Function to fetch contract ABI
async function getContractABI() {
  try {
    const response = await fetch("/getContractABI", {
      method: "GET",
      credentials: "include", // This ensures cookies are sent
    });
    const data = await response.json();
    if (!data.resABI) {
      throw new Error("ABI is missing from response");
    }
    return data.resABI;
  } catch (error) {
    console.error("Failed to fetch contract ABI:", error);
    return null;
  }
}

// Function to initialize Web3
async function initWeb3() {
  if (window.ethereum) {
    await connectMetaMask();
  } else {
    const infuraUrl = await getInfuraUrl();
    if (!infuraUrl) {
      console.error("Failed to fetch Infura URL");
      return;
    }
    window.web3 = new Web3(new Web3.providers.HttpProvider(infuraUrl));
  }
}

// Function to fetch logs
async function fetchAndDisplayLogs() {
  try {
    await initWeb3();
    const contractAddress = await getContractAddress();
    if (!contractAddress) {
      console.error("No contract address found");
      return;
    }

    const abi = await getContractABI();
    if (!abi) {
      console.error("Contract ABI is undefined.");
      return;
    }

    const contract = new web3.eth.Contract(abi, contractAddress);
    const requestData = {
      jsonrpc: "2.0",
      id: 11155111,
      method: "eth_getLogs",
      params: [
        { fromBlock: "0x0", toBlock: "latest", address: contractAddress },
      ],
    };

    web3.currentProvider.send(requestData, async (error, response) => {
      if (error) {
        console.error("Error fetching logs:", error);
        return;
      }

      if (!Array.isArray(response.result)) {
        console.error("Invalid log response:", response);
        return;
      }

      const logs = response.result.map((log) => {
        const decodedData = web3.eth.abi.decodeParameters(
          [
            "string",
            "string",
            "string",
            "string",
            "string",
            "string",
            "string",
          ],
          log.data
        );
        return {
          documentHash: decodedData[0],
          filename: decodedData[1],
          fileType: decodedData[2],
          fileCategory: decodedData[6],
          transactionHash: log.transactionHash,
        };
      });

      logs.reverse();
      const logsContainer = document.getElementById("logsContainer");
      logsContainer.innerHTML = "";

      logs.forEach((log) => {
        const card = document.createElement("div");
        card.className =
          "bg-white shadow-md rounded-lg p-4 border border-gray-200";
        card.innerHTML = `
          <h3 class="text-lg font-bold">${log.filename}</h3>
          <p class="text-sm text-gray-600">Type: ${log.fileType}</p>
          <p class="text-sm text-gray-600">Category: ${log.fileCategory}</p>
          <p class="text-xs text-gray-500 truncate">Hash: ${log.documentHash}</p>
          <div class="mt-3 flex gap-2">
            <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onclick="getFile('${log.documentHash}')">Get File</button>
            <button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded" onclick="viewDetails('${log.documentHash}', '${log.transactionHash}', '${log.filename}', '${log.fileType}')">View</button>
          </div>
        `;
        logsContainer.appendChild(card);
      });
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
  }
}
function viewDetails(documentHash, transactionHash, filename, fileType) {
  let isOpen = false; // Initialize flag to track open popup state

  if (isOpen) {
    return; // Don't open a new popup if one is already open
  }

  isOpen = true; // Set flag to true when opening a new popup

  // Create and configure the popup div
  const popup = document.createElement("div");
  popup.classList.add("popup");

  // Set styles for the popup
  popup.style.position = "fixed";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.backgroundColor = "white"; /* White background */
  popup.style.display = "block";
  popup.style.padding = "20px";
  popup.style.width = "40vw";
  popup.style.height = "50vh"; /* Increase width for larger size */
  popup.style.zIndex = 100;

  // Set up the content of the popup
  popup.innerHTML = `<div class="popup-content">
      <span class="document-hash" style="color:black;overflow-wrap:break-word; font-weight: bold;">Document Hash: ${documentHash}</span><br>
      <canvas id="qrCanvas" style="margin-top: 20px;margin-left:auto;margin-right:auto;"></canvas><br>
      <button class="popup-button" style="color:white; background-color:red; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; margin-left:45%; text-align:center">Close</button>
    </div>`;

  // Append the popup to the document body
  document.body.appendChild(popup);

  // Generate QR code
  const qrCanvas = document.getElementById("qrCanvas");

  const verified = "VERIFIED BY CVSPV";
  // Combine document hash, transaction hash, filename, and file type

  const qrData = `\ntransactionHash: ${transactionHash}\n filename: ${filename}\n fileType:${fileType}\n verifiedBy:${verified};`;

  QRCode.toCanvas(qrCanvas, qrData, function (error) {
    if (error) {
      console.error("Error generating QR code:", error);
      alert("Error generating QR code. Please try again."); // Inform user about the error
    } else {
      // QR code generated successfully
      console.log("QR code generated successfully");
      // Inform user about successful generation
    }
  });

  // Style buttons (using a single class)
  const buttons = popup.querySelectorAll(".popup-button");
  buttons.forEach((button) => {
    button.style.color = "white";
    button.style.margin = "0 auto 0 auto"; // Set left margin to auto
    button.style.padding = "10px 20px";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
  });

  // Add click event listener to close button
  const closeButton = document.querySelector(".popup-button");
  closeButton.addEventListener("click", () => {
    popup.style.display = "none";
    isOpen = false; // Reset flag when popup is closed
    document.body.removeChild(popup);
  });
}
async function fetchAndDisplayLogs() {
  try {
    await initWeb3();
    const contractAddress = await getContractAddress();
    if (!contractAddress) {
      console.error("No contract address found");
      return;
    }

    const abi = await getContractABI();
    if (!abi) {
      console.error("Contract ABI is undefined.");
      return;
    }

    const contract = new web3.eth.Contract(abi, contractAddress);
    const requestData = {
      jsonrpc: "2.0",
      id: 11155111,
      method: "eth_getLogs",
      params: [
        { fromBlock: "0x0", toBlock: "latest", address: contractAddress },
      ],
    };

    web3.currentProvider.send(requestData, async (error, response) => {
      if (error) {
        console.error("Error fetching logs:", error);
        return;
      }

      if (!Array.isArray(response.result)) {
        console.error("Invalid log response:", response);
        return;
      }

      const logs = response.result.map((log) => {
        const decodedData = web3.eth.abi.decodeParameters(
          [
            "string",
            "string",
            "string",
            "string",
            "string",
            "string",
            "string",
          ],
          log.data
        );
        return {
          documentHash: decodedData[0],
          filename: decodedData[1],
          fileType: decodedData[2],
          fileCategory: decodedData[6],
          transactionHash: log.transactionHash,
        };
      });

      logs.reverse();
      displayFilteredLogs(logs);
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
  }
}

// 🔥 Function to filter logs by category & search query
function displayFilteredLogs(logs) {
  const logsContainer = document.getElementById("logsContainer");
  const categoryFilter = document
    .getElementById("categoryFilter")
    .value.toLowerCase();
  const searchQuery = document
    .getElementById("searchInput")
    .value.toLowerCase();

  logsContainer.innerHTML = "";

  logs.forEach((log) => {
    const matchesCategory =
      categoryFilter === "all" ||
      log.fileCategory.toLowerCase() === categoryFilter;
    const matchesSearch =
      log.filename.toLowerCase().includes(searchQuery) ||
      log.documentHash.toLowerCase().includes(searchQuery) ||
      log.fileType.toLowerCase().includes(searchQuery);

    if (matchesCategory && matchesSearch) {
      const card = document.createElement("div");
      card.className =
        "bg-white shadow-md rounded-lg p-4 border border-gray-200";
      card.innerHTML = `
        <h3 class="text-lg font-bold">${log.filename}</h3>
        <p class="text-sm text-gray-600">Type: ${log.fileType}</p>
        <p class="text-sm text-gray-600">Category: ${log.fileCategory}</p>
        <p class="text-xs text-gray-500 truncate">Hash: ${log.documentHash}</p>
        <div class="mt-3 flex gap-2">
          <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" onclick="getFile('${log.documentHash}')">Get File</button>
          <button class="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded" onclick="viewDetails('${log.documentHash}', '${log.transactionHash}', '${log.filename}', '${log.fileType}')">View</button>
        </div>
      `;
      logsContainer.appendChild(card);
    }
  });
}

// 🔥 Function to trigger filtering on search
function searchLogs() {
  fetchAndDisplayLogs();
}

// 🔥 Apply filter when category changes
document
  .getElementById("categoryFilter")
  .addEventListener("change", fetchAndDisplayLogs);
document.getElementById("searchInput").addEventListener("input", searchLogs);

// 🔥 Call `fetchAndDisplayLogs()` when filter is changed
document
  .getElementById("categoryFilter")
  .addEventListener("change", fetchAndDisplayLogs);
async function fetchFile(documentHash) {
  try {
    // Fetch wallet address
    const walletAddressResponse = await fetch("/getWalletAddress", {
      method: "GET",
      credentials: "include", // This ensures cookies are sent
    });
    const walletAddressData = await walletAddressResponse.json();
    const walletAddress = walletAddressData.walletAddress;

    const abi = await getContractABI();
    const contractAddress = await getContractAddress();
    // Create contract instance
    const contract = new web3.eth.Contract(abi, contractAddress);

    // Prompt user for password
    const password = document.getElementById("passwordInput").value;

    // Send document details to contract
    const result = await contract.methods
      .getDocument(documentHash, password)
      .call({ from: walletAddress });

    // Handle the result here (e.g., download file or display content)

    const resfilename = result[0]; // 'CS_GO_HD.jpeg'
    const resfileType = result[1]; // 'image/jpeg'
    const resCid = result[2];
    const resiv = result[3]; // 'd1d6b605d775c2f0456983b1ae514fba'
    const respassword = result[4]; // 'Vijeth@246'
    const resdocumentHash = result[5];
    if (respassword === password) {
      // Create an object containing the data to send
      const dataToSend = {
        filename: resfilename,
        fileType: resfileType,
        cid: resCid,
        iv: resiv,
        password: respassword,
        documentHash: resdocumentHash,
      };
      Swal.showLoading();
      // Make a POST request to your backend endpoint
      fetch("/retrieve", {
        method: "POST",
        credentials: "include", // Ensures cookies are sent
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dataToSend),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error("Failed to retrieve data");
          }
          return response.blob(); // Parse the response as a blob
        })
        .then((blob) => {
          // Create a blob URL for the blob
          const url = window.URL.createObjectURL(blob);

          // Create a link element
          const link = document.createElement("a");
          link.href = url;
          link.setAttribute("download", resfilename); // Set filename and extension here

          // Append the link to the document body
          document.body.appendChild(link);

          // Programmatically click the link to trigger the download
          link.click();
          Swal.fire({
            icon: "success",
            title: "Document Downloaded Success",
            text: "Thank You!!!!",
          }).then(() => {
            window.location.reload(); // Reload the page after the user dismisses the popup
          });

          // Remove the link from the document body
          document.body.removeChild(link);
        })
        .catch((error) => {
          console.error("Error retrieving data:", error);
        });
    } else {
      Swal.fire({
        icon: "error",
        title: "Document Didn't Downloaded ",
        text: "Password Didn't Matched!!",
      });
    }
    // Close popup
    // const popup = document.querySelector('.popup');
    // popup.style.display = 'none';
    // isOpen = false; // Reset flag when popup is closed
    // document.body.removeChild(popup);
  } catch (error) {
    Swal.fire({
      icon: "error",
      title: "Document Didn't Downloaded ",
      text: "Password Didn't Matched!!",
    }); // Inform user about the error
  }
}

let isOpen = false;
function getFile(documentHash) {
  if (isOpen) {
    return; // Don't open a new popup if one is already open
  }

  isOpen = true; // Set flag to true when opening a new popup

  // Create and configure the popup div
  const popup = document.createElement("div");
  popup.classList.add("popup");

  // Set styles for the popup
  popup.style.position = "fixed";
  popup.style.top = "50%";
  popup.style.left = "50%";
  popup.style.transform = "translate(-50%, -50%)";
  popup.style.backgroundColor = "white"; /* White background */
  popup.style.display = "block";
  popup.style.padding = "20px";
  popup.style.width = "35vw";
  popup.style.height = "30vh"; /* Increase width for larger size */
  popup.style.zIndex = 100;

  // Set up the content of the popup
  popup.innerHTML = `
    <div class="popup-content">
      <span class="document-hash" style="color:black;overflow-wrap:break-word; font-weight: bold;">Document Hash: ${documentHash}</span><br>
      <input type="password" id="passwordInput" placeholder="Enter password" style="border: 1px solid #ccc; padding: 5px; margin-bottom: 15px; color:black;width:75%;margin-top:5%"><br>
      <button onclick="fetchFile('${documentHash}')" class="fetch-button" style="background-color:#39bd5c" margin-left:5%>Fetch File</button>
      <button id="closeButton" style="margin-left:1%">Close</button>
    </div>
  `;

  // Append the popup to the document body
  document.body.appendChild(popup);

  // Style buttons
  const buttons = popup.querySelectorAll("button");
  buttons.forEach((button) => {
    button.style.color = "black"; /* Black text color for all buttons */
    button.style.padding = "10px 20px";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    button.style.cursor = "pointer";
  });

  // Style close button (red)
  const closeButton = document.getElementById("closeButton");
  closeButton.style.backgroundColor = "red";
  closeButton.style.color = "white";

  // Add click event listener to close button
  closeButton.addEventListener("click", () => {
    popup.style.display = "none";
    isOpen = false; // Reset flag when popup is closed
    document.body.removeChild(popup);
  });
}

// Initialize Web3 and Fetch Logs on Page Load
(async function () {
  await initWeb3();
  await fetchAndDisplayLogs();
})();
