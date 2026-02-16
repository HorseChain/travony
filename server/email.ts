import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

interface QueuedEmail {
  id: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
  createdAt: Date;
}

const emailQueue: QueuedEmail[] = [];
let isProcessingQueue = false;

async function processEmailQueue(): Promise<void> {
  if (isProcessingQueue || emailQueue.length === 0) return;
  isProcessingQueue = true;
  
  while (emailQueue.length > 0) {
    const email = emailQueue[0];
    try {
      await transporter.sendMail({
        from: `"Travony" <${process.env.SMTP_USER || 'noreply@travony.app'}>`,
        to: email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      emailQueue.shift();
      console.log(`Email sent: ${email.subject} -> ${email.to}`);
    } catch (error: any) {
      email.attempts++;
      email.lastError = error.message;
      if (email.attempts >= email.maxAttempts) {
        emailQueue.shift();
        console.error(`Email permanently failed after ${email.maxAttempts} attempts: ${email.subject} -> ${email.to}: ${error.message}`);
      } else {
        const delay = Math.min(1000 * Math.pow(2, email.attempts), 30000);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  isProcessingQueue = false;
}

function queueEmail(to: string, subject: string, html: string, text: string, maxAttempts: number = 3): string {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
  emailQueue.push({ id, to, subject, html, text, attempts: 0, maxAttempts, createdAt: new Date() });
  processEmailQueue().catch(console.error);
  return id;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

interface RideReceiptData {
  customerName: string;
  customerEmail: string;
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: string;
  duration: string;
  fare: string;
  platformFee: string;
  driverEarnings: string;
  blockchainHash: string;
  blockchainTxHash?: string;
  completedAt: string;
  driverName?: string;
  vehicleInfo?: string;
}

export async function sendRideReceiptEmail(data: RideReceiptData): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("Email not configured - skipping receipt email");
    return false;
  }

  const polygonScanUrl = data.blockchainTxHash
    ? `https://amoy.polygonscan.com/tx/${data.blockchainTxHash}`
    : `https://amoy.polygonscan.com/address/0xA8C20314004FEA3bE339f73cE4E192eCAaA062Ec`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travony Ride Receipt</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #00B14F; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Travony</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your Ride Receipt</p>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px;">
          Hi ${data.customerName},
        </p>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
          Thank you for riding with Travony! Here are the details of your completed trip.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 12px; height: 12px; background-color: #00B14F; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></span>
                    <span style="color: #666; font-size: 12px;">PICKUP</span>
                    <p style="margin: 4px 0 0 24px; color: #333; font-size: 14px;">${data.pickupAddress}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <span style="display: inline-block; width: 12px; height: 12px; background-color: #E53935; border-radius: 50%; margin-right: 12px; vertical-align: middle;"></span>
                    <span style="color: #666; font-size: 12px;">DROP-OFF</span>
                    <p style="margin: 4px 0 0 24px; color: #333; font-size: 14px;">${data.dropoffAddress}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Distance</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.distance} km</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Duration</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.duration} min</span>
            </td>
          </tr>
          ${data.driverName ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Driver</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.driverName}</span>
            </td>
          </tr>
          ` : ""}
          ${data.vehicleInfo ? `
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Vehicle</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">${data.vehicleInfo}</span>
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding: 16px 0;">
              <span style="color: #333; font-size: 18px; font-weight: 700;">Total</span>
              <span style="float: right; color: #00B14F; font-size: 24px; font-weight: 700;">AED ${data.fare}</span>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #8247E5 0%, #6B3CC9 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 16px; color: #ffffff; font-size: 16px; font-weight: 600;">
                Blockchain Verified
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px;">Network</span>
                    <span style="float: right; color: #ffffff; font-size: 13px;">Polygon Amoy</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px;">Platform Fee (10%)</span>
                    <span style="float: right; color: #ffffff; font-size: 13px;">AED ${data.platformFee}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: rgba(255,255,255,0.8); font-size: 12px;">Driver Earnings (90%)</span>
                    <span style="float: right; color: #ffffff; font-size: 13px;">AED ${data.driverEarnings}</span>
                  </td>
                </tr>
              </table>
              <p style="margin: 16px 0 0; padding: 12px; background: rgba(255,255,255,0.1); border-radius: 8px;">
                <span style="color: rgba(255,255,255,0.7); font-size: 11px; display: block; margin-bottom: 4px;">Ride Hash</span>
                <span style="color: #ffffff; font-size: 11px; font-family: monospace; word-break: break-all;">${data.blockchainHash}</span>
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 16px;">
                <tr>
                  <td align="center">
                    <a href="${polygonScanUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #8247E5; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                      Verify on PolygonScan
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
          Ride ID: ${data.rideId}<br>
          Completed: ${new Date(data.completedAt).toLocaleString()}
        </p>
      </td>
    </tr>
    
    <tr>
      <td style="background-color: #f5f5f5; padding: 24px; text-align: center;">
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">
          Questions about your ride? Contact us at support@travony.app
        </p>
        <p style="margin: 0; color: #999; font-size: 11px;">
          Travony - Transparent P2P Rides
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"Travony" <${process.env.SMTP_USER}>`,
      to: data.customerEmail,
      subject: `Your Travony Ride Receipt - AED ${data.fare}`,
      html: htmlContent,
    });
    console.log(`Ride receipt email sent to ${data.customerEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send ride receipt email:", error);
    return false;
  }
}

interface DriverEarningsEmailData {
  driverName: string;
  driverEmail: string;
  rideId: string;
  pickupAddress: string;
  dropoffAddress: string;
  totalFare: string;
  platformFee: string;
  earnings: string;
  blockchainHash: string;
  blockchainTxHash?: string;
  completedAt: string;
}

export async function sendDriverEarningsEmail(data: DriverEarningsEmailData): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("Email not configured - skipping driver earnings email");
    return false;
  }

  const polygonScanUrl = data.blockchainTxHash
    ? `https://amoy.polygonscan.com/tx/${data.blockchainTxHash}`
    : `https://amoy.polygonscan.com/address/0xA8C20314004FEA3bE339f73cE4E192eCAaA062Ec`;

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Travony Earnings Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #00B14F; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Travony</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Route Completed - Yield Summary</p>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px;">
          Great job, ${data.driverName}!
        </p>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
          You've completed a ride. Here's your earnings breakdown - verified on blockchain.
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #E8F5E9; border-radius: 12px; padding: 20px; margin-bottom: 24px; text-align: center;">
          <tr>
            <td>
              <p style="margin: 0 0 8px; color: #666; font-size: 14px;">Your Earnings (90%)</p>
              <p style="margin: 0; color: #00B14F; font-size: 36px; font-weight: 700;">AED ${data.earnings}</p>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 12px; color: #333; font-size: 14px; font-weight: 600;">Trip Details</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #666; font-size: 13px;">From</span>
                    <p style="margin: 2px 0 0; color: #333; font-size: 13px;">${data.pickupAddress}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 6px 0;">
                    <span style="color: #666; font-size: 13px;">To</span>
                    <p style="margin: 2px 0 0; color: #333; font-size: 13px;">${data.dropoffAddress}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Total Fare</span>
              <span style="float: right; color: #333; font-size: 14px; font-weight: 500;">AED ${data.totalFare}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
              <span style="color: #666; font-size: 14px;">Platform Fee (10%)</span>
              <span style="float: right; color: #E53935; font-size: 14px; font-weight: 500;">- AED ${data.platformFee}</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 0;">
              <span style="color: #333; font-size: 16px; font-weight: 600;">Your Earnings</span>
              <span style="float: right; color: #00B14F; font-size: 18px; font-weight: 700;">AED ${data.earnings}</span>
            </td>
          </tr>
        </table>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #8247E5 0%, #6B3CC9 100%); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <tr>
            <td>
              <p style="margin: 0 0 12px; color: #ffffff; font-size: 14px; font-weight: 600;">
                Blockchain Verified Earnings
              </p>
              <p style="margin: 0 0 12px; color: rgba(255,255,255,0.8); font-size: 12px;">
                Your earnings are permanently recorded on Polygon blockchain for transparency.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 12px;">
                <tr>
                  <td align="center">
                    <a href="${polygonScanUrl}" style="display: inline-block; padding: 12px 24px; background-color: #ffffff; color: #8247E5; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                      View on PolygonScan
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <p style="margin: 0; color: #999; font-size: 12px; text-align: center;">
          Ride ID: ${data.rideId}<br>
          Completed: ${new Date(data.completedAt).toLocaleString()}
        </p>
      </td>
    </tr>
    
    <tr>
      <td style="background-color: #f5f5f5; padding: 24px; text-align: center;">
        <p style="margin: 0; color: #999; font-size: 11px;">
          Travony - 90% to Drivers, Always
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"Travony" <${process.env.SMTP_USER}>`,
      to: data.driverEmail,
      subject: `Route Completed - Yield: AED ${data.earnings}`,
      html: htmlContent,
    });
    console.log(`Driver earnings email sent to ${data.driverEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send driver earnings email:", error);
    return false;
  }
}

interface WeeklyFeedbackData {
  driverName: string;
  driverEmail: string;
  weekStartDate: string;
  weekEndDate: string;
  totalRides: number;
  totalEarnings: string;
  averageRating: number;
  previousAverageRating?: number;
  ratings: { count: number; stars: number }[];
  recentComments: { comment: string; rating: number; date: string }[];
  topStrengths: string[];
  improvementAreas: string[];
}

export async function sendWeeklyFeedbackEmail(data: WeeklyFeedbackData): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.log("Email not configured - skipping weekly feedback email");
    return false;
  }

  const ratingChange = data.previousAverageRating 
    ? data.averageRating - data.previousAverageRating 
    : 0;
  const ratingChangeText = ratingChange > 0 
    ? `<span style="color: #00B14F;">+${ratingChange.toFixed(2)}</span>` 
    : ratingChange < 0 
      ? `<span style="color: #E53935;">${ratingChange.toFixed(2)}</span>` 
      : "";

  const ratingBarsHtml = [5, 4, 3, 2, 1].map(stars => {
    const ratingData = data.ratings.find(r => r.stars === stars) || { count: 0, stars };
    const percentage = data.totalRides > 0 ? (ratingData.count / data.totalRides) * 100 : 0;
    return `
      <tr>
        <td style="padding: 4px 0; width: 50px;">
          <span style="color: #FFB800; font-size: 14px;">${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</span>
        </td>
        <td style="padding: 4px 8px;">
          <div style="background-color: #E8E8E8; border-radius: 4px; height: 8px; width: 100%;">
            <div style="background-color: #00B14F; border-radius: 4px; height: 8px; width: ${percentage}%;"></div>
          </div>
        </td>
        <td style="padding: 4px 0; width: 40px; text-align: right; color: #666; font-size: 12px;">${ratingData.count}</td>
      </tr>
    `;
  }).join("");

  const commentsHtml = data.recentComments.length > 0 
    ? data.recentComments.slice(0, 5).map(c => `
      <div style="background-color: #f9f9f9; border-radius: 8px; padding: 12px; margin-bottom: 8px;">
        <div style="color: #FFB800; font-size: 12px; margin-bottom: 4px;">${'★'.repeat(c.rating)}${'☆'.repeat(5-c.rating)}</div>
        <p style="margin: 0; color: #333; font-size: 14px;">"${c.comment}"</p>
        <p style="margin: 4px 0 0; color: #999; font-size: 11px;">${c.date}</p>
      </div>
    `).join("")
    : `<p style="color: #999; font-style: italic;">No comments this week</p>`;

  const strengthsHtml = data.topStrengths.length > 0
    ? data.topStrengths.map(s => `
      <div style="display: inline-block; background-color: #E8F5E9; color: #00B14F; padding: 6px 12px; border-radius: 16px; margin: 4px; font-size: 13px;">
        ✓ ${s}
      </div>
    `).join("")
    : "";

  const improvementsHtml = data.improvementAreas.length > 0
    ? `<div style="background-color: #FFF3E0; border-radius: 8px; padding: 12px; margin-top: 16px;">
        <p style="margin: 0 0 8px; color: #E65100; font-size: 14px; font-weight: 600;">Areas to Improve</p>
        ${data.improvementAreas.map(i => `<p style="margin: 4px 0; color: #E65100; font-size: 13px;">• ${i}</p>`).join("")}
      </div>`
    : "";

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Weekly Performance Summary</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
    <tr>
      <td style="background-color: #00B14F; padding: 24px; text-align: center;">
        <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">Travony</h1>
        <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Weekly Performance Summary</p>
      </td>
    </tr>
    
    <tr>
      <td style="padding: 32px 24px;">
        <p style="margin: 0 0 24px; color: #333; font-size: 16px;">
          Hi ${data.driverName},
        </p>
        <p style="margin: 0 0 24px; color: #666; font-size: 14px;">
          Here's your performance summary for ${data.weekStartDate} - ${data.weekEndDate}
        </p>
        
        <!-- Stats Grid -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
          <tr>
            <td width="50%" style="padding: 8px;">
              <div style="background-color: #E8F5E9; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px; color: #666; font-size: 12px;">Total Rides</p>
                <p style="margin: 0; color: #00B14F; font-size: 28px; font-weight: 700;">${data.totalRides}</p>
              </div>
            </td>
            <td width="50%" style="padding: 8px;">
              <div style="background-color: #E3F2FD; border-radius: 12px; padding: 16px; text-align: center;">
                <p style="margin: 0 0 4px; color: #666; font-size: 12px;">Total Earnings</p>
                <p style="margin: 0; color: #1976D2; font-size: 28px; font-weight: 700;">AED ${data.totalEarnings}</p>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Rating Section -->
        <div style="background-color: #f9f9f9; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <p style="margin: 0 0 8px; color: #666; font-size: 14px;">Your Average Rating</p>
            <p style="margin: 0; font-size: 48px; font-weight: 700;">
              <span style="color: #FFB800;">★</span>
              <span style="color: #333;">${data.averageRating.toFixed(2)}</span>
              ${ratingChangeText ? `<span style="font-size: 16px; margin-left: 8px;">(${ratingChangeText} vs last week)</span>` : ""}
            </p>
          </div>
          
          <table width="100%" cellpadding="0" cellspacing="0">
            ${ratingBarsHtml}
          </table>
        </div>
        
        ${strengthsHtml ? `
        <!-- Strengths -->
        <div style="margin-bottom: 24px;">
          <p style="margin: 0 0 12px; color: #333; font-size: 16px; font-weight: 600;">What Passengers Love About You</p>
          ${strengthsHtml}
        </div>
        ` : ""}
        
        ${improvementsHtml}
        
        <!-- Recent Comments -->
        <div style="margin-top: 24px;">
          <p style="margin: 0 0 12px; color: #333; font-size: 16px; font-weight: 600;">Recent Passenger Comments</p>
          ${commentsHtml}
        </div>
        
        <!-- Tips -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px; margin-top: 24px;">
          <p style="margin: 0 0 12px; color: #ffffff; font-size: 16px; font-weight: 600;">Tips for Next Week</p>
          <ul style="margin: 0; padding-left: 20px; color: rgba(255,255,255,0.9); font-size: 14px;">
            <li style="margin-bottom: 8px;">Keep up the great work with timely pickups</li>
            <li style="margin-bottom: 8px;">A clean car = happy passengers = better tips</li>
            <li>Use "Going Home" mode to earn extra on your commute</li>
          </ul>
        </div>
      </td>
    </tr>
    
    <tr>
      <td style="background-color: #f5f5f5; padding: 24px; text-align: center;">
        <p style="margin: 0 0 8px; color: #666; font-size: 12px;">
          Keep driving, keep earning!
        </p>
        <p style="margin: 0; color: #999; font-size: 11px;">
          Travony - 90% to Drivers, Always
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  try {
    await transporter.sendMail({
      from: `"Travony" <${process.env.SMTP_USER}>`,
      to: data.driverEmail,
      subject: `Your Weekly Performance: ★${data.averageRating.toFixed(1)} Rating, ${data.totalRides} Rides`,
      html: htmlContent,
    });
    console.log(`Weekly feedback email sent to ${data.driverEmail}`);
    return true;
  } catch (error) {
    console.error("Failed to send weekly feedback email:", error);
    return false;
  }
}

export async function sendDriverOnboardingEmail(data: {
  driverName: string;
  driverEmail: string;
  cityName: string;
  vehicleType: string;
}): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;
  
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:#00B14F;padding:24px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;">Travony</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Welcome to the Network</p>
</td></tr>
<tr><td style="padding:32px 24px;">
<p style="margin:0 0 24px;color:#333;font-size:18px;font-weight:600;">Congratulations, ${data.driverName}!</p>
<p style="margin:0 0 16px;color:#666;font-size:14px;">Your vehicle has been verified and you're now part of the Travony Mobility Network in <strong>${data.cityName}</strong>.</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F5E9;border-radius:12px;padding:20px;margin:24px 0;">
<tr><td style="text-align:center;">
<p style="margin:0 0 8px;color:#666;font-size:12px;">YOUR VEHICLE ASSET</p>
<p style="margin:0;color:#00B14F;font-size:24px;font-weight:700;">${data.vehicleType}</p>
<p style="margin:8px 0 0;color:#666;font-size:13px;">Ready for network activation</p>
</td></tr></table>
<p style="margin:0 0 16px;color:#333;font-size:14px;font-weight:600;">What's Next:</p>
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="padding:8px 0;color:#666;font-size:14px;">1. Open the T Driver app</td></tr>
<tr><td style="padding:8px 0;color:#666;font-size:14px;">2. Activate your vehicle to join the network</td></tr>
<tr><td style="padding:8px 0;color:#666;font-size:14px;">3. Start earning yield from your first route</td></tr>
</table>
<p style="margin:24px 0 0;color:#999;font-size:12px;">90% of every fare goes directly to you. Always.</p>
</td></tr>
<tr><td style="background:#f5f5f5;padding:24px;text-align:center;">
<p style="margin:0;color:#999;font-size:11px;">Travony Mobility Network - Movement has value.</p>
</td></tr></table></body></html>`;

  const text = htmlToPlainText(html);
  queueEmail(data.driverEmail, `Welcome to Travony, ${data.driverName}!`, html, text);
  return true;
}

export async function sendAccountVerificationEmail(data: {
  userName: string;
  userEmail: string;
  verificationCode: string;
}): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:#00B14F;padding:24px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;">Travony</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Account Verification</p>
</td></tr>
<tr><td style="padding:32px 24px;">
<p style="margin:0 0 24px;color:#333;font-size:16px;">Hi ${data.userName},</p>
<p style="margin:0 0 24px;color:#666;font-size:14px;">Use the code below to verify your Travony account:</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f0f0;border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
<tr><td>
<p style="margin:0;color:#333;font-size:36px;font-weight:700;letter-spacing:8px;">${data.verificationCode}</p>
</td></tr></table>
<p style="margin:0 0 8px;color:#666;font-size:13px;">This code expires in 10 minutes.</p>
<p style="margin:0;color:#999;font-size:12px;">If you didn't request this, please ignore this email.</p>
</td></tr>
<tr><td style="background:#f5f5f5;padding:24px;text-align:center;">
<p style="margin:0;color:#999;font-size:11px;">Travony Mobility Network</p>
</td></tr></table></body></html>`;

  const text = htmlToPlainText(html);
  queueEmail(data.userEmail, `Travony Verification Code: ${data.verificationCode}`, html, text);
  return true;
}

export async function sendWeeklyYieldSummary(data: {
  driverName: string;
  driverEmail: string;
  weekLabel: string;
  totalYield: string;
  totalRoutes: number;
  avgYieldPerRoute: string;
  topDay: string;
  topDayYield: string;
  networkRank?: number;
  currency: string;
}): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return false;

  const rankHtml = data.networkRank ? `<p style="margin:16px 0 0;color:#666;font-size:13px;">Network Rank: <strong>#${data.networkRank}</strong> in your city</p>` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="background:#00B14F;padding:24px;text-align:center;">
<h1 style="margin:0;color:#fff;font-size:28px;">Travony</h1>
<p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">Weekly Yield Report - ${data.weekLabel}</p>
</td></tr>
<tr><td style="padding:32px 24px;">
<p style="margin:0 0 24px;color:#333;font-size:16px;">Hi ${data.driverName},</p>
<table width="100%" cellpadding="0" cellspacing="0" style="background:#E8F5E9;border-radius:12px;padding:20px;margin:0 0 24px;text-align:center;">
<tr><td>
<p style="margin:0 0 4px;color:#666;font-size:12px;">TOTAL WEEKLY YIELD</p>
<p style="margin:0;color:#00B14F;font-size:36px;font-weight:700;">${data.currency} ${data.totalYield}</p>
${rankHtml}
</td></tr></table>
<table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
<tr>
<td width="33%" style="padding:8px;"><div style="background:#f9f9f9;border-radius:8px;padding:12px;text-align:center;">
<p style="margin:0 0 4px;color:#666;font-size:11px;">Routes</p>
<p style="margin:0;color:#333;font-size:20px;font-weight:700;">${data.totalRoutes}</p>
</div></td>
<td width="33%" style="padding:8px;"><div style="background:#f9f9f9;border-radius:8px;padding:12px;text-align:center;">
<p style="margin:0 0 4px;color:#666;font-size:11px;">Avg/Route</p>
<p style="margin:0;color:#333;font-size:20px;font-weight:700;">${data.currency} ${data.avgYieldPerRoute}</p>
</div></td>
<td width="33%" style="padding:8px;"><div style="background:#f9f9f9;border-radius:8px;padding:12px;text-align:center;">
<p style="margin:0 0 4px;color:#666;font-size:11px;">Best Day</p>
<p style="margin:0;color:#333;font-size:14px;font-weight:700;">${data.topDay}</p>
<p style="margin:2px 0 0;color:#00B14F;font-size:12px;">${data.currency} ${data.topDayYield}</p>
</div></td>
</tr></table>
<p style="margin:0;color:#999;font-size:12px;text-align:center;">Keep activating your vehicle to maximize weekly yield.</p>
</td></tr>
<tr><td style="background:#f5f5f5;padding:24px;text-align:center;">
<p style="margin:0;color:#999;font-size:11px;">Travony - 90% to Vehicle Owners, Always</p>
</td></tr></table></body></html>`;

  const text = htmlToPlainText(html);
  queueEmail(data.driverEmail, `Weekly Yield: ${data.currency} ${data.totalYield} from ${data.totalRoutes} routes`, html, text);
  return true;
}

export function getEmailQueueStatus() {
  return {
    queueLength: emailQueue.length,
    isProcessing: isProcessingQueue,
    pending: emailQueue.map(e => ({ id: e.id, to: e.to, subject: e.subject, attempts: e.attempts, createdAt: e.createdAt })),
  };
}
