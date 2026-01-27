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
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
    h1 { color: #0070f3; }
    .container { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
    .card { background: #fff; border: 1px solid #eaeaea; border-radius: 10px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
    input, textarea { width: 100%; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; box-sizing: border-box; }
    button { background: #0070f3; color: white; border: none; padding: 12px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; width: 100%; }
    button:hover { background: #0051a2; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    .status { margin-top: 15px; padding: 10px; border-radius: 5px; display: none; }
    .success { background-color: #d4edda; color: #155724; }
    .error { background-color: #f8d7da; color: #721c24; }
    label { font-weight: bold; font-size: 0.9em; margin-bottom: 5px; display: block; }
  </style>
</head>
<body>
  <h1>📧 Email Sending API</h1>
  
  <div class="container">
    <!-- Documentation Section -->
    <div>
      <h3>Documentation</h3>
      <p><b>POST /send-mail</b></p>
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
    </div>

    <!-- Test Form Section -->
    <div class="card">
      <h3>Try it out</h3>
      <form id="emailForm">
        <label>SMTP Host</label>
        <input type="text" id="host" placeholder="smtp.gmail.com" value="smtp.gmail.com" required>
        
        <label>SMTP Port</label>
        <input type="number" id="port" placeholder="587" value="587" required>
        
        <label>SMTP User</label>
        <input type="email" id="user" placeholder="your@gmail.com" required>
        
        <label>SMTP Password (App Password)</label>
        <input type="password" id="pass" placeholder="App Password" required>

        <hr style="border: 0; border-top: 1px solid #eaeaea; margin: 20px 0;">

        <label>From</label>
        <input type="email" id="from" placeholder="your@gmail.com" required>
        
        <label>To</label>
        <input type="email" id="to" placeholder="receiver@gmail.com" required>
        
        <label>Subject</label>
        <input type="text" id="subject" placeholder="Hello" value="Test Email from API" required>
        
        <label>Body</label>
        <textarea id="body" rows="3" placeholder="Message content" required>This is a test email.</textarea>
        
        <button type="submit" id="submitBtn">Send Email</button>
      </form>
      <div id="status" class="status"></div>
    </div>
  </div>

  <script>
    document.getElementById('emailForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const status = document.getElementById('status');
      
      btn.disabled = true;
      btn.innerText = 'Sending...';
      status.style.display = 'none';

      const data = {
        smtp: {
          host: document.getElementById('host').value,
          port: parseInt(document.getElementById('port').value),
          user: document.getElementById('user').value,
          pass: document.getElementById('pass').value
        },
        mail: {
          from: document.getElementById('from').value,
          to: document.getElementById('to').value,
          subject: document.getElementById('subject').value,
          body: document.getElementById('body').value
        }
      };

      try {
        const res = await fetch('/send-mail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        const result = await res.json();
        
        status.style.display = 'block';
        if (res.ok) {
          status.className = 'status success';
          status.innerText = '✅ ' + (result.message || 'Success');
        } else {
          status.className = 'status error';
          status.innerText = '❌ ' + (result.error || 'Failed');
        }
      } catch (err) {
        status.style.display = 'block';
        status.className = 'status error';
        status.innerText = '❌ Network Error';
      }

      btn.disabled = false;
      btn.innerText = 'Send Email';
    });
  </script>
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

if (require.main === module) {
  app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
  });
}
