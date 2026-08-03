export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const {
    recipientEmail,
    month = "August 2026",
    currency = "BDT",
    spentFormatted = "৳0.00",
    budgetFormatted = "৳0.00",
    budgetUsed = 0,
    remainingFormatted = "৳0.00",
    incomeFormatted = "৳0.00",
    savedFormatted = "৳0.00",
    categories = [],
    displayName = "User"
  } = req.body || {};

  if (!recipientEmail || typeof recipientEmail !== "string" || !recipientEmail.includes("@")) {
    return res.status(400).json({ error: "A valid recipient email address is required." });
  }

  const emailSubject = `📊 Money Copilot Report - ${month}`;

  const categoryRows = (categories || []).slice(0, 6).map((cat) => {
    const formattedName = cat.name ? cat.name.charAt(0).toUpperCase() + cat.name.slice(1) : "Uncategorized";
    return `
    <tr>
      <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-size: 11.5px; font-weight: 600;">${formattedName}</td>
      <td style="padding: 6px 10px; border-bottom: 1px solid #f1f5f9; color: #475569; font-size: 11.5px; text-align: right; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${cat.amountFormatted || cat.amount}</td>
    </tr>
  `;
  }).join("");

  const isOver = (budgetUsed || 0) > 100;
  const statusColor = isOver ? "#dc2626" : "#059669";
  const statusBg = isOver ? "#fef2f2" : "#ecfdf5";
  const statusBorder = isOver ? "#fecaca" : "#a7f3d0";

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${emailSubject}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b1528; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b1528; padding: 20px 10px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 460px; background-color: #ffffff; border-radius: 14px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.22);">
              
              <!-- Header Bar -->
              <tr>
                <td style="background: linear-gradient(135deg, #091728 0%, #112a46 60%, #0d3b36 100%); padding: 18px 20px; text-align: center; color: #ffffff;">
                  <table align="center" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                    <tr>
                      <td style="padding-right: 10px; vertical-align: middle;">
                        <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="32" height="32" alt="Money Copilot AI" style="display: block; filter: drop-shadow(0 2px 6px rgba(16,185,129,0.35));">
                      </td>
                      <td style="vertical-align: middle; text-align: left;">
                        <h1 style="margin: 0; font-size: 18px; font-weight: 800; letter-spacing: -0.3px; color: #ffffff; line-height: 1.25;">Money Copilot AI</h1>
                        <span style="font-size: 11.5px; font-weight: 600; color: #34d399; letter-spacing: 0.2px;">Monthly Report • ${month}</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Content Area -->
              <tr>
                <td style="padding: 16px 18px; background-color: #ffffff;">
                  <p style="margin: 0 0 12px 0; font-size: 13px; line-height: 1.45; color: #475569;">
                    Hi <strong>${displayName}</strong>, here is your financial summary for <strong>${month}</strong>.
                  </p>

                  <!-- Compact Budget Usage Bar -->
                  <div style="background-color: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: ${statusColor};">Monthly Budget Usage</td>
                        <td style="font-size: 12.5px; font-weight: 800; color: ${statusColor}; text-align: right;">${budgetUsed}%</td>
                      </tr>
                    </table>
                    <div style="width: 100%; height: 5px; background-color: rgba(0,0,0,0.07); border-radius: 99px; overflow: hidden; margin-top: 5px;">
                      <div style="width: ${Math.min(100, budgetUsed || 0)}%; height: 100%; background-color: ${statusColor}; border-radius: 99px;"></div>
                    </div>
                  </div>
                  
                  <!-- Stat Cards 2x2 Grid -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 14px;">
                    <tr>
                      <td width="48%" style="padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
                        <span style="font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; display: block; margin-bottom: 2px;">Total Spent</span>
                        <strong style="font-size: 15px; font-weight: 800; color: #dc2626; letter-spacing: -0.3px;">${spentFormatted}</strong>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
                        <span style="font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; display: block; margin-bottom: 2px;">Budget Limit</span>
                        <strong style="font-size: 15px; font-weight: 800; color: #2563eb; letter-spacing: -0.3px;">${budgetFormatted}</strong>
                      </td>
                    </tr>
                    <tr><td height="6"></td></tr>
                    <tr>
                      <td width="48%" style="padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
                        <span style="font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; display: block; margin-bottom: 2px;">Remaining</span>
                        <strong style="font-size: 14px; font-weight: 800; color: ${isOver ? '#dc2626' : '#059669'}; letter-spacing: -0.3px;">${remainingFormatted}</strong>
                      </td>
                      <td width="4%"></td>
                      <td width="48%" style="padding: 8px 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; vertical-align: top;">
                        <span style="font-size: 9.5px; color: #64748b; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; display: block; margin-bottom: 2px;">Budget Status</span>
                        <strong style="font-size: 13px; font-weight: 800; color: ${isOver ? '#dc2626' : '#059669'};">${isOver ? '⚠️ Over Budget' : '✅ Within Limit'}</strong>
                      </td>
                    </tr>
                  </table>

                  ${categoryRows ? `
                  <h3 style="font-size: 12px; color: #0f172a; margin: 0 0 6px 0; font-weight: 800; letter-spacing: -0.2px;">Top Spending Categories</h3>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: separate; border-spacing: 0; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <thead>
                      <tr style="background-color: #f1f5f9; text-align: left;">
                        <th style="padding: 6px 10px; font-size: 9.5px; color: #475569; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px;">Category</th>
                        <th style="padding: 6px 10px; font-size: 9.5px; color: #475569; text-transform: uppercase; font-weight: 700; letter-spacing: 0.4px; text-align: right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${categoryRows}
                    </tbody>
                  </table>
                  ` : ''}

                  <!-- Primary CTA Button -->
                  <div style="margin-top: 14px; text-align: center;">
                    <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="display: inline-block; padding: 9px 20px; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 12.5px; border-radius: 99px; box-shadow: 0 3px 10px rgba(16, 185, 129, 0.3);">Open Dashboard →</a>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="padding: 12px 16px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 10.5px; color: #94a3b8; line-height: 1.4;">
                  <p style="margin: 0; font-weight: 600; color: #64748b;">🔒 Private &amp; Secure — Sent from your Money Copilot workspace.</p>
                  <p style="margin: 2px 0 0 0;">© 2026 Money Copilot AI. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "Money Copilot <onboarding@resend.dev>",
          to: [recipientEmail],
          subject: emailSubject,
          html: emailHtml
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Resend API error:", errorData);
        return res.status(500).json({ error: errorData.message || "Failed to send email via Resend." });
      }

      const data = await response.json();
      return res.status(200).json({ success: true, message: `Report sent successfully to ${recipientEmail}`, id: data.id });
    } catch (err) {
      console.error("Email send exception:", err);
      return res.status(500).json({ error: "Failed to dispatch email report." });
    }
  }

  console.log(`[Money Copilot Email Dispatcher] Report queued for ${recipientEmail}:`, {
    month,
    spentFormatted,
    budgetFormatted,
    budgetUsed
  });

  return res.status(200).json({
    success: true,
    simulated: true,
    message: `Report for ${month} sent successfully to ${recipientEmail}.`
  });
}
