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

  // Clean remaining formatted value to prevent duplicate "remaining" text
  const cleanRemaining = (remainingFormatted || "").replace(/\s*remaining\s*/i, "").trim() || remainingFormatted;

  // Helper to strictly parse numeric amounts from number or formatted string
  const getNumericAmount = (cat) => {
    if (typeof cat.amount === "number" && !isNaN(cat.amount)) return cat.amount;
    const str = String(cat.amountFormatted || cat.amount || "0").replace(/[^0-9.]/g, "");
    return parseFloat(str) || 0;
  };

  // Color lookup for spending categories matching mockup
  const categoryMeta = {
    health: { color: "#ef4444", icon: "❤️", bg: "#fef2f2" },
    education: { color: "#3b82f6", icon: "🎓", bg: "#eff6ff" },
    food: { color: "#f97316", icon: "🍴", bg: "#fff7ed" },
    groceries: { color: "#10b981", icon: "🛒", bg: "#ecfdf5" },
    shopping: { color: "#ec4899", icon: "🛍️", bg: "#fdf2f8" },
    travel: { color: "#8b5cf6", icon: "✈️", bg: "#f5f3ff" },
    utilities: { color: "#06b6d4", icon: "⚡", bg: "#ecfeff" },
    transport: { color: "#6366f1", icon: "🚗", bg: "#eef2ff" }
  };

  // Compute category breakdown with accurate percentage bars
  const categoryTotal = (categories || []).reduce((sum, c) => sum + getNumericAmount(c), 0) || 1;
  const breakdownRows = (categories || []).slice(0, 4).map((cat) => {
    const key = (cat.name || "").toLowerCase().trim();
    const meta = categoryMeta[key] || { color: "#10b981", icon: "🏷️", bg: "#ecfdf5" };
    const nameFormatted = cat.name ? cat.name.charAt(0).toUpperCase() + cat.name.slice(1) : "Uncategorized";
    const amountVal = getNumericAmount(cat);
    const percent = Math.min(100, Math.max(1, Math.round((amountVal / categoryTotal) * 100)));
    const amountDisp = cat.amountFormatted || `${currency === "BDT" ? "৳" : currency === "USD" ? "$" : ""}${amountVal.toLocaleString("en-US")}`;

    return `
    <tr>
      <td style="padding: 3px 0; vertical-align: middle;" width="24">
        <div style="width: 22px; height: 22px; background-color: ${meta.bg}; border-radius: 50%; text-align: center; line-height: 22px; font-size: 11px;">${meta.icon}</div>
      </td>
      <td style="padding: 3px 5px; vertical-align: middle;">
        <div style="font-size: 12px; font-weight: 700; color: #1e293b;">${nameFormatted}</div>
      </td>
      <td style="padding: 3px 0; vertical-align: middle; text-align: right; white-space: nowrap;">
        <div style="font-size: 12px; font-weight: 800; color: #0f172a;">${amountDisp}</div>
        <div style="font-size: 10px; font-weight: 700; color: ${meta.color}; margin-top: 1px;">${percent}%</div>
      </td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2" style="padding: 0 0 5px 0;">
        <div style="width: 100%; height: 4px; background-color: #f1f5f9; border-radius: 99px; overflow: hidden;">
          <div style="width: ${percent}%; height: 100%; background-color: ${meta.color}; border-radius: 99px;"></div>
        </div>
      </td>
    </tr>
    `;
  }).join("");

  const emailHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>${emailSubject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body, td, th, p, div, span, a, h1, h2, h3, h4, h5, h6 { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important; }
        
        /* Compact Responsive Overrides */
        @media only screen and (max-width: 540px) {
          .email-wrapper { padding: 6px 2px !important; }
          .email-card-container { border-radius: 14px !important; width: 100% !important; }
          .email-section-padding { padding: 14px 14px !important; }
          .header-padding { padding: 16px 14px 12px 14px !important; }
          .header-title { font-size: 19px !important; line-height: 1.15 !important; }
          .header-graphic { width: 110px !important; height: auto !important; }
          .mobile-full-width { display: block !important; width: 100% !important; max-width: 100% !important; box-sizing: border-box !important; margin-left: 0 !important; margin-right: 0 !important; }
          .mobile-gap-bottom { margin-bottom: 10px !important; }
          .mobile-cta-pad { padding: 16px 14px !important; text-align: center !important; }
          .mobile-footer-col { display: block !important; width: 100% !important; max-width: 100% !important; text-align: center !important; margin-bottom: 10px !important; }
          .mobile-footer-table { margin: 0 auto !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" class="email-wrapper" style="background-color: #f1f5f9; padding: 16px 8px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" class="email-card-container" style="max-width: 600px; background-color: #ffffff; border-radius: 18px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 1. COMPACT HEADER BANNER                                   -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="header-padding" style="background: linear-gradient(145deg, #030712 0%, #061325 55%, #082436 100%); padding: 18px 20px 14px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left: Title & Info -->
                      <td style="vertical-align: top;" width="63%">
                        <table cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="padding-right: 8px; vertical-align: middle;">
                              <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="30" height="30" alt="Money Copilot AI" style="display: block; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.2);">
                            </td>
                            <td style="vertical-align: middle;">
                              <h1 style="margin: 0; font-size: 15px; font-weight: 800; color: #ffffff; line-height: 1.15; letter-spacing: -0.3px;">Money Copilot AI</h1>
                              <p style="margin: 1px 0 0 0; font-size: 9.5px; color: #34d399; font-weight: 600; line-height: 1.25;">Know where your money goes.</p>
                            </td>
                          </tr>
                        </table>
                        <h2 class="header-title" style="margin: 0 0 3px 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; line-height: 1.15;">Your Monthly Money Report</h2>
                        <div style="font-size: 13.5px; font-weight: 700; color: #34d399; margin-bottom: 4px;">${month}</div>
                        <p style="margin: 0; font-size: 10.5px; color: #94a3b8; line-height: 1.35;">AI analyzed spending &amp; found savings opportunities.</p>
                      </td>
                      <!-- Right: Dashboard Graphic Image -->
                      <td style="vertical-align: top; text-align: right;" width="37%">
                        <img src="https://expense-chat-ai-sandy.vercel.app/assets/email/header-dashboard.svg" width="135" height="90" alt="Dashboard Graphic" class="header-graphic" style="display: block; border: 0; outline: none; margin: 0 0 0 auto;">
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 2. GREETING + AI INSIGHT CARD                              -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="email-section-padding" style="padding: 16px 20px 14px 20px; background-color: #ffffff;">
                  <div style="font-size: 0; text-align: left;">
                    <!--[if mso]>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                    <td width="230" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width mobile-gap-bottom" style="display: inline-block; width: 100%; max-width: 230px; vertical-align: top; text-align: left;">
                      <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800; color: #0f172a; line-height: 1.2;">Hi ${displayName}! 👋</h3>
                      <p style="margin: 0; font-size: 12px; line-height: 1.45; color: #64748b;">
                        Here's your AI-powered financial summary for ${month}.
                      </p>
                    </div>
                    <!--[if mso]>
                    </td>
                    <td width="14" valign="top"></td>
                    <td width="308" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width" style="display: inline-block; width: 100%; max-width: 308px; vertical-align: top; text-align: left; margin-left: 10px;">
                      <div style="background-color: #e6f7ef; border: 1px solid #a7f3d0; border-radius: 12px; padding: 10px 12px;">
                        <table cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <td style="vertical-align: top; width: 30px; padding-right: 8px;">
                              <div style="width: 30px; height: 30px; background-color: #10b981; border-radius: 50%; text-align: center; line-height: 30px; color: #ffffff; font-size: 14px;">✨</div>
                            </td>
                            <td style="vertical-align: top;">
                              <div style="font-size: 11.5px; font-weight: 800; color: #047857; margin-bottom: 2px;">✨ AI Insight</div>
                              <div style="font-size: 11px; line-height: 1.4; color: #166534;">
                                You spent <strong>38% more on Health</strong> this month than usual.<br>
                                Reducing health expenses by 10% saves approx. <strong>৳500</strong>.
                              </div>
                            </td>
                          </tr>
                        </table>
                      </div>
                    </div>
                    <!--[if mso]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
                  </div>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 3. TOP METRIC CARDS                                        -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="email-section-padding" style="padding: 0 20px 14px 20px;">
                  
                  <!-- ROW 1: Budget Used (50%) & Total Spent (50%) -->
                  <div style="font-size: 0; text-align: left; margin-bottom: 8px;">
                    <!--[if mso]>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                    <td width="272" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width mobile-gap-bottom" style="display: inline-block; width: 100%; max-width: 272px; vertical-align: top; text-align: left;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 12px; box-sizing: border-box;">
                        <tr>
                          <td colspan="2" style="font-size: 11px; font-weight: 800; color: #334155; padding-bottom: 6px;">Budget Used</td>
                        </tr>
                        <tr>
                          <td width="52" style="vertical-align: middle;">
                            <img src="https://expense-chat-ai-sandy.vercel.app/assets/email/budget-gauge-20.svg" width="48" height="48" alt="20% Donut Gauge" style="display: block; border: 0;">
                          </td>
                          <td style="vertical-align: middle; padding-left: 8px;">
                            <div style="font-size: 12.5px; font-weight: 800; color: #10b981; margin-bottom: 1px;">Excellent!</div>
                            <div style="font-size: 9.5px; color: #64748b; line-height: 1.3;">Within budget.</div>
                            <div style="width: 16px; height: 16px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 10px; line-height: 16px; text-align: center; margin-top: 4px;">✓</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <!--[if mso]>
                    </td>
                    <td width="14" valign="top"></td>
                    <td width="272" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width" style="display: inline-block; width: 100%; max-width: 272px; vertical-align: top; text-align: left; margin-left: 8px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 12px; box-sizing: border-box;">
                        <tr>
                          <td width="36" style="vertical-align: middle;">
                            <div style="width: 32px; height: 32px; background-color: #ecfdf5; border-radius: 50%; text-align: center; line-height: 32px; font-size: 15px;">💰</div>
                          </td>
                          <td style="vertical-align: middle; padding-left: 8px;">
                            <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 1px;">Total Spent</div>
                            <div style="font-size: 16.5px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px;">${spentFormatted}</div>
                            <div style="font-size: 9px; color: #10b981; font-weight: 700; margin-top: 1px;">↓ 12% lower than last month</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <!--[if mso]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
                  </div>

                  <!-- ROW 2: Budget Limit (33%), Remaining (33%), Status (33%) -->
                  <div style="font-size: 0; text-align: left;">
                    <!--[if mso]>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                    <td width="178" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width mobile-gap-bottom" style="display: inline-block; width: 100%; max-width: 177px; vertical-align: top; text-align: center;">
                      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 8px; box-sizing: border-box;">
                        <div style="width: 30px; height: 30px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 6px auto; text-align: center; line-height: 30px; font-size: 14px;">🎯</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Budget Limit</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px;">${budgetFormatted}</div>
                      </div>
                    </div>
                    <!--[if mso]>
                    </td>
                    <td width="8" valign="top"></td>
                    <td width="178" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width mobile-gap-bottom" style="display: inline-block; width: 100%; max-width: 177px; vertical-align: top; text-align: center; margin-left: 6px;">
                      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 8px; box-sizing: border-box;">
                        <div style="width: 30px; height: 30px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 6px auto; text-align: center; line-height: 30px; font-size: 14px;">💵</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Remaining</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 2px; letter-spacing: -0.4px;">${cleanRemaining}</div>
                        <div style="font-size: 9px; color: #10b981; font-weight: 700;">Great job!</div>
                      </div>
                    </div>
                    <!--[if mso]>
                    </td>
                    <td width="8" valign="top"></td>
                    <td width="178" valign="top">
                    <![endif]-->
                    <div class="mobile-full-width" style="display: inline-block; width: 100%; max-width: 177px; vertical-align: top; text-align: center; margin-left: 6px;">
                      <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 10px 8px; box-sizing: border-box;">
                        <div style="width: 30px; height: 30px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 6px auto; text-align: center; line-height: 30px; font-size: 14px;">📊</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Status</div>
                        <div style="font-size: 12.5px; font-weight: 800; color: #059669; margin-bottom: 2px;">Within Budget</div>
                        <div style="width: 16px; height: 16px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 10px; line-height: 16px; text-align: center; margin: 0 auto;">✓</div>
                      </div>
                    </div>
                    <!--[if mso]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
                  </div>

                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 4. MIDDLE ROW: AI SAVINGS (COMPACT FULL WIDTH)             -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="email-section-padding" style="padding: 0 20px 14px 20px;">
                  <div style="background-color: #e6f7ef; border: 1px solid #a7f3d0; border-radius: 14px; padding: 16px 16px; box-sizing: border-box;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                      <tr>
                        <td style="vertical-align: top;">
                          <div style="font-size: 11px; font-weight: 800; color: #047857; margin-bottom: 2px;">💡 AI thinks you can save</div>
                          <div style="font-size: 24px; font-weight: 800; color: #047857; letter-spacing: -0.6px; line-height: 1.1;">৳1,800</div>
                          <div style="font-size: 10.5px; color: #166534; font-weight: 600; margin-top: 2px;">by optimizing these areas:</div>
                        </td>
                        <td style="vertical-align: top; text-align: right;" width="42">
                          <div style="font-size: 32px; line-height: 1;">🐷</div>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                      <tr>
                        <td width="28" style="vertical-align: middle;">
                          <div style="width: 24px; height: 24px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">🍔</div>
                        </td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Ordering food less often</div>
                          <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳900</div>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                      <tr>
                        <td width="28" style="vertical-align: middle;">
                          <div style="width: 24px; height: 24px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">❤️</div>
                        </td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Setting a monthly health budget</div>
                          <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳600</div>
                        </td>
                      </tr>
                    </table>

                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td width="28" style="vertical-align: middle;">
                          <div style="width: 24px; height: 24px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">🛒</div>
                        </td>
                        <td style="vertical-align: middle; padding-left: 8px;">
                          <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Tracking groceries weekly</div>
                          <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳300</div>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 5. ASK AI ANYTHING (COMPACT FULL WIDTH)                    -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="email-section-padding" style="padding: 0 20px 16px 20px;">
                  <div style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; box-sizing: border-box;">
                    <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 800; color: #0f172a;">Ask AI Anything</h4>
                    <p style="margin: 0 0 10px 0; font-size: 11px; color: #64748b;">Get instant answers about your money.</p>

                    <!-- Prompt 1 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                      <tr>
                        <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 8px 10px;">
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="text-decoration: none; display: block;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td width="24" style="vertical-align: middle;">
                                  <div style="width: 22px; height: 22px; background-color: #10b981; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px; color: #ffffff;">💬</div>
                                </td>
                                <td style="padding-left: 8px; font-size: 11.5px; color: #334155; font-weight: 700; vertical-align: middle;">Where did my money go?</td>
                                <td style="text-align: right; font-size: 13px; color: #cbd5e1; vertical-align: middle;" width="12">›</td>
                              </tr>
                            </table>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Prompt 2 -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                      <tr>
                        <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 8px 10px;">
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="text-decoration: none; display: block;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td width="24" style="vertical-align: middle;">
                                  <div style="width: 22px; height: 22px; background-color: #2563eb; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px; color: #ffffff;">🏦</div>
                                </td>
                                <td style="padding-left: 8px; font-size: 11.5px; color: #334155; font-weight: 700; vertical-align: middle;">How can I save more?</td>
                                <td style="text-align: right; font-size: 13px; color: #cbd5e1; vertical-align: middle;" width="12">›</td>
                              </tr>
                            </table>
                          </a>
                        </td>
                      </tr>
                    </table>

                    <!-- Prompt 3 -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 8px 10px;">
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="text-decoration: none; display: block;">
                            <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td width="24" style="vertical-align: middle;">
                                  <div style="width: 22px; height: 22px; background-color: #8b5cf6; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px; color: #ffffff;">📊</div>
                                </td>
                                <td style="padding-left: 8px; font-size: 11.5px; color: #334155; font-weight: 700; vertical-align: middle;">What should my budget be next month?</td>
                                <td style="text-align: right; font-size: 13px; color: #cbd5e1; vertical-align: middle;" width="12">›</td>
                              </tr>
                            </table>
                          </a>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 6. CTA BANNER (Phone mockup + Button)                      -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="email-section-padding" style="padding: 0 20px 16px 20px;">
                  <div style="background: linear-gradient(135deg, #030712 0%, #062422 50%, #059669 100%); border-radius: 16px; padding: 0; overflow: hidden;">
                    <div style="font-size: 0; text-align: left;">
                      <!--[if mso]>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                      <td width="140" valign="bottom">
                      <![endif]-->
                      <!-- Left: Mini Phone Mockup -->
                      <div class="mobile-full-width mobile-cta-pad" style="display: inline-block; width: 100%; max-width: 130px; vertical-align: bottom; padding: 14px 0 0 14px; box-sizing: border-box;">
                        <div style="background: #0f172a; border: 1px solid #1e3a5f; border-radius: 8px 8px 0 0; padding: 6px 5px 0 5px; width: 100px; margin: 0 auto;">
                          <div style="font-size: 6.5px; font-weight: 700; color: #94a3b8; margin-bottom: 2px;">Dashboard</div>
                          <div style="font-size: 5.5px; color: #64748b; margin-bottom: 1px;">Total Balance</div>
                          <div style="font-size: 9px; font-weight: 800; color: #ffffff; margin-bottom: 1px;">৳40,100.00 <span style="font-size: 5.5px; color: #10b981;">↑12%</span></div>
                          <div style="font-size: 5.5px; color: #64748b;">Remaining</div>
                          <div style="height: 3px; background: linear-gradient(90deg, #10b981 60%, #1e3a5f 60%); border-radius: 2px; margin: 3px 0 5px 0;"></div>
                        </div>
                      </div>
                      <!--[if mso]>
                      </td>
                      <td width="418" valign="middle">
                      <![endif]-->
                      <!-- Right: CTA Content -->
                      <div class="mobile-full-width mobile-cta-pad" style="display: inline-block; width: 100%; max-width: 410px; vertical-align: middle; padding: 16px 16px 16px 8px; box-sizing: border-box;">
                        <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; line-height: 1.2;">Take control of your finances today!<span style="display:none !important; visibility:hidden; opacity:0; color:transparent; font-size:0px;">&nbsp;${Date.now()}</span></h3>
                        <p style="margin: 0 0 10px 0; font-size: 11px; color: #cbd5e1; line-height: 1.4;">Open Money Copilot AI and make smarter decisions with AI.</p>
                        
                        <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="display: inline-block; padding: 9px 20px; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 12px; border-radius: 99px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">Open Money Copilot AI →</a>
                        
                        <div style="margin-top: 10px; font-size: 10px; color: #94a3b8; vertical-align: middle;">
                          Works with &nbsp;
                          <img src="https://expense-chat-ai-sandy.vercel.app/assets/brands/chatgpt.png" width="14" height="14" alt="ChatGPT" style="vertical-align: middle; display: inline-block; margin-right: 2px;">
                          <span style="color: #ffffff; font-weight: 700; vertical-align: middle;">ChatGPT</span>
                          &nbsp;&nbsp;&nbsp;
                          <img src="https://expense-chat-ai-sandy.vercel.app/assets/brands/claude.png" width="14" height="14" alt="Claude" style="vertical-align: middle; display: inline-block; margin-right: 2px;">
                          <span style="color: #ffffff; font-weight: 700; vertical-align: middle;">Claude</span>
                        </div>
                      </div>
                      <!--[if mso]>
                      </td>
                      </tr>
                      </table>
                      <![endif]-->
                    </div>
                  </div>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 7. FOOTER                                                  -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td class="email-section-padding" style="padding: 14px 20px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                  <div style="font-size: 0; text-align: left;">
                    <!--[if mso]>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                    <td width="200" valign="middle">
                    <![endif]-->
                    <!-- Left Column: Private & Secure Badge -->
                    <div class="mobile-footer-col" style="display: inline-block; width: 100%; max-width: 195px; vertical-align: middle; text-align: left;">
                      <table cellpadding="0" cellspacing="0" class="mobile-footer-table">
                        <tr>
                          <td width="32" style="vertical-align: middle; padding-right: 6px;">
                            <div style="width: 28px; height: 28px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px;">🔒</div>
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <div style="font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.2;">Private &amp; Secure</div>
                            <div style="font-size: 8.5px; color: #64748b; line-height: 1.25; margin-top: 1px;">Your financial data is encrypted<br>and only visible to you.</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <!--[if mso]>
                    </td>
                    <td width="200" valign="middle" align="center">
                    <![endif]-->
                    <!-- Middle Column: Brand Logo & Tagline -->
                    <div class="mobile-footer-col" style="display: inline-block; width: 100%; max-width: 200px; vertical-align: middle; text-align: center;">
                      <table cellpadding="0" cellspacing="0" class="mobile-footer-table" style="margin: 0 auto;">
                        <tr>
                          <td width="30" style="padding-right: 6px; vertical-align: middle;">
                            <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="24" height="24" alt="Money Copilot" style="display: block; border: 0; outline: none; margin: 0 auto; border-radius: 6px; overflow: hidden;">
                          </td>
                          <td style="vertical-align: middle; text-align: left;">
                            <div style="font-size: 11px; font-weight: 800; color: #0f172a; line-height: 1.2; white-space: nowrap;">Money Copilot AI</div>
                            <div style="font-size: 8px; color: #10b981; font-weight: 700; line-height: 1.25; margin-top: 1px; white-space: nowrap;">Know where your money goes.<br>Control where it goes next.</div>
                          </td>
                        </tr>
                      </table>
                    </div>
                    <!--[if mso]>
                    </td>
                    <td width="152" valign="middle" align="right">
                    <![endif]-->
                    <!-- Right Column: Copyright -->
                    <div class="mobile-footer-col" style="display: inline-block; width: 100%; max-width: 150px; vertical-align: middle; text-align: right;">
                      <div style="font-size: 9px; color: #94a3b8; line-height: 1.35;">
                        © 2026 Money Copilot AI.<br>All rights reserved.
                      </div>
                    </div>
                    <!--[if mso]>
                    </td>
                    </tr>
                    </table>
                    <![endif]-->
                  </div>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
      <!-- Gmail Anti-Trim Dynamic Token (Prevents Gmail from collapsing content into [...] button) -->
      <div style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; font-size:0px; line-height:0px; max-height:0px; max-width:0px; overflow:hidden;">
        Ref-${Date.now()}-${Math.random().toString(36).substring(2, 9)}
      </div>
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
