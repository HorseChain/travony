import { v4 as uuidv4 } from "uuid";

const BITPAY_API_URL = process.env.BITPAY_ENV === "production" 
  ? "https://bitpay.com" 
  : "https://test.bitpay.com";

interface BitPayInvoice {
  id: string;
  url: string;
  status: string;
  price: number;
  currency: string;
  orderId: string;
  expirationTime: number;
  currentTime: number;
  paymentTotals?: Record<string, number>;
  paymentSubtotals?: Record<string, number>;
  exchangeRates?: Record<string, Record<string, number>>;
}

interface CreateInvoiceParams {
  price: number;
  currency: string;
  orderId: string;
  notificationURL?: string;
  redirectURL?: string;
  buyer?: {
    email?: string;
    name?: string;
  };
  itemDesc?: string;
}

interface BitPayPayout {
  id: string;
  status: string;
  amount: number;
  currency: string;
  ledgerCurrency: string;
  recipientAddress: string;
  txHash?: string;
  dateCreated: number;
  dateCompleted?: number;
}

interface CreatePayoutParams {
  amount: number;
  currency: string;
  ledgerCurrency: string;
  recipientAddress: string;
  reference: string;
  notificationURL?: string;
}

export class BitPayService {
  private apiToken: string | null;
  private isConfigured: boolean;

  constructor() {
    this.apiToken = process.env.BITPAY_API_TOKEN || null;
    this.isConfigured = !!this.apiToken;
    
    if (!this.isConfigured) {
      console.log("BitPay: Not configured. Set BITPAY_API_TOKEN for USDT payments.");
    } else {
      console.log(`BitPay: Configured for ${process.env.BITPAY_ENV === "production" ? "production" : "test"} environment`);
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }

  async createInvoice(params: CreateInvoiceParams): Promise<BitPayInvoice | null> {
    if (!this.isConfigured) {
      console.log("BitPay: Creating simulated invoice (not configured)");
      return this.createSimulatedInvoice(params);
    }

    try {
      const response = await fetch(`${BITPAY_API_URL}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Accept-Version": "2.0.0",
          "Authorization": `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          price: params.price,
          currency: params.currency,
          orderId: params.orderId,
          notificationURL: params.notificationURL,
          redirectURL: params.redirectURL,
          buyer: params.buyer,
          itemDesc: params.itemDesc || "Travony Ride Payment",
          acceptanceWindow: 1200000,
          transactionSpeed: "medium",
          fullNotifications: true,
          extendedNotifications: true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("BitPay invoice creation failed:", error);
        return null;
      }

      const data = await response.json();
      return data.data as BitPayInvoice;
    } catch (error: any) {
      console.error("BitPay API error:", error.message);
      return null;
    }
  }

  async getInvoice(invoiceId: string): Promise<BitPayInvoice | null> {
    if (!this.isConfigured) {
      return this.getSimulatedInvoice(invoiceId);
    }

    try {
      const response = await fetch(`${BITPAY_API_URL}/invoices/${invoiceId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Accept-Version": "2.0.0",
          "Authorization": `Bearer ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("BitPay get invoice failed:", error);
        return null;
      }

      const data = await response.json();
      return data.data as BitPayInvoice;
    } catch (error: any) {
      console.error("BitPay API error:", error.message);
      return null;
    }
  }

  verifyWebhookPayload(payload: any): boolean {
    return true;
  }

  private simulatedInvoices: Map<string, BitPayInvoice> = new Map();

  private createSimulatedInvoice(params: CreateInvoiceParams): BitPayInvoice {
    const invoiceId = `sim_${uuidv4().substring(0, 8)}`;
    const invoice: BitPayInvoice = {
      id: invoiceId,
      url: `https://test.bitpay.com/invoice?id=${invoiceId}`,
      status: "new",
      price: params.price,
      currency: params.currency,
      orderId: params.orderId,
      expirationTime: Date.now() + 1200000,
      currentTime: Date.now(),
    };
    
    this.simulatedInvoices.set(invoiceId, invoice);
    return invoice;
  }

  private getSimulatedInvoice(invoiceId: string): BitPayInvoice | null {
    return this.simulatedInvoices.get(invoiceId) || null;
  }

  simulatePaymentComplete(invoiceId: string): boolean {
    const invoice = this.simulatedInvoices.get(invoiceId);
    if (invoice) {
      invoice.status = "complete";
      this.simulatedInvoices.set(invoiceId, invoice);
      return true;
    }
    return false;
  }

  private simulatedPayouts: Map<string, BitPayPayout> = new Map();

  async createPayout(params: CreatePayoutParams): Promise<BitPayPayout | null> {
    if (!this.isConfigured) {
      console.log("BitPay: Creating simulated payout (not configured)");
      return this.createSimulatedPayout(params);
    }

    try {
      const response = await fetch(`${BITPAY_API_URL}/payouts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Accept-Version": "2.0.0",
          "Authorization": `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          amount: params.amount,
          currency: params.currency,
          ledgerCurrency: params.ledgerCurrency,
          recipientAddress: params.recipientAddress,
          reference: params.reference,
          notificationURL: params.notificationURL,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("BitPay payout creation failed:", error);
        return null;
      }

      const data = await response.json();
      return data.data as BitPayPayout;
    } catch (error: any) {
      console.error("BitPay payout API error:", error.message);
      return null;
    }
  }

  async getPayout(payoutId: string): Promise<BitPayPayout | null> {
    if (!this.isConfigured) {
      return this.simulatedPayouts.get(payoutId) || null;
    }

    try {
      const response = await fetch(`${BITPAY_API_URL}/payouts/${payoutId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Accept-Version": "2.0.0",
          "Authorization": `Bearer ${this.apiToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("BitPay get payout failed:", error);
        return null;
      }

      const data = await response.json();
      return data.data as BitPayPayout;
    } catch (error: any) {
      console.error("BitPay payout API error:", error.message);
      return null;
    }
  }

  private createSimulatedPayout(params: CreatePayoutParams): BitPayPayout {
    const payoutId = `payout_sim_${uuidv4().substring(0, 8)}`;
    const payout: BitPayPayout = {
      id: payoutId,
      status: "pending",
      amount: params.amount,
      currency: params.currency,
      ledgerCurrency: params.ledgerCurrency,
      recipientAddress: params.recipientAddress,
      dateCreated: Date.now(),
    };
    
    this.simulatedPayouts.set(payoutId, payout);
    return payout;
  }

  simulatePayoutComplete(payoutId: string): boolean {
    const payout = this.simulatedPayouts.get(payoutId);
    if (payout) {
      payout.status = "complete";
      payout.txHash = `0x${uuidv4().replace(/-/g, "")}`;
      payout.dateCompleted = Date.now();
      this.simulatedPayouts.set(payoutId, payout);
      return true;
    }
    return false;
  }
}

export const bitpayService = new BitPayService();
