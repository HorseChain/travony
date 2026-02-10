import { v4 as uuidv4 } from "uuid";

const NOWPAYMENTS_API_URL = "https://api.nowpayments.io/v1";

interface NowPaymentsInvoice {
  id: string;
  token_id: string;
  invoice_url: string;
  order_id: string;
  order_description: string;
  price_amount: number;
  price_currency: string;
  pay_currency: string | null;
  created_at: string;
  updated_at: string;
  is_fixed_rate: boolean;
  is_fee_paid_by_user: boolean;
}

interface CreateInvoiceParams {
  price: number;
  currency: string;
  orderId: string;
  description?: string;
  callbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
}

interface NowPaymentsPaymentStatus {
  payment_id: number;
  invoice_id: number;
  payment_status: string;
  pay_address: string;
  price_amount: number;
  price_currency: string;
  pay_amount: number;
  pay_currency: string;
  order_id: string;
  order_description: string;
  purchase_id: string;
  outcome_amount: number;
  outcome_currency: string;
  created_at: string;
  updated_at: string;
}

export class NowPaymentsService {
  private apiKey: string | null;
  private isConfiguredFlag: boolean;

  constructor() {
    this.apiKey = process.env.NOWPAYMENTS_API_KEY || null;
    this.isConfiguredFlag = !!this.apiKey;

    if (!this.isConfiguredFlag) {
      console.log("NOWPayments: Not configured. Set NOWPAYMENTS_API_KEY for USDT payments.");
    } else {
      console.log("NOWPayments: Configured and ready for crypto payments");
    }
  }

  isAvailable(): boolean {
    return this.isConfiguredFlag;
  }

  async createInvoice(params: CreateInvoiceParams): Promise<NowPaymentsInvoice | null> {
    if (!this.isConfiguredFlag) {
      console.log("NOWPayments: Creating simulated invoice (not configured)");
      return this.createSimulatedInvoice(params);
    }

    try {
      const response = await fetch(`${NOWPAYMENTS_API_URL}/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey!,
        },
        body: JSON.stringify({
          price_amount: params.price,
          price_currency: params.currency.toLowerCase(),
          order_id: params.orderId,
          order_description: params.description || "Travony Payment",
          ipn_callback_url: params.callbackUrl,
          success_url: params.successUrl,
          cancel_url: params.cancelUrl,
          is_fixed_rate: true,
          is_fee_paid_by_user: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("NOWPayments invoice creation failed:", error);
        return null;
      }

      const data = await response.json();
      return data as NowPaymentsInvoice;
    } catch (error: any) {
      console.error("NOWPayments API error:", error.message);
      return null;
    }
  }

  async getPaymentStatus(paymentId: string): Promise<NowPaymentsPaymentStatus | null> {
    if (!this.isConfiguredFlag) {
      return null;
    }

    try {
      const response = await fetch(`${NOWPAYMENTS_API_URL}/payment/${paymentId}`, {
        method: "GET",
        headers: {
          "x-api-key": this.apiKey!,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("NOWPayments get payment failed:", error);
        return null;
      }

      const data = await response.json();
      return data as NowPaymentsPaymentStatus;
    } catch (error: any) {
      console.error("NOWPayments API error:", error.message);
      return null;
    }
  }

  async getMinimumPaymentAmount(currency: string = "usdttrc20"): Promise<number> {
    try {
      const response = await fetch(
        `${NOWPAYMENTS_API_URL}/min-amount?currency_from=${currency}`,
        {
          headers: { "x-api-key": this.apiKey! },
        }
      );
      if (response.ok) {
        const data = await response.json();
        return data.min_amount || 1;
      }
    } catch (error: any) {
      console.error("NOWPayments min amount error:", error.message);
    }
    return 1;
  }

  verifyIpnSignature(payload: any, receivedSignature: string): boolean {
    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      return true;
    }
    try {
      const crypto = require("crypto");
      const sortedPayload = Object.keys(payload)
        .sort()
        .reduce((result: any, key: string) => {
          result[key] = payload[key];
          return result;
        }, {});
      const hmac = crypto
        .createHmac("sha512", process.env.NOWPAYMENTS_IPN_SECRET)
        .update(JSON.stringify(sortedPayload))
        .digest("hex");
      return hmac === receivedSignature;
    } catch (error) {
      console.error("NOWPayments IPN signature verification error:", error);
      return false;
    }
  }

  private simulatedInvoices: Map<string, NowPaymentsInvoice> = new Map();

  private createSimulatedInvoice(params: CreateInvoiceParams): NowPaymentsInvoice {
    const invoiceId = `sim_${uuidv4().substring(0, 8)}`;
    const invoice: NowPaymentsInvoice = {
      id: invoiceId,
      token_id: `tok_${uuidv4().substring(0, 8)}`,
      invoice_url: `https://nowpayments.io/payment/?iid=${invoiceId}`,
      order_id: params.orderId,
      order_description: params.description || "Travony Payment",
      price_amount: params.price,
      price_currency: params.currency.toLowerCase(),
      pay_currency: "usdttrc20",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_fixed_rate: true,
      is_fee_paid_by_user: false,
    };

    this.simulatedInvoices.set(invoiceId, invoice);
    return invoice;
  }

  simulatePaymentComplete(invoiceId: string): boolean {
    const invoice = this.simulatedInvoices.get(invoiceId);
    if (invoice) {
      return true;
    }
    return false;
  }
}

export const nowPaymentsService = new NowPaymentsService();
