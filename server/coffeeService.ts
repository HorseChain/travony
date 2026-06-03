import { db } from "./db";
import { coffeeOrders, hubs } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface CoffeeMenuItem {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  currency: string;
  description: string;
}

export const COFFEE_MENU: CoffeeMenuItem[] = [
  { id: "karak_tea", name: "Karak Tea", category: "tea", basePrice: 5, currency: "AED", description: "Traditional spiced milk tea" },
  { id: "arabic_coffee", name: "Arabic Coffee", category: "coffee", basePrice: 8, currency: "AED", description: "Traditional gahwa with cardamom" },
  { id: "cappuccino", name: "Cappuccino", category: "coffee", basePrice: 15, currency: "AED", description: "Espresso with steamed milk foam" },
  { id: "latte", name: "Latte", category: "coffee", basePrice: 16, currency: "AED", description: "Espresso with steamed milk" },
  { id: "espresso", name: "Espresso", category: "coffee", basePrice: 12, currency: "AED", description: "Rich single shot espresso" },
  { id: "americano", name: "Americano", category: "coffee", basePrice: 13, currency: "AED", description: "Espresso with hot water" },
  { id: "mocha", name: "Mocha", category: "coffee", basePrice: 18, currency: "AED", description: "Espresso with chocolate and steamed milk" },
  { id: "iced_latte", name: "Iced Latte", category: "iced", basePrice: 18, currency: "AED", description: "Chilled espresso with cold milk" },
  { id: "iced_americano", name: "Iced Americano", category: "iced", basePrice: 15, currency: "AED", description: "Chilled espresso with cold water" },
  { id: "matcha_latte", name: "Matcha Latte", category: "specialty", basePrice: 20, currency: "AED", description: "Japanese matcha with steamed milk" },
  { id: "turkish_coffee", name: "Turkish Coffee", category: "coffee", basePrice: 10, currency: "AED", description: "Fine ground coffee, strong and bold" },
  { id: "hot_chocolate", name: "Hot Chocolate", category: "other", basePrice: 16, currency: "AED", description: "Rich Belgian chocolate drink" },
];

export const SIZE_MULTIPLIERS: Record<string, number> = {
  small: 0.8,
  medium: 1.0,
  large: 1.3,
};

export const DELIVERY_FEE = 5;

export function getMenuItem(idOrName: string): CoffeeMenuItem | undefined {
  return COFFEE_MENU.find((m) => m.id === idOrName || m.name === idOrName);
}

export interface CoffeePricing {
  itemPrice: number;
  deliveryFee: number;
  totalAmount: number;
}

/**
 * Price a coffee order the same way the app does: base price scaled by size
 * multiplier, times quantity, plus a flat delivery fee for everything except
 * pickup ("buy") orders.
 */
export function priceCoffee(
  item: CoffeeMenuItem,
  size: string,
  quantity: number,
  orderType: string,
): CoffeePricing {
  const sizeMultiplier = SIZE_MULTIPLIERS[size] || 1.0;
  const qty = Math.max(1, Math.min(quantity || 1, 10));
  const itemPrice = Math.round(item.basePrice * sizeMultiplier * 100) / 100;
  const deliveryFee = orderType === "buy" ? 0 : DELIVERY_FEE;
  const totalAmount = Math.round((itemPrice * qty + deliveryFee) * 100) / 100;
  return { itemPrice, deliveryFee, totalAmount };
}

export class CoffeeValidationError extends Error {
  code = "INVALID";
  constructor(message: string) {
    super(message);
    this.name = "CoffeeValidationError";
  }
}

export interface CreateCoffeeOrderInput {
  ordererId: string;
  orderType: "order" | "buy" | "gift";
  coffeeName: string; // id or display name
  coffeeSize?: string;
  quantity?: number;
  specialInstructions?: string;
  giftMessage?: string;
  recipientPhone?: string;
  recipientName?: string;
  hubId?: string;
  deliveryLat?: number | string;
  deliveryLng?: number | string;
  deliveryAddress?: string;
  paymentMethod?: string;
}

/**
 * Create a coffee order. Shared by the REST route and the Telegram bot so the
 * pricing, hub pickup resolution, and persisted shape stay identical.
 */
export async function createCoffeeOrder(input: CreateCoffeeOrderInput) {
  if (!input.coffeeName || !input.orderType) {
    throw new CoffeeValidationError("Coffee name and order type are required");
  }

  const menuItem = getMenuItem(input.coffeeName);
  if (!menuItem) {
    throw new CoffeeValidationError("Invalid coffee selection");
  }

  // Mode-specific required fields, so we fail deterministically (400) rather
  // than persisting an incomplete order or hitting a DB error later.
  if (input.orderType === "order") {
    if (input.deliveryLat == null || input.deliveryLng == null) {
      throw new CoffeeValidationError("Delivery location is required for delivery orders");
    }
  } else if (input.orderType === "buy") {
    if (!input.hubId) {
      throw new CoffeeValidationError("A pickup hub is required for pickup orders");
    }
  } else if (input.orderType === "gift") {
    if (!input.recipientName || !input.recipientPhone) {
      throw new CoffeeValidationError("Recipient name and phone are required for gift orders");
    }
  }

  const size = input.coffeeSize || "medium";
  const qty = Math.max(1, Math.min(input.quantity || 1, 10));
  const { itemPrice, deliveryFee, totalAmount } = priceCoffee(menuItem, size, qty, input.orderType);

  let hubData = null;
  if (input.hubId) {
    const hubResults = await db.select().from(hubs).where(eq(hubs.id, input.hubId));
    hubData = hubResults[0] || null;
  }

  const [order] = await db
    .insert(coffeeOrders)
    .values({
      ordererId: input.ordererId,
      orderType: input.orderType,
      coffeeName: menuItem.name,
      coffeeSize: size,
      quantity: qty,
      specialInstructions: input.specialInstructions || null,
      giftMessage: input.orderType === "gift" ? input.giftMessage || null : null,
      recipientPhone: input.orderType === "gift" ? input.recipientPhone || null : null,
      recipientName: input.orderType === "gift" ? input.recipientName || null : null,
      hubId: input.hubId || null,
      pickupLat: hubData ? hubData.lat : null,
      pickupLng: hubData ? hubData.lng : null,
      pickupAddress: hubData ? hubData.address : null,
      deliveryLat: input.deliveryLat != null ? input.deliveryLat.toString() : null,
      deliveryLng: input.deliveryLng != null ? input.deliveryLng.toString() : null,
      deliveryAddress: input.deliveryAddress || null,
      itemPrice: itemPrice.toString(),
      deliveryFee: deliveryFee.toString(),
      totalAmount: totalAmount.toString(),
      paymentMethod: input.paymentMethod || "card",
      estimatedDeliveryMinutes: 15,
      status: "pending",
    } as any)
    .returning();

  return order;
}
