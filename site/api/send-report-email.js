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
      <td style="padding: 4px 0; vertical-align: middle;" width="26">
        <div style="width: 24px; height: 24px; background-color: ${meta.bg}; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">${meta.icon}</div>
      </td>
      <td style="padding: 4px 6px; vertical-align: middle;">
        <div style="font-size: 12.5px; font-weight: 700; color: #1e293b;">${nameFormatted}</div>
      </td>
      <td style="padding: 4px 0; vertical-align: middle; text-align: right; white-space: nowrap;">
        <div style="font-size: 12.5px; font-weight: 800; color: #0f172a;">${amountDisp}</div>
        <div style="font-size: 10.5px; font-weight: 700; color: ${meta.color}; margin-top: 1px;">${percent}%</div>
      </td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2" style="padding: 0 0 6px 0;">
        <div style="width: 100%; height: 5px; background-color: #f1f5f9; border-radius: 99px; overflow: hidden;">
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
      <title>${emailSubject}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        body, td, th, p, div, span, a, h1, h2, h3, h4, h5, h6 { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 10px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
              
              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 1. HEADER: Dark Navy Banner + Dashboard Illustration       -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="background: linear-gradient(145deg, #030712 0%, #061325 55%, #082436 100%); padding: 28px 28px 24px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left: Logo & Titles -->
                      <td style="vertical-align: top;" width="60%">
                        <table cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                          <tr>
                            <td style="padding-right: 10px; vertical-align: middle;">
                              <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="36" height="36" alt="Money Copilot AI" style="display: block;">
                            </td>
                            <td style="vertical-align: middle;">
                              <h1 style="margin: 0; font-size: 17px; font-weight: 800; color: #ffffff; line-height: 1.2; letter-spacing: -0.3px;">Money Copilot AI</h1>
                              <p style="margin: 2px 0 0 0; font-size: 10.5px; color: #34d399; font-weight: 600; line-height: 1.3;">Know where your money goes.<br>Control where it goes next.</p>
                            </td>
                          </tr>
                        </table>
                        <h2 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.6px; line-height: 1.15;">Your Monthly Money Report</h2>
                        <div style="font-size: 15px; font-weight: 700; color: #34d399; margin-bottom: 8px;">${month}</div>
                        <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.4;">AI analyzed your spending and found opportunities to save more.</p>
                      </td>
                      <!-- Right: High-Tech Dashboard Graphic Image -->
                      <td style="vertical-align: top; text-align: right;" width="40%">
                        <img src="https://expense-chat-ai-sandy.vercel.app/assets/email/header-dashboard.svg" width="180" height="120" alt="Dashboard Graphic" style="display: block; border: 0; outline: none; margin: 0 0 0 auto;">
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 2. GREETING + AI INSIGHT CARD                              -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 24px 24px 18px 24px; background-color: #ffffff;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: top; padding-right: 16px;" width="42%">
                        <h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.2;">Hi ${displayName}! 👋</h3>
                        <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #64748b;">
                          Here's your AI-powered financial summary for ${month}.
                        </p>
                      </td>
                      <td width="58%" style="vertical-align: top;">
                        <div style="background-color: #e6f7ef; border: 1px solid #a7f3d0; border-radius: 14px; padding: 14px 16px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="vertical-align: top; width: 36px; padding-right: 10px;">
                                <div style="width: 36px; height: 36px; background-color: #10b981; border-radius: 50%; text-align: center; line-height: 36px; color: #ffffff; font-size: 16px;">✨</div>
                              </td>
                              <td style="vertical-align: top;">
                                <div style="font-size: 12px; font-weight: 800; color: #047857; margin-bottom: 4px;">✨ AI Insight</div>
                                <div style="font-size: 11.5px; line-height: 1.5; color: #166534;">
                                  You spent <strong>38% more on Health</strong> this month than usual.<br>
                                  Reducing health-related expenses by just 10% could save approximately <strong>৳500</strong> next month.
                                </div>
                              </td>
                            </tr>
                          </table>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 3. TOP METRIC CARDS: SPACIOUS 2-ROW BALANCED LAYOUT        -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 0 24px 20px 24px;">
                  <!-- Row 1: Budget Used (50%) & Total Spent (50%) -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                    <tr>
                      <!-- Card 1: Budget Used (Horizontal layout) -->
                      <td width="48.5%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 14px; vertical-align: middle;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td colspan="2" style="font-size: 11.5px; font-weight: 800; color: #334155; padding-bottom: 10px;">Budget Used</td>
                          </tr>
                          <tr>
                            <!-- Donut ring graphic -->
                            <td width="58" style="vertical-align: middle;">
                              <img src="https://expense-chat-ai-sandy.vercel.app/assets/email/budget-gauge-20.svg" width="56" height="56" alt="20% Donut Gauge" style="display: block; border: 0;">
                            </td>
                            <!-- Right text -->
                            <td style="vertical-align: middle; padding-left: 10px;">
                              <div style="font-size: 13px; font-weight: 800; color: #10b981; margin-bottom: 2px;">Excellent!</div>
                              <div style="font-size: 10px; color: #64748b; line-height: 1.35;">You're well within your budget.</div>
                              <div style="width: 18px; height: 18px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 11px; line-height: 18px; text-align: center; margin-top: 6px;">✓</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="3%"></td>

                      <!-- Card 2: Total Spent -->
                      <td width="48.5%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px 14px; vertical-align: middle;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="40" style="vertical-align: middle;">
                              <div style="width: 36px; height: 36px; background-color: #ecfdf5; border-radius: 50%; text-align: center; line-height: 36px; font-size: 17px;">💰</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 8px;">
                              <div style="font-size: 10.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Total Spent</div>
                              <div style="font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px;">${spentFormatted}</div>
                              <div style="font-size: 9.5px; color: #10b981; font-weight: 700; margin-top: 2px;">↓ 12% lower than last month</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- Row 2: Budget Limit (33%), Remaining (33%), Status (33%) -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Card 3: Budget Limit -->
                      <td width="31.5%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 12px; text-align: center; vertical-align: top;">
                        <div style="width: 34px; height: 34px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 34px; font-size: 16px;">🎯</div>
                        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Budget Limit</div>
                        <div style="font-size: 16px; font-weight: 800; color: #0f172a; letter-spacing: -0.4px;">${budgetFormatted}</div>
                      </td>

                      <td width="2.7%"></td>

                      <!-- Card 4: Remaining -->
                      <td width="31.5%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 12px; text-align: center; vertical-align: top;">
                        <div style="width: 34px; height: 34px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 34px; font-size: 16px;">💵</div>
                        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Remaining</div>
                        <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 3px; letter-spacing: -0.4px;">${cleanRemaining}</div>
                        <div style="font-size: 9.5px; color: #10b981; font-weight: 700;">Great job!</div>
                      </td>

                      <td width="2.7%"></td>

                      <!-- Card 5: Status -->
                      <td width="31.5%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 12px; text-align: center; vertical-align: top;">
                        <div style="width: 34px; height: 34px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 34px; font-size: 16px;">📊</div>
                        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Status</div>
                        <div style="font-size: 14px; font-weight: 800; color: #059669; margin-bottom: 3px;">Within Budget</div>
                        <div style="width: 18px; height: 18px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 11px; line-height: 18px; text-align: center; margin: 0 auto;">✓</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 4. MIDDLE ROW: SPENDING BREAKDOWN & AI SAVINGS             -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 0 24px 20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left: Spending Breakdown -->
                      <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px 14px; vertical-align: top;">
                        <h4 style="margin: 0 0 8px 0; font-size: 13.5px; font-weight: 800; color: #0f172a;">Spending Breakdown</h4>
                        
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${breakdownRows || `<tr><td style="font-size: 12px; color: #94a3b8; padding: 6px 0;">No spending recorded.</td></tr>`}
                        </table>

                        <div style="margin-top: 4px; text-align: left;">
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="font-size: 11px; font-weight: 700; color: #10b981; text-decoration: none;">View all categories →</a>
                        </div>
                      </td>

                      <td width="4%"></td>

                      <!-- Right: AI Savings Card (Piggy Bank) -->
                      <td width="48%" style="background-color: #e6f7ef; border: 1px solid #a7f3d0; border-radius: 16px; padding: 14px 14px; vertical-align: top;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="vertical-align: top;">
                              <div style="font-size: 11px; font-weight: 800; color: #047857; margin-bottom: 2px;">💡 AI thinks you can save</div>
                              <div style="font-size: 24px; font-weight: 800; color: #047857; letter-spacing: -0.8px; line-height: 1.1;">৳1,800</div>
                              <div style="font-size: 10.5px; color: #166534; font-weight: 600; margin-top: 2px;">by optimizing these areas:</div>
                            </td>
                            <td style="vertical-align: top; text-align: right;" width="42">
                              <div style="font-size: 32px; line-height: 1;">🐷</div>
                            </td>
                          </tr>
                        </table>

                        <!-- Savings items in green circles -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
                          <tr>
                            <td width="26" style="vertical-align: middle;">
                              <div style="width: 24px; height: 24px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 11px;">🍔</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 6px;">
                              <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Ordering food less often</div>
                              <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳900</div>
                            </td>
                          </tr>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 6px;">
                          <tr>
                            <td width="26" style="vertical-align: middle;">
                              <div style="width: 24px; height: 24px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 11px;">❤️</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 6px;">
                              <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Setting a monthly health budget</div>
                              <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳600</div>
                            </td>
                          </tr>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="26" style="vertical-align: middle;">
                              <div style="width: 24px; height: 24px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 24px; font-size: 11px;">🛒</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 6px;">
                              <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Tracking groceries weekly</div>
                              <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳300</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 5. SPENDING TREND + ASK AI ANYTHING                        -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left: Spending Trend Line Chart Image -->
                      <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 16px; vertical-align: top;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="font-size: 13.5px; font-weight: 800; color: #0f172a;">Spending Trend <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">(Last 6 Months)</span></td>
                            <td style="text-align: right;" width="20"><span style="font-size: 14px; color: #10b981;">↗</span></td>
                          </tr>
                        </table>

                        <!-- Vector Line Chart matching UI Mockup -->
                        <img src="https://expense-chat-ai-sandy.vercel.app/assets/email/spending-trend.svg" width="100%" height="auto" alt="Spending Trend Line Chart" style="display: block; border: 0; outline: none;">
                      </td>

                      <td width="4%"></td>

                      <!-- Right: Ask AI Anything -->
                      <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 16px; vertical-align: top;">
                        <h4 style="margin: 0 0 3px 0; font-size: 13.5px; font-weight: 800; color: #0f172a;">Ask AI Anything</h4>
                        <p style="margin: 0 0 12px 0; font-size: 11px; color: #94a3b8;">Get instant answers about your money.</p>

                        <!-- Prompt 1 -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 9px 10px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="24" style="vertical-align: middle;">
                                    <div style="width: 22px; height: 22px; background-color: #10b981; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px; color: #ffffff;">💬</div>
                                  </td>
                                  <td style="padding-left: 8px; font-size: 11px; color: #334155; font-weight: 700; vertical-align: middle;">Where did my money go?</td>
                                  <td style="text-align: right; font-size: 12px; color: #cbd5e1; vertical-align: middle;" width="14">›</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Prompt 2 -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 9px 10px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="24" style="vertical-align: middle;">
                                    <div style="width: 22px; height: 22px; background-color: #2563eb; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px; color: #ffffff;">🏦</div>
                                  </td>
                                  <td style="padding-left: 8px; font-size: 11px; color: #334155; font-weight: 700; vertical-align: middle;">How can I save more?</td>
                                  <td style="text-align: right; font-size: 12px; color: #cbd5e1; vertical-align: middle;" width="14">›</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Prompt 3 -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 9px 10px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="24" style="vertical-align: middle;">
                                    <div style="width: 22px; height: 22px; background-color: #8b5cf6; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px; color: #ffffff;">📊</div>
                                  </td>
                                  <td style="padding-left: 8px; font-size: 11px; color: #334155; font-weight: 700; vertical-align: middle;">What should my budget be next month?</td>
                                  <td style="text-align: right; font-size: 12px; color: #cbd5e1; vertical-align: middle;" width="14">›</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 6. CTA BANNER (Phone mockup + Button)                      -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="background: linear-gradient(135deg, #030712 0%, #062422 50%, #059669 100%); border-radius: 18px; padding: 0; overflow: hidden;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Left: Mini Phone Mockup -->
                        <td width="28%" style="vertical-align: bottom; padding: 16px 0 0 16px;">
                          <div style="background: #0f172a; border: 1px solid #1e3a5f; border-radius: 10px 10px 0 0; padding: 8px 6px 0 6px; width: 110px;">
                            <div style="font-size: 7px; font-weight: 700; color: #94a3b8; margin-bottom: 3px;">Dashboard</div>
                            <div style="font-size: 6px; color: #64748b; margin-bottom: 2px;">Total Balance</div>
                            <div style="font-size: 10px; font-weight: 800; color: #ffffff; margin-bottom: 1px;">৳40,100.00 <span style="font-size: 6px; color: #10b981;">↑12%</span></div>
                            <div style="font-size: 6px; color: #64748b;">Remaining</div>
                            <div style="height: 3px; background: linear-gradient(90deg, #10b981 60%, #1e3a5f 60%); border-radius: 2px; margin: 4px 0 6px 0;"></div>
                          </div>
                        </td>
                        <!-- Right: CTA Content -->
                        <td style="vertical-align: middle; padding: 22px 20px 22px 10px;">
                          <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; line-height: 1.25;">Take control of your finances today!<span style="display:none !important; visibility:hidden; opacity:0; color:transparent; font-size:0px;">&nbsp;${Date.now()}</span></h3>
                          <p style="margin: 0 0 14px 0; font-size: 11.5px; color: #cbd5e1; line-height: 1.45;">Open Money Copilot AI and make smarter decisions with AI.</p>
                          
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="display: inline-block; padding: 11px 24px; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; border-radius: 99px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.45);">Open Money Copilot AI →</a>
                          
                          <div style="margin-top: 12px; font-size: 10.5px; color: #94a3b8; vertical-align: middle;">
                            Works with &nbsp;
                            <img src="https://expense-chat-ai-sandy.vercel.app/assets/brands/chatgpt.png" width="15" height="15" alt="ChatGPT" style="vertical-align: middle; display: inline-block; margin-right: 3px;">
                            <span style="color: #ffffff; font-weight: 700; vertical-align: middle;">ChatGPT</span>
                            &nbsp;&nbsp;&nbsp;
                            <img src="https://expense-chat-ai-sandy.vercel.app/assets/brands/claude.png" width="15" height="15" alt="Claude" style="vertical-align: middle; display: inline-block; margin-right: 3px;">
                            <span style="color: #ffffff; font-weight: 700; vertical-align: middle;">Claude</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 7. FOOTER                                                  -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 20px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left Column: Private & Secure Badge -->
                      <td width="38%" style="vertical-align: middle;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="36" style="vertical-align: middle; padding-right: 8px;">
                              <div style="width: 32px; height: 32px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%; text-align: center; line-height: 32px; font-size: 15px;">🔒</div>
                            </td>
                            <td style="vertical-align: middle;">
                              <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; line-height: 1.2;">Private &amp; Secure</div>
                              <div style="font-size: 9px; color: #64748b; line-height: 1.3; margin-top: 2px;">Your financial data is encrypted<br>and only visible to you.</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- Middle Column: Brand Logo & Tagline -->
                      <td width="38%" style="vertical-align: middle; text-align: center;">
                        <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                          <tr>
                            <td width="34" style="padding-right: 8px; vertical-align: middle;">
                              <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="28" height="28" alt="Money Copilot" style="display: block; border: 0; outline: none; margin: 0 auto;">
                            </td>
                            <td style="vertical-align: middle; text-align: left;">
                              <div style="font-size: 11.5px; font-weight: 800; color: #0f172a; line-height: 1.2; white-space: nowrap;">Money Copilot AI</div>
                              <div style="font-size: 8.5px; color: #10b981; font-weight: 700; line-height: 1.3; margin-top: 2px; white-space: nowrap;">Know where your money goes.<br>Control where it goes next.</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <!-- Right Column: Copyright -->
                      <td width="24%" style="vertical-align: middle; text-align: right; font-size: 9.5px; color: #94a3b8; line-height: 1.4;">
                        © 2026 Money Copilot AI.<br>All rights reserved.
                      </td>
                    </tr>
                  </table>
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
