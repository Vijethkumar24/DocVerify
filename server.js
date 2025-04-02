import express from "express";
import multer from "multer";
import * as IPFS from "ipfs-http-client";
import crypto from "crypto";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import { readFile } from "fs/promises";
import MemoryStore from "memorystore";
import DocumentRegistryABI from "./build/contracts/DocumentRegistry.json" assert { type: "json" };
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import session from "express-session";
import bodyParser from "body-parser";
import nodemailer from "nodemailer";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();
// const redisClient = createClient({
//   url: process.env.REDIS_URL,
//   legacyMode: true,
// });
// redisClient.connect().catch(console.error);
let userAddress;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// app.use(
//   session({
//     store: new RedisStore({
//       client: redisClient,
//     }),
//     resave: false,
//     saveUninitialized: false,
//     secret: process.env.SESSION_SECRET || "fallback_secret",
//     cookie: { secure: process.env.NODE_ENV === "production" },
//   })
// );
// Initialize Redis Store

// app.use(express.urlencoded({ extended: true }));

const generateSecureKey = () => {
  return crypto.randomBytes(32).toString("hex");
};
const secureKey = generateSecureKey();
//session
const MemoryStoreInstance = MemoryStore(session);
app.use(
  session({
    store: new MemoryStoreInstance({ checkPeriod: 86400000 }), // Check every 24 hours
    secret: process.env.SESSION_SECRET || "fallback_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production" },
  })
);
//generate secure key for login

const isLoggedIn = (req, res, next) => {
  if (req.session.userAddress) {
    next();
  } else {
    res.redirect("/");
  }
};

// Serve static content from the "public" directory
app.use("/public", express.static(path.join(__dirname, "public")));

// Serve the file to express
app.use(express.static(path.join(__dirname, "source")));
app.use(express.static(path.join(__dirname, "assets/images")));
app.use(express.static(path.join(__dirname, "assets/styles")));
app.use(express.static(path.join(__dirname, "assets/scripts")));

app.use(express.json());

const upload = multer({ dest: "uploads/" });
app.set("trust proxy", 1);
const s3Client = new S3Client({
  region: "us-east-1",
  endpoint: "https://s3.filebase.com",
  credentials: {
    accessKeyId: process.env.FILEBASE_ACCESS_KEY,
    secretAccessKey: process.env.FILEBASE_SECRET_KEY,
  },
  forcePathStyle: true,
});

async function uploadFileToS3(bucket, key, body) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
  });
  await s3Client.send(command);
}
async function retrieveFileFromS3(bucket, key) {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  const { Body } = await s3Client.send(command);
  const chunks = [];
  for await (const chunk of Body) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
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
async function retrieveDataFromFilebase(cid) {
  try {
    const params = {
      Bucket: process.env.FILEBASE_BUCKET, // Bucket stored in .env
      Key: cid, // Retrieve this from blockchain
    };
    // Use the Filebase API to retrieve the file using the CID
    const file = await filebaseClient.getObject(params).promise();

    if (!file) {
      throw new Error("File not found on Filebase");
    }

    return Buffer.from(file.Body);
  } catch (error) {
    console.error("Error retrieving data from Filebase:", error);
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
  const { filename, fileType, cid, iv, password, documentHash } = req.body;

  try {
    if (!cid || !password || !iv) {
      throw new Error("Missing required parameters (CID, password, IV)");
    }
    const encryptedData = await retrieveFileFromS3(
      process.env.FILEBASE_BUCKET,
      cid
    ); // Wait for IPFS data retrieval
    const key = deriveKeyFromPassword(password);
    const newIv = Buffer.from(iv, "hex"); // Convert hex string to Buffer

    const decryptedData = await decryptData(encryptedData, key, newIv);

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(decryptedData);
  } catch (error) {
    console.error("Error retrieving and decrypting file:", error);
    res
      .status(500)
      .send("Error retrieving and decrypting file: " + error.message);
  }
});
app.get("/getContractAddress", async (req, res) => {
  const contractAddress = process.env.CONTRACT_ADDRESS;
  if (!contractAddress)
    return res.status(500).send("Contract address not found");
  res.json({ contractAddress });
});
app.get("/getInfuraUrl", async (req, res) => {
  const infuraurl = process.env.INFURA_URL;
  if (!infuraurl) return res.status(500).send("Infura url not found");
  res.json({ infuraurl });
});
app.post("/getDocHash", upload.single("document"), async (req, res) => {
  const file = req.file;
  hash = await calculateHash(file.path);
  const Docabi = DocumentRegistryABI.abi;
  res.json({ hash, Docabi });
});

let hash;
app.post("/uploads", upload.single("document"), async (req, res) => {
  const file = req.file;
  const password = req.body.password1;
  // Corrected to match form field name
  const fileName = req.file.originalname; // Corrected to get the original file name
  const fileType = req.file.mimetype;
  const fileCategory = req.body.Category;
  const Docabi = DocumentRegistryABI.abi;
  try {
    // Calculate the hash of the uploaded document
    hash = await calculateHash(file.path);

    // Send document details to contract
    const fileData = await readFile(file.path);
    const Dockey = deriveKeyFromPassword(password);
    const { iv, encryptedData } = await encryptData(fileData, Dockey);

    // Store the hash along with the encrypted data on IPFS

    // Logging info
    const filebaseBucket = "myipfsbucket";
    const filebaseKey = `documents/${fileName}`;

    await uploadFileToS3(filebaseBucket, filebaseKey, encryptedData);
    const filebaseResponse = { Key: filebaseKey }; // Manually set response
    // Retrieve the CID (hash) from Filebase
    const cid = filebaseResponse.Key;
    const resCid = cid;
    res.json({
      fileName,
      fileType,
      fileCategory,
      resCid,
      iv: iv.toString("hex"),
      hash,
      Docabi,
      password,
    });
    // Send IV and hash in response
  } catch (error) {
    console.error("Error uploading and encrypting file:", error);
    res.status(500).send("Error uploading and encrypting file");
  }
});

// Serve index.html when root URL is accessed
app.post("/", (req, res) => {
  const userAddress = req.body.userAddress;

  if (!userAddress) {
    return res.status(400).send("User address not found.");
  }

  req.session.userAddress = userAddress;

  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).send("Error saving session.");
    }
    // console.log("Session saved successfully:", req.session);
    res.redirect("/home");
  });
});

//get All transctions
app.get("/etherscan-data", async (req, res) => {
  try {
    const address = req.query.address;
    const etherscanUrl = `https://sepolia.etherscan.io/address/${address}`;
    const response = await fetch(etherscanUrl);
    const html = await response.text();
    res.send(html);
  } catch (error) {
    console.error("Error fetching data from Etherscan:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/getWalletAddress", async (req, res) => {
  // Get userAddress from session
  // console.log("Get Wallet Adress Session Data:", req.session);
  const walletAddress = req.session.userAddress;
  // console.log(walletAddress);
  // Send the wallet address data as JSON response
  res.json({ walletAddress });
});

// Route to handle form submissions
app.post("/send-message", upload.none(), (req, res) => {
  // Get form data
  const { name, email, subject, message } = req.body;
  // Create transporter
  const transporter = nodemailer.createTransport({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: process.env.USER_APP_EMAIL,
      pass: process.env.USER_APP_PASS,
    },
  });

  // Email options
  const mailOptions = {
    from: email,
    to: process.env.USER_APP_EMAIL, // Change this to your admin email address
    subject: subject,
    text: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`,
  };

  // Send email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error(error);
      res.status(500).send("Failed to send message. Please try again later.");
    } else {
      res.send("Message sent successfully.");
    }
  });
});

app.get("/getdocHash", async (req, res) => {
  // Replace this with your actual logic to fetch the wallet address
  const Dochash = hash; // Example wallet address
  // Send the wallet address data as JSON response
  res.json({ Dochash });
});

app.get("/", (req, res) => {
  // Render the home page
  res.sendFile(path.join(__dirname, "source", "login.html"));
});
app.get("/userVerfiedDoc", (req, res) => {
  // Render the home page
  res.sendFile(path.join(__dirname, "source", "userVerfiedDocumnets.html"));
});
app.get("/home", (req, res) => {
  // Render the home page
  res.sendFile(path.join(__dirname, "source", "home.html"));
});

//fetct contract abi
app.get("/getContractABI", async (req, res) => {
  const resABI = DocumentRegistryABI.abi;
  res.json({ resABI });
});

app.get("/verify", (req, res) => {
  // Render the home page
  res.sendFile(path.join(__dirname, "source", "userVerfiedDocumnets.html"));
});
// Serve uploadDoc.html when /uploadDoc URL is accessed
app.get("/uploadDoc", (req, res) => {
  res.sendFile(path.join(__dirname, "source", "uploadDoc.html"));
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  // const railwayHost = process.env.RAILWAY_PUBLIC_DOMAIN || `localhost:${PORT}`;
  console.log(`Server is running on http://localhost:${PORT}`);
});
