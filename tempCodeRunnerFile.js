import * as IPFS from "ipfs-http-client";
import fs from "fs/promises";
import express from "express";
import path from "path";
import crypto from "crypto";

const app = express();
const port = 3005;

const __dirname = path.resolve();

// Serve static files
app.use(express.static(path.join(__dirname, "source")));
app.use(express.static(path.join(__dirname, "assets/images")));
app.use(express.static(path.join(__dirname, "assets/styles")));
app.use(express.static(path.join(__dirname, "assets/scripts")));

// Function to encrypt data using AES
function encryptData(data, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encryptedData = cipher.update(data, "utf8", "hex");
  encryptedData += cipher.final("hex");
  return encryptedData;
}

async function uploadEncryptedFileToIPFS(filePath, key) {
  try {
    // Read the file
    const fileData = await fs.readFile(filePath);
    // Encrypt the file data
    const encryptedData = encryptData(fileData, key);
    // Upload the encrypted file to IPFS
    const { cid } = await ipfs.add(encryptedData);
    console.log("Encrypted File Uploaded to IPFS:", cid);
    return cid;
  } catch (error) {
    console.error("Error uploading encrypted file to IPFS:", error);
    return null;
  }
}

function getPublicGatewayUrl(cid) {
  return `https://gateway.ipfs.io/ipfs/${cid}`;
}

// IPFS node configuration
const ipfs = IPFS.create({
  API: {
    HTTPHeaders: {
      AccessControlAllowOrigin: [
        "https://webui.ipfs.io",
        "http://webui.ipfs.io.ipns.localhost:8080",
      ],
    },
  },
  Addresses: {
    API: "/ip4/127.0.0.1/tcp/5001", // This is the address for the IPFS API
    Announce: [], // Addresses to announce to the network
    AppendAnnounce: [], // Addresses to append when announcing to the network
    Gateway: "/ip4/127.0.0.1/tcp/8080", // This is the address for the IPFS gateway
    NoAnnounce: [], // Addresses not to announce to the network
    Swarm: [
      // Addresses for the IPFS swarm (network) connections
      "/ip4/0.0.0.0/tcp/4001",
      "/ip6/::/tcp/4001",
      "/ip4/0.0.0.0/udp/4001/quic-v1",
      "/ip4/0.0.0.0/udp/4001/quic-v1/webtransport",
      "/ip6/::/udp/4001/quic-v1",
      "/ip6/::/udp/4001/quic-v1/webtransport",
    ],
  },
});

// Serve index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "source", "index.html"));
});

// Handle file upload
app.post("/upload", async (req, res) => {
  try {
    const { filePath, password } = req.body;

    // Derive key from password
    const key = crypto.pbkdf2Sync(password, "salt", 100000, 32, "sha256");

    // Upload encrypted file to IPFS
    const cid = await uploadEncryptedFileToIPFS(filePath, key);

    // Get public gateway URL
    const publicGatewayUrl = getPublicGatewayUrl(cid);

    // Store the public gateway URL in a hashed folder
    const hashedFolderPath = path.join(__dirname, "hashed");
    const hashedFilePath = path.join(hashedFolderPath, "gatewayURL.txt");
    await fs.mkdir(hashedFolderPath, { recursive: true });
    await fs.writeFile(hashedFilePath, publicGatewayUrl);

    res.status(200).json({ success: true, publicGatewayUrl });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
