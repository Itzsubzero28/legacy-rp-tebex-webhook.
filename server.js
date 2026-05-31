import express from "express";
import crypto from "crypto";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

function verifyTebex(req) {
  const secret = process.env.TEBEX_WEBHOOK_SECRET;
  if (!secret) return true;

  const signature = req.header("X-Signature");
  if (!signature) return false;

  const bodyHash = crypto.createHash("sha256").update(req.rawBody).digest("hex");
  const expectedSignature = crypto.createHmac("sha256", secret).update(bodyHash).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

async function sendDiscord(payload) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) return;

  const eventType = payload.type || payload.event || "purchase";
  const transactionId = payload.id || payload.transaction?.id || "N/A";

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "Legacy RP Store",
      embeds: [{
        title: "New Tebex Event",
        color: 0x7b2cff,
        fields: [
          { name: "Event", value: String(eventType), inline: true },
          { name: "Transaction", value: String(transactionId), inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    })
  });
}

app.get("/", (req, res) => {
  res.status(200).send("Legacy RP Tebex webhook endpoint is online.");
});

app.post("/api/tebex-webhook", async (req, res) => {
  if (!verifyTebex(req)) {
    return res.status(401).send("Invalid Tebex signature");
  }

  if (req.body.type === "validation.webhook") {
    return res.status(200).json({ id: req.body.id });
  }

  await sendDiscord(req.body);
  res.status(200).json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Legacy RP Tebex webhook running on port ${PORT}`);
});
