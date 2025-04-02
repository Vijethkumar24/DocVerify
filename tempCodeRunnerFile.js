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