import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { coffeeOrders, users, drivers, hubs } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

const COFFEE_MENU = [
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

const SIZE_MULTIPLIERS: Record<string, number> = {
  small: 0.8,
  medium: 1.0,
  large: 1.3,
};

router.get("/api/coffee/menu", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const categories: Record<string, typeof COFFEE_MENU> = {};
    for (const item of COFFEE_MENU) {
      if (!categories[item.category]) categories[item.category] = [];
      categories[item.category].push(item);
    }

    res.json({ menu: COFFEE_MENU, categories, sizes: ["small", "medium", "large"] });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load menu" });
  }
});

router.post("/api/coffee/orders", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const {
      orderType, coffeeName, coffeeSize, quantity,
      specialInstructions, giftMessage,
      recipientPhone, recipientName,
      hubId, deliveryLat, deliveryLng, deliveryAddress,
      paymentMethod,
    } = req.body;

    if (!coffeeName || !orderType) {
      return res.status(400).json({ error: "Coffee name and order type are required" });
    }

    const menuItem = COFFEE_MENU.find(m => m.id === coffeeName || m.name === coffeeName);
    if (!menuItem) {
      return res.status(400).json({ error: "Invalid coffee selection" });
    }

    const size = coffeeSize || "medium";
    const qty = Math.max(1, Math.min(quantity || 1, 10));
    const sizeMultiplier = SIZE_MULTIPLIERS[size] || 1.0;
    const itemPrice = Math.round(menuItem.basePrice * sizeMultiplier * 100) / 100;
    const deliveryFee = orderType === "buy" ? 0 : 5;
    const totalAmount = Math.round((itemPrice * qty + deliveryFee) * 100) / 100;

    let hubData = null;
    if (hubId) {
      const hubResults = await db.select().from(hubs).where(eq(hubs.id, hubId));
      hubData = hubResults[0] || null;
    }

    const [order] = await db.insert(coffeeOrders).values({
      ordererId: session.userId,
      orderType,
      coffeeName: menuItem.name,
      coffeeSize: size,
      quantity: qty,
      specialInstructions: specialInstructions || null,
      giftMessage: orderType === "gift" ? (giftMessage || null) : null,
      recipientPhone: orderType === "gift" ? (recipientPhone || null) : null,
      recipientName: orderType === "gift" ? (recipientName || null) : null,
      hubId: hubId || null,
      pickupLat: hubData ? hubData.lat : null,
      pickupLng: hubData ? hubData.lng : null,
      pickupAddress: hubData ? hubData.address : null,
      deliveryLat: deliveryLat || null,
      deliveryLng: deliveryLng || null,
      deliveryAddress: deliveryAddress || null,
      itemPrice: itemPrice.toString(),
      deliveryFee: deliveryFee.toString(),
      totalAmount: totalAmount.toString(),
      paymentMethod: paymentMethod || "card",
      estimatedDeliveryMinutes: 15,
      status: "pending",
    }).returning();

    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create coffee order" });
  }
});

router.get("/api/coffee/orders", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const userOrders = await db.select().from(coffeeOrders)
      .where(eq(coffeeOrders.ordererId, session.userId))
      .orderBy(desc(coffeeOrders.createdAt));

    res.json({ orders: userOrders });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch orders" });
  }
});

router.get("/api/coffee/orders/:orderId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [order] = await db.select().from(coffeeOrders)
      .where(eq(coffeeOrders.id, req.params.orderId));

    if (!order) return res.status(404).json({ error: "Order not found" });

    if (order.ordererId !== session.userId && order.driverId !== session.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    res.json({ order });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch order" });
  }
});

router.patch("/api/coffee/orders/:orderId/cancel", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [order] = await db.select().from(coffeeOrders)
      .where(eq(coffeeOrders.id, req.params.orderId));

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.ordererId !== session.userId) return res.status(403).json({ error: "Forbidden" });

    const cancellable = ["pending", "accepted"];
    if (!cancellable.includes(order.status)) {
      return res.status(400).json({ error: "Order cannot be cancelled at this stage" });
    }

    const [updated] = await db.update(coffeeOrders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: req.body.reason || "Cancelled by customer",
        updatedAt: new Date(),
      })
      .where(eq(coffeeOrders.id, req.params.orderId))
      .returning();

    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to cancel order" });
  }
});

router.get("/api/coffee/driver/orders", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const driverRecords = await db.select().from(drivers).where(eq(drivers.userId, session.userId));
    if (driverRecords.length === 0) return res.status(403).json({ error: "Not a driver" });

    const driver = driverRecords[0];
    const status = req.query.status as string;

    let query;
    if (status === "available") {
      query = db.select().from(coffeeOrders)
        .where(eq(coffeeOrders.status, "pending"))
        .orderBy(desc(coffeeOrders.createdAt));
    } else {
      query = db.select().from(coffeeOrders)
        .where(eq(coffeeOrders.driverId, driver.id))
        .orderBy(desc(coffeeOrders.createdAt));
    }

    const orders = await query;
    res.json({ orders });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch driver orders" });
  }
});

router.patch("/api/coffee/driver/orders/:orderId/accept", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const driverRecords = await db.select().from(drivers).where(eq(drivers.userId, session.userId));
    if (driverRecords.length === 0) return res.status(403).json({ error: "Not a driver" });

    const driver = driverRecords[0];

    const [order] = await db.select().from(coffeeOrders)
      .where(eq(coffeeOrders.id, req.params.orderId));

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.status !== "pending") return res.status(400).json({ error: "Order already taken" });

    const [updated] = await db.update(coffeeOrders)
      .set({
        driverId: driver.id,
        status: "accepted",
        updatedAt: new Date(),
      })
      .where(eq(coffeeOrders.id, req.params.orderId))
      .returning();

    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to accept order" });
  }
});

router.patch("/api/coffee/driver/orders/:orderId/status", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const driverRecords = await db.select().from(drivers).where(eq(drivers.userId, session.userId));
    if (driverRecords.length === 0) return res.status(403).json({ error: "Not a driver" });

    const driver = driverRecords[0];
    const { status } = req.body;

    const validTransitions: Record<string, string[]> = {
      accepted: ["preparing", "cancelled"],
      preparing: ["ready"],
      ready: ["picked_up"],
      picked_up: ["delivering"],
      delivering: ["delivered"],
    };

    const [order] = await db.select().from(coffeeOrders)
      .where(and(eq(coffeeOrders.id, req.params.orderId), eq(coffeeOrders.driverId, driver.id)));

    if (!order) return res.status(404).json({ error: "Order not found" });

    const allowed = validTransitions[order.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({ error: `Cannot transition from ${order.status} to ${status}` });
    }

    const updates: any = { status, updatedAt: new Date() };
    if (status === "delivered") updates.completedAt = new Date();
    if (status === "cancelled") {
      updates.cancelledAt = new Date();
      updates.cancelReason = req.body.reason || "Cancelled by driver";
    }

    const [updated] = await db.update(coffeeOrders)
      .set(updates)
      .where(eq(coffeeOrders.id, req.params.orderId))
      .returning();

    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update order status" });
  }
});

export const coffeeRouter = router;
