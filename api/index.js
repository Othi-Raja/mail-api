const express = require("express");
const nodemailer = require("nodemailer");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();

/* -------------------- MIDDLEWARE -------------------- */
app.use(express.json({ limit: "100kb" }));
app.use(cors());
app.use(helmet());

/* -------------------- RATE LIMIT -------------------- */
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many requests" }
});
app.use(limiter);

/* -------------------- HELPERS -------------------- */
const allowedPorts = [465, 587, 2525];

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* -------------------- DOC PAGE -------------------- */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Email API Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    pre { background: #f4f4f4; padding: 15px; }
  </style>
</head>
<body>
  <h1>📧 Email Sending API</h1>
  <p><b>POST /api/send-mail</b></p>
  <pre>{
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "user": "your@gmail.com",
    "pass": "APP_PASSWORD"
  },
  "mail": {
    "from": "your@gmail.com",
    "to": "receiver@gmail.com",
    "subject": "Hello",
    "body": "Test email"
  }
}</pre>
</body>
</html>
`);
});

/* -------------------- SEND MAIL -------------------- */
app.post("/send-mail", async (req, res) => {
  const { smtp, mail } = req.body;

  if (!smtp || !mail) {
    return res.status(400).json({ error: "smtp and mail are required" });
  }

  const { host, port, user, pass } = smtp;
  const { from, to, subject, body } = mail;

  if (!host || !port || !user || !pass) {
    return res.status(400).json({ error: "Incomplete SMTP credentials" });
  }

  if (!allowedPorts.includes(port)) {
    return res.status(400).json({ error: "SMTP port not allowed" });
  }

  if (!isValidEmail(from) || !isValidEmail(to)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: true }
    });

    await transporter.verify();

    await transporter.sendMail({
      from,
      to,
      subject,
      text: body
    });

    return res.json({ success: true, message: "Email sent successfully" });

  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "SMTP authentication failed or email rejected"
    });
  }
});

module.exports = app;
