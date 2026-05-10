import nodemailer from "nodemailer";

/** Where subscription notifications are delivered (your inbox). */
const NOTIFY_EMAIL =
  process.env.NEWSLETTER_TO_EMAIL?.trim() || "bhurtelkhani068@gmail.com";

function createMailTransport() {
  const gmailUser = process.env.GMAIL_USER?.trim();
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPass },
    });
  }

  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (host && user && pass) {
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE === "true" || port === 465;
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  return null;
}

export const subscribeNewsletter = async (req, res) => {
  try {
    const raw = String(req.body?.email ?? "").trim();
    const email = raw.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    const transport = createMailTransport();
    const fromAddr =
      process.env.NEWSLETTER_FROM?.trim() ||
      process.env.GMAIL_USER?.trim() ||
      process.env.SMTP_USER?.trim();

    if (!transport || !fromAddr) {
      console.warn(
        "[newsletter] SMTP not configured (set GMAIL_USER + GMAIL_APP_PASSWORD or SMTP_HOST/SMTP_USER/SMTP_PASS). Subscriber:",
        email
      );
      return res.status(503).json({
        success: false,
        message:
          "Newsletter signup is not configured yet. Please email bhurtelkhani068@gmail.com directly.",
      });
    }

    await transport.sendMail({
      from: `"Rosh-AI" <${fromAddr}>`,
      to: NOTIFY_EMAIL,
      replyTo: email,
      subject: `[Rosh-AI] New newsletter subscriber — ${email}`,
      text: `New newsletter subscription\n\nSubscriber email: ${email}\nTime (UTC): ${new Date().toISOString()}\n`,
      html: `<p><strong>New Rosh-AI newsletter subscriber</strong></p>
<p>Email: <a href="mailto:${email}">${email}</a></p>
<p><small>${new Date().toISOString()}</small></p>`,
    });

    return res.json({
      success: true,
      message: "Thanks — you're subscribed!",
    });
  } catch (err) {
    console.error("[newsletter] send failed:", err?.message ?? err);
    return res.status(500).json({
      success: false,
      message: "Could not complete signup. Try again in a moment.",
    });
  }
};
