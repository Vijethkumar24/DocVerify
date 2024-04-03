const express = require("express");
const bodyParser = require("body-parser");
const MailParser = require("mailparser").MailParser;

const app = express();
app.use(bodyParser.json());

app.post("vaps2415@gmail.com", async (req, res) => {
  try {
    const email = req.body;
    const mailParser = new MailParser();

    mailParser.on("end", (parsedEmail) => {
      const senderEmail = parsedEmail.from.value[0].address;
      const message = parsedEmail.text;

      // Forward the email information to admin
      forwardEmailToAdmin(senderEmail, message);

      res.status(200).send("Email forwarded to admin.");
    });

    mailParser.write(email);
    mailParser.end();
  } catch (error) {
    console.error("Error processing email:", error);
    res.status(500).send("Error processing email.");
  }
});

function forwardEmailToAdmin(senderEmail, message) {
  // Implement logic to forward email information to admin
  console.log("Sender Email:", senderEmail);
  console.log("Message:", message);

  // Example: Send an HTTP request to a backend service that sends an email to the admin
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server is running on port ${PORT}");
});
