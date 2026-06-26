import { storage } from "./storage";
import { getRegionByCode } from "./regionService";
import { v4 as uuidv4 } from "uuid";
import { sendPreformattedEmail } from "./email";

// Escape user-controlled text before interpolating into invoice HTML emails.
function escapeHtml(value?: string | null): string {
  if (!value) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Phone/Telegram signups get synthetic, non-deliverable addresses; never email those.
function isSendableEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  if (lower.endsWith("@telegram.travony")) return false;
  if (lower.endsWith("@travony.local")) return false;
  if (lower.endsWith(".local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface InvoiceData {
  rideId: string;
  invoiceType: "customer" | "driver";
  recipientId: string;
  subtotal: number;
  platformFee?: number;
  totalAmount: number;
  currency: string;
  paymentMethod: "card" | "cash" | "wallet" | "usdt";
  blockchainHash?: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: number;
  duration: number;
  rideCompletedAt: Date;
}

function generateInvoiceNumber(type: "customer" | "driver"): string {
  const prefix = type === "customer" ? "INV" : "DRV";
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().substring(0, 4).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export async function createRideInvoices(rideId: string): Promise<{ customerInvoice: any; driverInvoice: any } | null> {
  const ride = await storage.getRide(rideId);
  if (!ride || ride.status !== "completed") {
    console.log("Invoice creation failed: Ride not found or not completed");
    return null;
  }

  const totalFare = parseFloat(ride.actualFare || ride.estimatedFare || "0");
  // Region-aware split so budget markets (e.g. BD = 5%) show the real cut. Prefer
  // the fee already persisted on the ride; fall back to the region's fee percent.
  const region = await getRegionByCode((ride as any).regionCode || "AE").catch(() => null);
  const feePercent = region ? region.platformFeePercent : 10;
  const persistedFee = parseFloat(ride.platformFee || "0");
  const platformFee = persistedFee > 0 ? persistedFee : totalFare * (feePercent / 100);
  const driverEarnings = parseFloat(ride.driverEarnings || "0") > 0
    ? parseFloat(ride.driverEarnings || "0")
    : totalFare - platformFee;
  // USDT settlement keeps its symbol; otherwise use the ride's local currency.
  const currency = ride.paymentMethod === "usdt" ? "USDT" : ((ride as any).currency || "AED");

  const customerInvoiceData: InvoiceData = {
    rideId,
    invoiceType: "customer",
    recipientId: ride.customerId,
    subtotal: totalFare,
    platformFee: undefined,
    totalAmount: totalFare,
    currency: currency,
    paymentMethod: ride.paymentMethod as any,
    blockchainHash: ride.blockchainHash || undefined,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
    distance: parseFloat(ride.distance || "0"),
    duration: ride.duration || 0,
    rideCompletedAt: ride.completedAt || new Date(),
  };

  const driverInvoiceData: InvoiceData = {
    rideId,
    invoiceType: "driver",
    recipientId: ride.driverId || "",
    subtotal: totalFare,
    platformFee: platformFee,
    totalAmount: driverEarnings,
    currency: currency,
    paymentMethod: ride.paymentMethod as any,
    blockchainHash: ride.blockchainHash || undefined,
    pickupAddress: ride.pickupAddress,
    dropoffAddress: ride.dropoffAddress,
    distance: parseFloat(ride.distance || "0"),
    duration: ride.duration || 0,
    rideCompletedAt: ride.completedAt || new Date(),
  };

  const customerInvoice = await storage.createRideInvoice({
    rideId,
    invoiceType: "customer",
    recipientId: customerInvoiceData.recipientId,
    invoiceNumber: generateInvoiceNumber("customer"),
    subtotal: customerInvoiceData.subtotal.toFixed(2),
    platformFee: null,
    totalAmount: customerInvoiceData.totalAmount.toFixed(2),
    currency: customerInvoiceData.currency as any,
    paymentMethod: customerInvoiceData.paymentMethod,
    blockchainHash: customerInvoiceData.blockchainHash,
    pickupAddress: customerInvoiceData.pickupAddress,
    dropoffAddress: customerInvoiceData.dropoffAddress,
    distance: customerInvoiceData.distance.toFixed(2),
    duration: customerInvoiceData.duration,
    rideCompletedAt: customerInvoiceData.rideCompletedAt,
  });

  let driverInvoice = null;
  if (ride.driverId) {
    driverInvoice = await storage.createRideInvoice({
      rideId,
      invoiceType: "driver",
      recipientId: driverInvoiceData.recipientId,
      invoiceNumber: generateInvoiceNumber("driver"),
      subtotal: driverInvoiceData.subtotal.toFixed(2),
      platformFee: (driverInvoiceData.platformFee || 0).toFixed(2),
      totalAmount: driverInvoiceData.totalAmount.toFixed(2),
      currency: driverInvoiceData.currency as any,
      paymentMethod: driverInvoiceData.paymentMethod,
      blockchainHash: driverInvoiceData.blockchainHash,
      pickupAddress: driverInvoiceData.pickupAddress,
      dropoffAddress: driverInvoiceData.dropoffAddress,
      distance: driverInvoiceData.distance.toFixed(2),
      duration: driverInvoiceData.duration,
      rideCompletedAt: driverInvoiceData.rideCompletedAt,
    });
  }

  return { customerInvoice, driverInvoice };
}

export function formatInvoiceHtml(invoice: any, recipientName: string, recipientEmail: string): string {
  const currencySymbol = (invoice.currency || "AED") + " ";
  // Derive the real platform-fee percent from the persisted amounts so budget
  // markets (e.g. BD = 5%) never show a misleading "10%".
  const sub = parseFloat(invoice.subtotal || "0");
  const fee = parseFloat(invoice.platformFee || "0");
  const feePctLabel = sub > 0 ? Math.round((fee / sub) * 100) : 10;
  const date = new Date(invoice.rideCompletedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Travony Invoice - ${invoice.invoiceNumber}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }
    .invoice { max-width: 600px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; border-bottom: 2px solid #00B14F; padding-bottom: 20px; }
    .logo { font-size: 28px; font-weight: bold; color: #00B14F; }
    .invoice-number { text-align: right; color: #666; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 12px; text-transform: uppercase; color: #999; margin-bottom: 8px; }
    .trip-info { background: #f9f9f9; padding: 20px; border-radius: 8px; }
    .location { display: flex; margin-bottom: 15px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; margin-right: 15px; margin-top: 4px; }
    .dot.pickup { background: #00B14F; }
    .dot.dropoff { background: #E53935; }
    .amount-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .amount-row.total { border-bottom: none; font-weight: bold; font-size: 18px; color: #00B14F; }
    .blockchain { background: #E8F5E9; padding: 15px; border-radius: 8px; margin-top: 20px; }
    .blockchain-title { font-size: 12px; color: #2E7D32; margin-bottom: 5px; }
    .blockchain-hash { font-family: monospace; font-size: 11px; word-break: break-all; color: #1B5E20; }
    .footer { text-align: center; margin-top: 40px; color: #999; font-size: 12px; }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="header">
      <div class="logo">Travony</div>
      <div class="invoice-number">
        <div style="font-weight: bold">${invoice.invoiceNumber}</div>
        <div>${date}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">${invoice.invoiceType === "customer" ? "Billed To" : "Earnings Statement For"}</div>
      <div style="font-weight: bold">${escapeHtml(recipientName)}</div>
      <div style="color: #666">${escapeHtml(recipientEmail)}</div>
    </div>

    <div class="section">
      <div class="section-title">Trip Details</div>
      <div class="trip-info">
        <div class="location">
          <div class="dot pickup"></div>
          <div>${escapeHtml(invoice.pickupAddress)}</div>
        </div>
        <div class="location" style="margin-bottom: 0">
          <div class="dot dropoff"></div>
          <div>${escapeHtml(invoice.dropoffAddress)}</div>
        </div>
        <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd; display: flex; justify-content: space-between; color: #666; font-size: 14px;">
          <span>${parseFloat(invoice.distance).toFixed(1)} km</span>
          <span>${invoice.duration} min</span>
          <span>Paid via ${escapeHtml(String(invoice.paymentMethod || "cash")).toUpperCase()}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Payment Summary</div>
      ${invoice.invoiceType === "driver" ? `
        <div class="amount-row">
          <span>Ride Fare</span>
          <span>${currencySymbol}${parseFloat(invoice.subtotal).toFixed(2)}</span>
        </div>
        <div class="amount-row">
          <span>Platform Fee (${feePctLabel}%)</span>
          <span>-${currencySymbol}${parseFloat(invoice.platformFee).toFixed(2)}</span>
        </div>
        <div class="amount-row total">
          <span>Your Earnings</span>
          <span>${currencySymbol}${parseFloat(invoice.totalAmount).toFixed(2)}</span>
        </div>
      ` : `
        <div class="amount-row total">
          <span>Total Paid</span>
          <span>${currencySymbol}${parseFloat(invoice.totalAmount).toFixed(2)}</span>
        </div>
      `}
    </div>

    ${invoice.blockchainHash ? `
      <div class="blockchain">
        <div class="blockchain-title">Verified on Polygon Blockchain</div>
        <div class="blockchain-hash">${escapeHtml(invoice.blockchainHash)}</div>
        <a href="https://amoy.polygonscan.com/tx/${encodeURIComponent(invoice.blockchainHash)}" style="color: #2E7D32; font-size: 12px;">View on Explorer</a>
      </div>
    ` : ""}

    <div class="footer">
      <p>Thank you for choosing Travony</p>
      <p>For support, contact support@travony.app</p>
    </div>
  </div>
</body>
</html>
  `;
}

// Fire-and-forget: email the customer invoice to the rider and the driver invoice
// (earnings statement) to the driver after invoices are created on completion.
// Skips synthetic placeholder addresses; sends through the Gmail-primary queue.
export async function sendRideInvoiceEmails(rideId: string): Promise<void> {
  try {
    const invoices = await storage.getRideInvoicesByRide(rideId);
    if (!invoices || invoices.length === 0) return;
    const ride = await storage.getRide(rideId);
    if (!ride) return;

    for (const invoice of invoices) {
      try {
        if (invoice.invoiceType === "customer") {
          const rider = await storage.getUser(ride.customerId);
          if (rider && isSendableEmail(rider.email)) {
            const html = formatInvoiceHtml(invoice, rider.name || "there", rider.email!);
            sendPreformattedEmail(rider.email!, `Your Travony invoice ${invoice.invoiceNumber}`, html);
          }
        } else if (invoice.invoiceType === "driver" && ride.driverId) {
          const driver = await storage.getDriver(ride.driverId);
          const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
          if (driverUser && isSendableEmail(driverUser.email)) {
            const html = formatInvoiceHtml(invoice, driverUser.name || "Driver", driverUser.email!);
            sendPreformattedEmail(driverUser.email!, `Your Travony earnings statement ${invoice.invoiceNumber}`, html);
          }
        }
      } catch (perInvoiceErr) {
        console.error(`[InvoiceService] failed to email invoice ${invoice.invoiceNumber}:`, perInvoiceErr);
      }
    }
  } catch (error) {
    console.error("[InvoiceService] sendRideInvoiceEmails error:", error);
  }
}
