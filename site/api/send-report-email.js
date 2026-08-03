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
    education: { color: "#3b82f6", icon: "🎓", bg: "#eff6ff" },
    food: { color: "#f97316", icon: "🍔", bg: "#fff7ed" },
    groceries: { color: "#10b981", icon: "🛒", bg: "#ecfdf5" },
    shopping: { color: "#ec4899", icon: "🛍️", bg: "#fdf2f8" },
    travel: { color: "#8b5cf6", icon: "✈️", bg: "#f5f3ff" },
    utilities: { color: "#06b6d4", icon: "⚡", bg: "#ecfeff" },
    transport: { color: "#6366f1", icon: "🚗", bg: "#ee2f2" }
  };

  // Compute category breakdown with percentage bars
  const categoryTotal = (categories || []).reduce((sum, c) => sum + (c.amount || 0), 0) || 1;
  const breakdownRows = (categories || []).slice(0, 5).map((cat) => {
    const key = (cat.name || "").toLowerCase().trim();
    const meta = categoryMeta[key] || { color: "#10b981", icon: "🏷️", bg: "#ecfdf5" };
    const nameFormatted = cat.name ? cat.name.charAt(0).toUpperCase() + cat.name.slice(1) : "Uncategorized";
    const amountVal = typeof cat.amount === "number" ? cat.amount : parseFloat(String(cat.amountFormatted || cat.amount || "0").replace(/[^0-9.]/g, "")) || 0;
    const percent = Math.round((amountVal / categoryTotal) * 100);
    const amountDisp = cat.amountFormatted || `${currency === "BDT" ? "৳" : currency === "USD" ? "$" : ""}${amountVal.toLocaleString("en-US")}`;

    return `
    <div style="margin-bottom: 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 4px;">
        <tr>
          <td style="vertical-align: middle;">
            <span style="display: inline-block; width: 26px; height: 26px; background-color: ${meta.bg}; border-radius: 50%; text-align: center; line-height: 26px; font-size: 13px; margin-right: 8px;">${meta.icon}</span>
            <strong style="font-size: 13px; font-weight: 700; color: #1e293b;">${nameFormatted}</strong>
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <strong style="font-size: 13px; font-weight: 800; color: #0f172a;">${amountDisp}</strong>
            <span style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-left: 4px;">${percent}%</span>
          </td>
        </tr>
      </table>
      <div style="width: 100%; height: 6px; background-color: #f1f5f9; border-radius: 99px; overflow: hidden;">
        <div style="width: ${Math.min(100, percent)}%; height: 100%; background-color: ${meta.color}; border-radius: 99px;"></div>
      </div>
    </div>
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
        body { font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased; color: #0f172a;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 20px 10px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.08); border: 1px solid #e2e8f0;">
              
              <!-- 1. HEADER: Dark Navy Banner with Dashboard Graphics -->
              <tr>
                <td style="background: #040914; padding: 28px 28px 24px 28px; position: relative;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="vertical-align: top;">
                        <!-- Logo & Brand Header -->
                        <table cellpadding="0" cellspacing="0" style="margin-bottom: 16px;">
                          <tr>
                            <td style="padding-right: 10px; vertical-align: middle;">
                              <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="34" height="34" alt="Money Copilot AI" style="display: block;">
                            </td>
                            <td style="vertical-align: middle;">
                              <h1 style="margin: 0; font-size: 18px; font-weight: 800; color: #ffffff; line-height: 1.2; letter-spacing: -0.3px;">Money Copilot AI</h1>
                              <p style="margin: 2px 0 0 0; font-size: 10px; color: #34d399; font-weight: 600; line-height: 1.2;">Know where your money goes. Control where it goes next.</p>
                            </td>
                          </tr>
                        </table>

                        <!-- Title & Month Subtitle -->
                        <h2 style="margin: 0 0 4px 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Your Monthly Money Report</h2>
                        <div style="font-size: 15px; font-weight: 800; color: #34d399; margin-bottom: 6px;">${month}</div>
                        <p style="margin: 0; font-size: 11px; color: #94a3b8;">AI analyzed your spending and found opportunities to save more.</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 2. GREETING & TOP AI INSIGHT BANNER -->
              <tr>
                <td style="padding: 24px 24px 16px 24px; background-color: #ffffff;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left Greeting -->
                      <td style="vertical-align: top; padding-right: 12px;" width="45%">
                        <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800; color: #0f172a;">Hi ${displayName}! 👋</h3>
                        <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                          Here's your AI-powered financial summary for ${month}.
                        </p>
                      </td>

                      <!-- Right Top AI Insight Box -->
                      <td width="55%" style="vertical-align: top;">
                        <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 14px; padding: 12px 14px;">
                          <table cellpadding="0" cellspacing="0" width="100%">
                            <tr>
                              <td style="vertical-align: top; width: 32px; padding-right: 10px;">
                                <div style="width: 32px; height: 32px; background-color: #10b981; border-radius: 50%; text-align: center; line-height: 32px; color: #ffffff; font-size: 14px;">✨</div>
                              </td>
                              <td style="vertical-align: top;">
                                <div style="font-size: 12px; font-weight: 800; color: #047857; margin-bottom: 2px;">⚡ AI Insight</div>
                                <div style="font-size: 11px; line-height: 1.45; color: #166534;">
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

              <!-- 3. TOP 5 METRIC CARDS ROW (Gauge + Spent + Limit + Remaining + Status) -->
              <tr>
                <td style="padding: 0 24px 20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Card 1: Budget Used Gauge -->
                      <td width="28%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 10px; text-align: center; vertical-align: middle;">
                        <div style="font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 8px;">Budget Used</div>
                        <!-- Donut Gauge Ring Mock -->
                        <div style="position: relative; width: 56px; height: 56px; margin: 0 auto 6px auto; border-radius: 50%; background: conic-gradient(#10b981 0% ${budgetUsed}%, #e2e8f0 ${budgetUsed}% 100%); display: flex; align-items: center; justify-content: center;">
                          <div style="width: 44px; height: 44px; background-color: #ffffff; border-radius: 50%; line-height: 44px; text-align: center; font-size: 13px; font-weight: 800; color: #047857; margin: 6px auto;">
                            ${budgetUsed}%
                          </div>
                        </div>
                        <div style="font-size: 11px; font-weight: 800; color: #10b981; margin-bottom: 1px;">Excellent!</div>
                        <div style="font-size: 9px; color: #94a3b8; line-height: 1.2;">You're well within your budget.</div>
                      </td>

                      <td width="2%"></td>

                      <!-- Card 2: Total Spent -->
                      <td width="17%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 8px; text-align: center; vertical-align: top;">
                        <div style="width: 28px; height: 28px; background-color: #ecfdf5; border-radius: 8px; margin: 0 auto 6px auto; text-align: center; line-height: 28px; font-size: 14px;">👛</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Total Spent</div>
                        <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 4px;">${spentFormatted}</div>
                        <div style="font-size: 8.5px; color: #10b981; font-weight: 700;">↓ 12% lower<br>than last month</div>
                      </td>

                      <td width="2%"></td>

                      <!-- Card 3: Budget Limit -->
                      <td width="17%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 8px; text-align: center; vertical-align: top;">
                        <div style="width: 28px; height: 28px; background-color: #eff6ff; border-radius: 8px; margin: 0 auto 6px auto; text-align: center; line-height: 28px; font-size: 14px;">🎯</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Budget Limit</div>
                        <div style="font-size: 14px; font-weight: 800; color: #2563eb;">${budgetFormatted}</div>
                      </td>

                      <td width="2%"></td>

                      <!-- Card 4: Remaining -->
                      <td width="17%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 8px; text-align: center; vertical-align: top;">
                        <div style="width: 28px; height: 28px; background-color: #ecfdf5; border-radius: 8px; margin: 0 auto 6px auto; text-align: center; line-height: 28px; font-size: 14px;">💵</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Remaining</div>
                        <div style="font-size: 14px; font-weight: 800; color: #10b981; margin-bottom: 4px;">${remainingFormatted}</div>
                        <div style="font-size: 8.5px; color: #10b981; font-weight: 700;">Great job!</div>
                      </td>

                      <td width="2%"></td>

                      <!-- Card 5: Status -->
                      <td width="17%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 12px 8px; text-align: center; vertical-align: top;">
                        <div style="width: 28px; height: 28px; background-color: #f5f3ff; border-radius: 8px; margin: 0 auto 6px auto; text-align: center; line-height: 28px; font-size: 14px;">📈</div>
                        <div style="font-size: 9.5px; font-weight: 700; color: #64748b; margin-bottom: 2px;">Status</div>
                        <div style="font-size: 13px; font-weight: 800; color: #059669; line-height: 1.2;">Within<br>Budget</div>
                        <div style="width: 14px; height: 14px; background-color: #10b981; border-radius: 50%; color: #ffffff; font-size: 9px; line-height: 14px; text-align: center; margin: 4px auto 0 auto;">✓</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 4. MIDDLE ROW: SPENDING BREAKDOWN & AI SAVINGS OPPORTUNITIES -->
              <tr>
                <td style="padding: 0 24px 20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left Column: Spending Breakdown -->
                      <td width="49%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                        <h4 style="margin: 0 0 14px 0; font-size: 14px; font-weight: 800; color: #0f172a;">Spending Breakdown</h4>
                        
                        ${breakdownRows || `
                          <p style="font-size: 12px; color: #94a3b8;">No spending recorded for this period.</p>
                        `}

                        <div style="margin-top: 14px; text-align: center;">
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="font-size: 11.5px; font-weight: 700; color: #10b981; text-decoration: none;">View all categories →</a>
                        </div>
                      </td>

                      <td width="2%"></td>

                      <!-- Right Column: AI thinks you can save (Piggy Bank Card) -->
                      <td width="49%" style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 16px; padding: 16px; vertical-align: top;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td style="vertical-align: top;">
                              <div style="font-size: 12px; font-weight: 800; color: #047857; margin-bottom: 2px;">💡 AI thinks you can save</div>
                              <div style="font-size: 24px; font-weight: 800; color: #047857; letter-spacing: -0.5px;">৳1,800</div>
                              <div style="font-size: 11px; color: #166534; font-weight: 600; margin-bottom: 10px;">by optimizing these areas:</div>
                            </td>
                            <td style="vertical-align: top; text-align: right;" width="40">
                              <span style="font-size: 32px; display: block;">🐷</span>
                            </td>
                          </tr>
                        </table>

                        <!-- Savings Item 1 -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td width="24" style="vertical-align: middle;">
                              <div style="width: 20px; height: 20px; background-color: #ffffff; border-radius: 50%; text-align: center; line-height: 20px; font-size: 10px;">🍔</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 6px;">
                              <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Ordering food less often</div>
                              <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳900</div>
                            </td>
                          </tr>
                        </table>

                        <!-- Savings Item 2 -->
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                          <tr>
                            <td width="24" style="vertical-align: middle;">
                              <div style="width: 20px; height: 20px; background-color: #ffffff; border-radius: 50%; text-align: center; line-height: 20px; font-size: 10px;">❤️</div>
                            </td>
                            <td style="vertical-align: middle; padding-left: 6px;">
                              <div style="font-size: 11px; font-weight: 700; color: #0f172a;">Setting a monthly health budget</div>
                              <div style="font-size: 9.5px; color: #059669; font-weight: 600;">Save up to ৳600</div>
                            </td>
                          </tr>
                        </table>

                        <!-- Savings Item 3 -->
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td width="24" style="vertical-align: middle;">
                              <div style="width: 20px; height: 20px; background-color: #ffffff; border-radius: 50%; text-align: center; line-height: 20px; font-size: 10px;">🛒</div>
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

              <!-- 5. BOTTOM ROW: SPENDING TREND & ASK AI ANYTHING -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <!-- Left Column: Spending Trend (Last 6 Months) -->
                      <td width="49%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 12px;">
                          <tr>
                            <td style="font-size: 13px; font-weight: 800; color: #0f172a;">Spending Trend <span style="font-size: 10px; color: #94a3b8; font-weight: 500;">(Last 6 Months)</span></td>
                            <td style="text-align: right;"><span style="font-size: 11px; color: #10b981;">↗</span></td>
                          </tr>
                        </table>

                        <!-- CSS/SVG Sparkline Graphic -->
                        <svg width="100%" height="70" viewBox="0 0 200 70" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M10 50 L46 42 L82 28 L118 48 L154 38 L190 32 L190 70 L10 70 Z" fill="url(#trendGrad)" opacity="0.4"/>
                          <path d="M10 50 L46 42 L82 28 L118 48 L154 38 L190 32" stroke="#10b981" stroke-width="2.5" stroke-linecap="round"/>
                          <circle cx="10" cy="50" r="3" fill="#10b981"/>
                          <circle cx="46" cy="42" r="3" fill="#10b981"/>
                          <circle cx="82" cy="28" r="3" fill="#10b981"/>
                          <circle cx="118" cy="48" r="3" fill="#10b981"/>
                          <circle cx="154" cy="38" r="3" fill="#10b981"/>
                          <circle cx="190" cy="32" r="4.5" fill="#10b981" stroke="#ffffff" stroke-width="1.5"/>
                          <defs>
                            <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="70" gradientUnits="userSpaceOnUse">
                              <stop stop-color="#10b981"/>
                              <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
                            </linearGradient>
                          </defs>
                        </svg>
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 4px; font-size: 9.5px; color: #64748b; text-align: center;">
                          <tr>
                            <td width="16%">Mar</td>
                            <td width="16%">Apr</td>
                            <td width="16%">May</td>
                            <td width="16%">Jun</td>
                            <td width="16%">Jul</td>
                            <td width="20%" style="font-weight: 800; color: #10b981;">Aug</td>
                          </tr>
                        </table>
                      </td>

                      <td width="2%"></td>

                      <!-- Right Column: Ask AI Anything -->
                      <td width="49%" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 16px; vertical-align: top;">
                        <h4 style="margin: 0 0 2px 0; font-size: 13px; font-weight: 800; color: #0f172a;">Ask AI Anything</h4>
                        <p style="margin: 0 0 10px 0; font-size: 10.5px; color: #94a3b8;">Get instant answers about your money.</p>

                        <!-- Prompt 1 -->
                        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 7px 10px; margin-bottom: 6px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-size: 11px; color: #334155; font-weight: 600;">💬 Where did my money go?</td>
                              <td style="text-align: right; font-size: 11px; color: #94a3b8;">›</td>
                            </tr>
                          </table>
                        </div>

                        <!-- Prompt 2 -->
                        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; padding: 7px 10px; margin-bottom: 6px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-size: 11px; color: #334155; font-weight: 600;">🏦 How can I save more?</td>
                              <td style="text-align: right; font-size: 11px; color: #94a3b8;">›</td>
                            </tr>
                          </table>
                        </div>

                        <!-- Prompt 3 -->
                        <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 10px; margin-bottom: 0; padding: 7px 10px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="font-size: 11px; color: #334155; font-weight: 600;">📊 What should my budget be next month?</td>
                              <td style="text-align: right; font-size: 11px; color: #94a3b8;">›</td>
                            </tr>
                          </table>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- 6. BOTTOM BANNER CTA (Dark Green Gradient + Phone & Button) -->
              <tr>
                <td style="padding: 0 24px 24px 24px;">
                  <div style="background: linear-gradient(135deg, #051829 0%, #0d3832 50%, #059669 100%); border-radius: 18px; padding: 20px 24px; color: #ffffff;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <!-- Left Content -->
                        <td style="vertical-align: middle;">
                          <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 800; color: #ffffff; letter-spacing: -0.3px;">Take control of your finances today!</h3>
                          <p style="margin: 0 0 14px 0; font-size: 11.5px; color: #cbd5e1; line-height: 1.4;">Open Money Copilot AI and make smarter decisions with AI.</p>
                          
                          <!-- CTA Button -->
                          <a href="https://expense-chat-ai-sandy.vercel.app/dashboard" style="display: inline-block; padding: 10px 22px; background: #10b981; color: #ffffff; text-decoration: none; font-weight: 800; font-size: 13px; border-radius: 99px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">Open Money Copilot AI →</a>
                          
                          <div style="margin-top: 10px; font-size: 10px; color: #94a3b8;">
                            Works with <span style="color: #34d399; font-weight: 700;">🤖 ChatGPT</span> &nbsp; <span style="color: #34d399; font-weight: 700;">✳️ Claude</span>
                          </div>
                        </td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- 7. FOOTER SECTION -->
              <tr>
                <td style="padding: 16px 24px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td width="45%" style="vertical-align: middle;">
                        <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">🔒 Private &amp; Secure</div>
                        <div style="font-size: 9.5px; color: #64748b;">Your financial data is encrypted and only visible to you.</div>
                      </td>
                      <td width="25%" style="vertical-align: middle; text-align: center;">
                        <img src="https://expense-chat-ai-sandy.vercel.app/assets/logo/money-copilot-app-logo.png" width="22" height="22" alt="" style="display: inline-block; vertical-align: middle; margin-right: 4px;">
                        <span style="font-size: 10.5px; font-weight: 800; color: #0f172a;">Money Copilot AI</span>
                      </td>
                      <td width="30%" style="vertical-align: middle; text-align: right; font-size: 9.5px; color: #94a3b8;">
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
