import express from "express";
import multer from "multer";
import * as IPFS from "ipfs-http-client";
import crypto from "crypto";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import { readFile } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());

// Serve static content from the "public" directory
app.use("/public", express.static(path.join(__dirname, "public")));

// Serve the file to express
app.use(express.static(path.join(__dirname, "source")));
app.use(express.static(path.join(__dirname, "assets/images")));
app.use(express.static(path.join(__dirname, "assets/styles")));
app.use(express.static(path.join(__dirname, "assets/scripts")));

const port = 3001;
app.use(express.json());

const ipfs = IPFS.create({ host: "localhost", port: 5001, protocol: "http" });

const upload = multer({ dest: "uploads/" });

function deriveKeyFromPassword(password) {
  const passwordBuffer = Buffer.from(password, "utf-8");

  if (passwordBuffer.length < 32) {
    const paddedPasswordBuffer = Buffer.alloc(32);
    passwordBuffer.copy(paddedPasswordBuffer);
    return paddedPasswordBuffer;
  }

  return passwordBuffer;
}

// Generate a new IV for each encryption operation
function generateIV() {
  return randomBytes(16);
}

function encryptData(data, key) {
  return new Promise((resolve, reject) => {
    try {
      const iv = generateIV(); // Generate a new IV for each encryption
      const cipher = createCipheriv("aes-256-cbc", key, iv);
      let encryptedChunks = [];
      cipher.on("data", (chunk) => encryptedChunks.push(chunk));
      cipher.on("end", () => {
        const encryptedData = Buffer.concat(encryptedChunks);
        resolve({ iv, encryptedData });
      });

      cipher.write(data);
      cipher.end();
    } catch (error) {
      console.error("Error encrypting data:", error);
      reject(new Error("Error encrypting data"));
    }
  });
}

async function retrieveDataFromIPFS(cid) {
  const chunks = [];
  try {
    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("Error retrieving data from IPFS:", error);
    throw error;
  }
}

// Function to decrypt the data
async function decryptData(encryptedData, key, iv) {
  try {
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    let decryptedData = decipher.update(encryptedData);
    decryptedData = Buffer.concat([decryptedData, decipher.final()]);
    return decryptedData;
  } catch (error) {
    console.error("Error decrypting data:", error);
    throw new Error("Error decrypting data: " + error.message);
  }
}

// Function to calculate the SHA-256 hash of a file
async function calculateHash(filePath) {
  try {
    const fileContent = await readFile(filePath);
    const hash = crypto.createHash("sha256").update(fileContent).digest("hex");
    return hash;
  } catch (error) {
    console.error("Error calculating hash:", error);
    throw error;
  }
}

app.post("/retrieve", async (req, res) => {
  const cid = req.body.cid;
  const password = req.body.password;
  const ivHex = req.body.iv; // IV received as hex string

  try {
    if (!cid || !password || !ivHex) {
      throw new Error("Missing required parameters (CID, password, IV)");
    }

    const encryptedData = await retrieveDataFromIPFS(cid); // Wait for IPFS data retrieval
    const key = deriveKeyFromPassword(password);
    const iv = Buffer.from(ivHex, "hex"); // Convert hex string to Buffer

    const decryptedData = await decryptData(encryptedData, key, iv);

    res.setHeader(
      "Content-Disposition",
      "attachment; filename=decrypted_file.txt"
    );
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(decryptedData);
  } catch (error) {
    console.error("Error retrieving and decrypting file:", error);
    res
      .status(500)
      .send("Error retrieving and decrypting file: " + error.message);
  }
});

app.post("/uploads", upload.single("document"), async (req, res) => {
  console.log("hello");
  const file = req.file;
  console.log(file);
  const password = req.body.password1; // Corrected to match form field name

  try {
    // Calculate the hash of the uploaded document
    const hash = await calculateHash(file.path);

    const fileData = await readFile(file.path);
    const key = deriveKeyFromPassword(password);
    const { iv, encryptedData } = await encryptData(fileData, key);

    // Store the hash along with the encrypted data on IPFS
    const { cid } = await ipfs.add(encryptedData);

    // Logging info
    console.log(cid);
    console.log(iv.toString("hex"));
    console.log(key);
    console.log("Hash of the uploaded document:", hash);

    res.json({ cid, iv: iv.toString("hex"), hash }); // Send IV and hash in response
  } catch (error) {
    console.error("Error uploading and encrypting file:", error);
    res.status(500).send("Error uploading and encrypting file");
  }
});

let userAddress;
// Serve index.html when root URL is accessed
app.post("/", (req, res) => {
  userAddress = req.body.userAddress;
  console.log(userAddress);
  if (userAddress) {
    // Redirect to the home page after fetching the account address
    res.redirect("/home");
  } else {
    // Handle the case where userAddress is not present
    res.status(400).send("User address not found.");
  }
});
app.get("/getWalletAddress", (req, res) => {
  // Replace this with your actual logic to fetch the wallet address
  const walletAddress = userAddress; // Example wallet address
  // Send the wallet address data as JSON response
  res.json({ walletAddress });
});

app.get("/", (req, res) => {
  // Render the home page
  res.sendFile(path.join(__dirname, "source", "login.html"));
});
app.get("/home", (req, res) => {
  // Render the home page
  res.sendFile(path.join(__dirname, "source", "home.html"));
});

// Serve uploadDoc.html when /uploadDoc URL is accessed
app.get("/uploadDoc", (req, res) => {
  res.sendFile(path.join(__dirname, "source", "uploadDoc.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
