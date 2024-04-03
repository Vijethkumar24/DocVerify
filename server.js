import express from "express";
import multer from "multer";
import * as IPFS from "ipfs-http-client";
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

//serve the file to express
app.use(express.static(path.join(__dirname, "source")));
app.use(express.static(path.join(__dirname, "assets/images")));
app.use(express.static(path.join(__dirname, "assets/styles")));
app.use(express.static(path.join(__dirname, "assets/scripts")));

const port = 3000;
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
    const fileData = await readFile(file.path);
    const key = deriveKeyFromPassword(password);
    const { iv, encryptedData } = await encryptData(fileData, key);
    const { cid } = await ipfs.add(encryptedData);

    // Logging info
    console.log(cid);
    console.log(iv.toString("hex"));
    console.log(key);

    res.json({ cid, iv: iv.toString("hex") }); // Send IV in hex format
  } catch (error) {
    console.error("Error uploading and encrypting file:", error);
    res.status(500).send("Error uploading and encrypting file");
  }
});

// Serve index.html when root URL is accessed
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "source", "index.html"));
});

// Serve uploadDoc.html when /uploadDoc.html URL is accessed
app.get("/uploadDoc.html", (req, res) => {
  res.sendFile(path.join(__dirname, "source", "uploadDoc.html"));
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
