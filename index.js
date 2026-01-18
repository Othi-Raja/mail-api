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
  max: 20, // 20 requests per 15 min per IP
  message: { error: "Too many requests" }
});
app.use("/send-mail", limiter);
/* -------------------- HELPERS -------------------- */
const allowedPorts = [465, 587, 2525,3000];
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
/* -------------------- API -------------------- */
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Email API Documentation</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; line-height: 1.6; }
    h1 { color: #333; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; }
    code { color: #c7254e; }
  </style>
</head>
<body>
  <h1>📧 Email Sending API</h1>
  <p>Use this API to send emails via your own SMTP credentials.</p>
  <h2>Endpoint</h2>
  <pre>POST /send-mail</pre>
  <h2>Headers</h2>
  <pre>Content-Type: application/json</pre>
  <h2>Request Body</h2>
  <pre>{
  "smtp": {
    "host": "smtp.gmail.com",
    "port": 587,
    "secure": false,
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
  <h2>Response</h2>
  <pre>{
  "success": true,
  "message": "Email sent successfully"
}</pre>
  <h2>Notes</h2>
  <ul>
    <li>Use Gmail App Password</li>
    <li>Ports allowed: 465, 587, 2525</li>
    <li>Rate limit: 20 requests / 15 minutes</li>
  </ul>
</body>
</html>
  `);
});
app.post("/send-mail", async (req, res) => {
  const { smtp, mail } = req.body;
  // Basic structure validation
  if (!smtp || !mail) {
    return res.status(400).json({ error: "smtp and mail are required" });
  }
  const { host, port, secure, user, pass } = smtp;
  const { from, to, subject, body } = mail;
  // Field validation
  if (!host || !port || !user || !pass) {
    return res.status(400).json({ error: "Incomplete SMTP credentials" });
  }
  if (!allowedPorts.includes(port)) {
    return res.status(400).json({ error: "SMTP port not allowed" });
  }
  if (!from || !to || !subject || !body) {
    return res.status(400).json({ error: "Missing email fields" });
  }
  if (!isValidEmail(from) || !isValidEmail(to)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  try {
    // Create transporter dynamically
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: true }
    });
    // Verify SMTP credentials
    await transporter.verify();
    // Send email
    await transporter.sendMail({
      from,
      to,
      subject,
      text: body
    });
    return res.json({
      success: true,
      message: "Email sent successfully"
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "SMTP authentication failed or email rejected"
    });
  }
});
/* -------------------- SERVER -------------------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Mail API running `);
});
