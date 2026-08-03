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

  // Color lookup for spending categories
  const categoryMeta = {
    health: { color: "#ef4444", icon: "❤️", bg: "#fef2f2" },
    education: { color: "#3b82f6", icon: "📘", bg: "#eff6ff" },
    food: { color: "#f97316", icon: "🍴", bg: "#fff7ed" },
    groceries: { color: "#10b981", icon: "🛒", bg: "#ecfdf5" },
    shopping: { color: "#ec4899", icon: "🛍️", bg: "#fdf2f8" },
    travel: { color: "#8b5cf6", icon: "✈️", bg: "#f5f3ff" },
    utilities: { color: "#06b6d4", icon: "⚡", bg: "#ecfeff" },
    transport: { color: "#6366f1", icon: "🚗", bg: "#eef2ff" }
  };

  // Compute category breakdown with percentage bars
  const categoryTotal = (categories || []).reduce((sum, c) => sum + (c.amount || 0), 0) || 1;
  const breakdownRows = (categories || []).slice(0, 4).map((cat) => {
    const key = (cat.name || "").toLowerCase().trim();
    const meta = categoryMeta[key] || { color: "#10b981", icon: "🏷️", bg: "#ecfdf5" };
    const nameFormatted = cat.name ? cat.name.charAt(0).toUpperCase() + cat.name.slice(1) : "Uncategorized";
    const amountVal = typeof cat.amount === "number" ? cat.amount : parseFloat(String(cat.amountFormatted || cat.amount || "0").replace(/[^0-9.]/g, "")) || 0;
    const percent = Math.round((amountVal / categoryTotal) * 100);
    const amountDisp = cat.amountFormatted || `${currency === "BDT" ? "৳" : currency === "USD" ? "$" : ""}${amountVal.toLocaleString("en-US")}`;

    return `
    <tr>
      <td style="padding: 8px 0; vertical-align: middle;" width="28">
        <div style="width: 28px; height: 28px; background-color: ${meta.bg}; border-radius: 50%; text-align: center; line-height: 28px; font-size: 13px;">${meta.icon}</div>
      </td>
      <td style="padding: 8px 6px; vertical-align: middle;">
        <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${nameFormatted}</div>
      </td>
      <td style="padding: 8px 0; vertical-align: middle; text-align: right; white-space: nowrap;" width="80">
        <strong style="font-size: 13px; font-weight: 800; color: #0f172a;">${amountDisp}</strong>
      </td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2" style="padding: 0 0 4px 0;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td>
              <div style="width: 100%; height: 6px; background-color: #f1f5f9; border-radius: 99px; overflow: hidden;">
                <div style="width: ${Math.min(100, percent)}%; height: 100%; background-color: ${meta.color}; border-radius: 99px;"></div>
              </div>
            </td>
            <td style="padding-left: 8px; width: 32px; text-align: right;">
              <span style="font-size: 11px; color: ${meta.color}; font-weight: 700;">${percent}%</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    `;
  }).join("");

  // SVG for header dashboard illustration
  const headerGraphicSvg = `<svg width="160" height="120" viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
    <!-- Bar chart -->
    <rect x="8" y="60" width="12" height="40" rx="3" fill="#10b981" opacity="0.5"/>
    <rect x="24" y="45" width="12" height="55" rx="3" fill="#10b981" opacity="0.7"/>
    <rect x="40" y="30" width="12" height="70" rx="3" fill="#10b981"/>
    <rect x="56" y="50" width="12" height="50" rx="3" fill="#34d399" opacity="0.6"/>
    <!-- Pie/donut segment -->
    <circle cx="110" cy="45" r="28" stroke="#1e3a5f" stroke-width="8" fill="none" opacity="0.3"/>
    <circle cx="110" cy="45" r="28" stroke="#10b981" stroke-width="8" fill="none" stroke-dasharray="44 132" stroke-dashoffset="0" stroke-linecap="round"/>
    <circle cx="110" cy="45" r="28" stroke="#34d399" stroke-width="8" fill="none" stroke-dasharray="26 150" stroke-dashoffset="-44" stroke-linecap="round" opacity="0.7"/>
    <!-- Speedometer arc -->
    <path d="M 20 105 A 30 30 0 0 1 80 105" stroke="#1e3a5f" stroke-width="5" fill="none" opacity="0.3" stroke-linecap="round"/>
    <path d="M 20 105 A 30 30 0 0 1 60 82" stroke="#10b981" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="58" cy="84" r="3" fill="#34d399"/>
    <!-- Currency symbol -->
    <text x="105" y="100" fill="#34d399" font-size="18" font-weight="800" font-family="sans-serif" opacity="0.6">৳</text>
    <!-- Decorative dots -->
    <circle cx="140" cy="20" r="2" fill="#10b981" opacity="0.4"/>
    <circle cx="148" cy="35" r="1.5" fill="#34d399" opacity="0.3"/>
    <circle cx="5" cy="25" r="1.5" fill="#10b981" opacity="0.3"/>
  </svg>`;

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
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color: #0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 10px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.07); border: 1px solid #e2e8f0;">
              
              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 1. HEADER: Dark Navy Banner + Dashboard Illustration       -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="background: linear-gradient(145deg, #040914 0%, #0a1a2e 60%, #0d2a3a 100%); padding: 28px 28px 26px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left: Brand + Title -->
                      <td style="vertical-align: top;" width="62%">
                        <table cellpadding="0" cellspacing="0" style="margin-bottom: 18px;">
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
                        <div style="font-size: 16px; font-weight: 800; color: #34d399; margin-bottom: 8px;">${month}</div>
                        <p style="margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.4;">AI analyzed your spending and found opportunities to save more.</p>
                      </td>
                      <!-- Right: Dashboard Illustration -->
                      <td style="vertical-align: top; text-align: right;" width="38%">
                        ${headerGraphicSvg}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 2. GREETING + AI INSIGHT CARD                              -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 26px 24px 18px 24px; background-color: #ffffff;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: top; padding-right: 16px;" width="40%">
                        <h3 style="margin: 0 0 6px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.2;">Hi ${displayName}! 👋</h3>
                        <p style="margin: 0; font-size: 12.5px; line-height: 1.55; color: #64748b;">
                          Here's your AI-powered financial summary for ${month}.
                        </p>
                      </td>
                      <td width="60%" style="vertical-align: top;">
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 14px 16px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="vertical-align: top; width: 36px; padding-right: 10px;">
                                <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 50%; text-align: center; line-height: 36px; color: #ffffff; font-size: 16px;">✨</div>
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
              <!-- 3. METRIC CARDS ROW                                        -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 0 24px 20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Card 1: Budget Used (Horizontal layout: gauge left, text right) -->
                      <td width="36%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 12px; vertical-align: middle;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align: middle; text-align: left;" colspan="2">
                              <div style="font-size: 11px; font-weight: 800; color: #334155; margin-bottom: 10px;">Budget Used</div>
                            </td>
                          </tr>
                          <tr>
                            <!-- Donut gauge -->
                            <td width="70" style="vertical-align: middle;">
                              <div style="width: 64px; height: 64px; border-radius: 50%; background: conic-gradient(#10b981 0% ${budgetUsed}%, #e2e8f0 ${budgetUsed}% 100%); text-align: center;">
                                <div style="width: 48px; height: 48px; background-color: #ffffff; border-radius: 50%; line-height: 48px; text-align: center; font-size: 15px; font-weight: 800; color: #047857; margin: 8px auto; display: inline-block;">
                                  ${budgetUsed}%
                                </div>
                              </div>
                            </td>
                            <!-- Right text -->
                            <td style="vertical-align: middle; padding-left: 8px;">
                              <div style="font-size: 12px; font-weight: 800; color: #10b981; margin-bottom: 2px;">Excellent!</div>
                              <div style="font-size: 9.5px; color: #94a3b8; line-height: 1.35;">You're well within your budget.</div>
                              <div style="width: 18px; height: 18px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 11px; line-height: 18px; text-align: center; margin-top: 4px;">✓</div>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="1.5%"></td>

                      <!-- Card 2: Total Spent -->
                      <td width="15%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 6px; text-align: center; vertical-align: top;">
                        <div style="width: 32px; height: 32px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 32px; font-size: 15px;">💰</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Total Spent</div>
                        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px; letter-spacing: -0.3px;">${spentFormatted}</div>
                        <div style="font-size: 8.5px; color: #10b981; font-weight: 700; line-height: 1.3;">↓ 12% lower<br>than last month</div>
                      </td>

                      <td width="1.5%"></td>

                      <!-- Card 3: Budget Limit -->
                      <td width="15%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 6px; text-align: center; vertical-align: top;">
                        <div style="width: 32px; height: 32px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 32px; font-size: 15px;">🎯</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Budget Limit</div>
                        <div style="font-size: 15px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">${budgetFormatted}</div>
                      </td>

                      <td width="1.5%"></td>

                      <!-- Card 4: Remaining -->
                      <td width="15%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 6px; text-align: center; vertical-align: top;">
                        <div style="width: 32px; height: 32px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 32px; font-size: 15px;">💵</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Remaining</div>
                        <div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 4px; letter-spacing: -0.3px;">${remainingFormatted}</div>
                        <div style="font-size: 9px; color: #10b981; font-weight: 700;">Great job!</div>
                      </td>

                      <td width="1.5%"></td>

                      <!-- Card 5: Status -->
                      <td width="15%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 6px; text-align: center; vertical-align: top;">
                        <div style="width: 32px; height: 32px; background-color: #ecfdf5; border-radius: 50%; margin: 0 auto 8px auto; text-align: center; line-height: 32px; font-size: 15px;">📊</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 4px;">Status</div>
                        <div style="font-size: 14px; font-weight: 800; color: #059669; line-height: 1.25; margin-bottom: 4px;">Within<br>Budget</div>
                        <div style="width: 18px; height: 18px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 11px; line-height: 18px; text-align: center; margin: 0 auto;">✓</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ═══════════════════════════════════════════════════════════ -->
              <!-- 4. SPENDING BREAKDOWN + AI SAVINGS                         -->
              <!-- ═══════════════════════════════════════════════════════════ -->
              <tr>
                <td style="padding: 0 24px 20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left: Spending Breakdown -->
                      <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 16px; vertical-align: top;">
                        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Spending Breakdown</h4>
                        
                        <table width="100%" cellpadding="0" cellspacing="0">
                          ${breakdownRows || `<tr><td style="font-size: 12px; color: #94a3b8; padding: 8px 0;">No spending recorded.</td></tr>`}
                        </table>

                        <div style="margin-top: 10px; text-align: left;">
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="font-size: 11.5px; font-weight: 700; color: #10b981; text-decoration: none;">View all categories →</a>
                        </div>
                      </td>

                      <td width="4%"></td>

                      <!-- Right: AI Savings Card -->
                      <td width="48%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 18px 16px; vertical-align: top;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                          <tr>
                            <td style="vertical-align: top;">
                              <div style="font-size: 12px; font-weight: 800; color: #047857; margin-bottom: 4px;">💡 AI thinks you can save</div>
                              <div style="font-size: 28px; font-weight: 800; color: #047857; letter-spacing: -0.8px; line-height: 1.1;">৳1,800</div>
                              <div style="font-size: 11.5px; color: #166534; font-weight: 600; margin-top: 4px;">by optimizing these areas:</div>
                            </td>
                            <td style="vertical-align: top; text-align: right;" width="60">
                              <div style="font-size: 40px; line-height: 1;">🐷</div>
                            </td>
                          </tr>
                        </table>

                        <!-- Savings items -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                          <tr>
                            <td width="28" style="vertical-align: middle;">
                              <div style="width: 26px; height: 26px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 26px; font-size: 12px;">🍔</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 8px;">
                              <div style="font-size: 11.5px; font-weight: 700; color: #0f172a;">Ordering food less often</div>
                              <div style="font-size: 10px; color: #059669; font-weight: 600;">Save up to ৳900</div>
                            </td>
                          </tr>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                          <tr>
                            <td width="28" style="vertical-align: middle;">
                              <div style="width: 26px; height: 26px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 26px; font-size: 12px;">❤️</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 8px;">
                              <div style="font-size: 11.5px; font-weight: 700; color: #0f172a;">Setting a monthly health budget</div>
                              <div style="font-size: 10px; color: #059669; font-weight: 600;">Save up to ৳600</div>
                            </td>
                          </tr>
                        </table>

                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="28" style="vertical-align: middle;">
                              <div style="width: 26px; height: 26px; background-color: #d1fae5; border-radius: 50%; text-align: center; line-height: 26px; font-size: 12px;">🛒</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 8px;">
                              <div style="font-size: 11.5px; font-weight: 700; color: #0f172a;">Tracking groceries weekly</div>
                              <div style="font-size: 10px; color: #059669; font-weight: 600;">Save up to ৳300</div>
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
                      <!-- Left: Spending Trend -->
                      <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 16px; vertical-align: top;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
                          <tr>
                            <td style="font-size: 13px; font-weight: 800; color: #0f172a;">Spending Trend <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">(Last 6 Months)</span></td>
                            <td style="text-align: right;" width="20"><span style="font-size: 14px; color: #10b981;">↗</span></td>
                          </tr>
                        </table>

                        <!-- Chart with Y-axis labels -->
                        <table cellpadding="0" cellspacing="0" width="100%">
                          <tr>
                            <!-- Y-axis labels -->
                            <td width="30" style="vertical-align: top; padding-right: 4px;">
                              <table cellpadding="0" cellspacing="0" width="100%" style="height: 80px;">
                                <tr><td style="font-size: 8px; color: #94a3b8; font-weight: 600; vertical-align: top; height: 20px;">৳15K</td></tr>
                                <tr><td style="font-size: 8px; color: #94a3b8; font-weight: 600; vertical-align: middle; height: 20px;">৳10K</td></tr>
                                <tr><td style="font-size: 8px; color: #94a3b8; font-weight: 600; vertical-align: middle; height: 20px;">৳5K</td></tr>
                                <tr><td style="font-size: 8px; color: #94a3b8; font-weight: 600; vertical-align: bottom; height: 20px;">৳0</td></tr>
                              </table>
                            </td>
                            <!-- Chart area -->
                            <td style="vertical-align: top;">
                              <svg width="100%" height="80" viewBox="0 0 180 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <!-- Grid lines -->
                                <line x1="0" y1="0" x2="180" y2="0" stroke="#f1f5f9" stroke-width="0.5"/>
                                <line x1="0" y1="20" x2="180" y2="20" stroke="#f1f5f9" stroke-width="0.5"/>
                                <line x1="0" y1="40" x2="180" y2="40" stroke="#f1f5f9" stroke-width="0.5"/>
                                <line x1="0" y1="60" x2="180" y2="60" stroke="#f1f5f9" stroke-width="0.5"/>
                                <!-- Area fill -->
                                <path d="M6 52 L36 44 L72 30 L108 50 L144 40 L174 34 L174 78 L6 78 Z" fill="url(#trendGradV2)" opacity="0.35"/>
                                <!-- Line -->
                                <path d="M6 52 L36 44 L72 30 L108 50 L144 40 L174 34" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <!-- Dots -->
                                <circle cx="6" cy="52" r="3.5" fill="#10b981"/>
                                <circle cx="36" cy="44" r="3.5" fill="#10b981"/>
                                <circle cx="72" cy="30" r="3.5" fill="#10b981"/>
                                <circle cx="108" cy="50" r="3.5" fill="#10b981"/>
                                <circle cx="144" cy="40" r="3.5" fill="#10b981"/>
                                <circle cx="174" cy="34" r="5" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
                                <defs>
                                  <linearGradient id="trendGradV2" x1="0" y1="0" x2="0" y2="78" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#10b981"/>
                                    <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
                                  </linearGradient>
                                </defs>
                              </svg>
                            </td>
                          </tr>
                        </table>
                        <!-- X-axis labels -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 2px;">
                          <tr>
                            <td width="30"></td>
                            <td>
                              <table width="100%" cellpadding="0" cellspacing="0" style="font-size: 9px; color: #94a3b8; text-align: center;">
                                <tr>
                                  <td width="16%">Mar</td>
                                  <td width="16%">Apr</td>
                                  <td width="18%">May</td>
                                  <td width="18%">Jun</td>
                                  <td width="16%">Jul</td>
                                  <td width="16%" style="font-weight: 800; color: #10b981;">Aug</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>
                      </td>

                      <td width="4%"></td>

                      <!-- Right: Ask AI Anything -->
                      <td width="48%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px 16px; vertical-align: top;">
                        <h4 style="margin: 0 0 3px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Ask AI Anything</h4>
                        <p style="margin: 0 0 14px 0; font-size: 11px; color: #94a3b8;">Get instant answers about your money.</p>

                        <!-- Prompt 1 -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="24" style="vertical-align: middle;">
                                    <div style="width: 22px; height: 22px; background-color: #e0f2fe; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px;">💬</div>
                                  </td>
                                  <td style="padding-left: 8px; font-size: 11.5px; color: #334155; font-weight: 600; vertical-align: middle;">Where did my money go?</td>
                                  <td style="text-align: right; font-size: 14px; color: #cbd5e1; vertical-align: middle;" width="16">›</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Prompt 2 -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="24" style="vertical-align: middle;">
                                    <div style="width: 22px; height: 22px; background-color: #fef3c7; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px;">🏦</div>
                                  </td>
                                  <td style="padding-left: 8px; font-size: 11.5px; color: #334155; font-weight: 600; vertical-align: middle;">How can I save more?</td>
                                  <td style="text-align: right; font-size: 14px; color: #cbd5e1; vertical-align: middle;" width="16">›</td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Prompt 3 -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 10px 12px;">
                              <table width="100%" cellpadding="0" cellspacing="0">
                                <tr>
                                  <td width="24" style="vertical-align: middle;">
                                    <div style="width: 22px; height: 22px; background-color: #ede9fe; border-radius: 6px; text-align: center; line-height: 22px; font-size: 11px;">📊</div>
                                  </td>
                                  <td style="padding-left: 8px; font-size: 11.5px; color: #334155; font-weight: 600; vertical-align: middle;">What should my budget be next month?</td>
                                  <td style="text-align: right; font-size: 14px; color: #cbd5e1; vertical-align: middle;" width="16">›</td>
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
                  <div style="background: linear-gradient(135deg, #051829 0%, #0a2e3d 45%, #0d3832 100%); border-radius: 18px; padding: 0; overflow: hidden;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Left: Phone Mockup -->
                        <td width="25%" style="vertical-align: bottom; padding: 16px 0 0 16px;">
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
                          <h3 style="margin: 0 0 6px 0; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; line-height: 1.25;">Take control of your finances today!</h3>
                          <p style="margin: 0 0 14px 0; font-size: 11.5px; color: #cbd5e1; line-height: 1.45;">Open Money Copilot AI and make smarter decisions with AI.</p>
                          
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="display: inline-block; padding: 11px 24px; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; border-radius: 99px; box-shadow: 0 4px 16px rgba(16, 185, 129, 0.45);">Open Money Copilot AI →</a>
                          
                          <div style="margin-top: 12px; font-size: 10.5px; color: #94a3b8;">
                            Works with &nbsp;<span style="color: #34d399; font-weight: 700;">🤖 ChatGPT</span>&nbsp;&nbsp;<span style="color: #34d399; font-weight: 700;">✳️ Claude</span>
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
                <td style="padding: 18px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="35%" style="vertical-align: middle;">
                        <table cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align: middle; padding-right: 6px;">
                              <div style="width: 24px; height: 24px; background-color: #f1f5f9; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px;">🔒</div>
                            </td>
                            <td style="vertical-align: middle;">
                              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Private &amp; Secure</div>
                              <div style="font-size: 9px; color: #64748b; line-height: 1.3;">Your financial data is encrypted<br>and only visible to you.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="35%" style="vertical-align: middle; text-align: center;">
                        <table cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                          <tr>
                            <td style="padding-right: 6px; vertical-align: middle;">
                              <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="22" height="22" alt="" style="display: block;">
                            </td>
                            <td style="vertical-align: middle;">
                              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">Money Copilot AI</div>
                              <div style="font-size: 8.5px; color: #10b981; font-weight: 600;">Know where your money goes.<br>Control where it goes next.</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td width="30%" style="vertical-align: middle; text-align: right; font-size: 9.5px; color: #94a3b8; line-height: 1.4;">
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
