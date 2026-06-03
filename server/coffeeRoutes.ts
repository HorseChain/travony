import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { coffeeOrders, users, drivers, hubs } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  COFFEE_MENU,
  createCoffeeOrder,
  CoffeeValidationError,
} from "./coffeeService";

const router = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// Push a coffee order status change to the orderer's Telegram chat, if they
// ordered through the bot. Best-effort and lazily imported to avoid a static
// import cycle with the Telegram bot module.
function pushCoffeeUpdate(orderId: string): void {
  import("./telegramRiderBot")
    .then((m) => m.notifyCoffeeOrderUpdate(orderId))
    .catch((error) => console.error("[Coffee] telegram notify error:", error));
}

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

    const order = await createCoffeeOrder({
      ordererId: session.userId,
      orderType,
      coffeeName,
      coffeeSize,
      quantity,
      specialInstructions,
      giftMessage,
      recipientPhone,
      recipientName,
      hubId,
      deliveryLat,
      deliveryLng,
      deliveryAddress,
      paymentMethod,
    });

    res.json({ order });
  } catch (error: any) {
    if (error instanceof CoffeeValidationError) {
      return res.status(400).json({ error: error.message });
    }
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

    let isAssignedDriver = false;
    if (order.driverId) {
      const driver = await storage.getDriverByUserId(session.userId);
      isAssignedDriver = Boolean(driver && driver.id === order.driverId);
    }
    if (order.ordererId !== session.userId && !isAssignedDriver) {
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

    pushCoffeeUpdate(updated.id);
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

    pushCoffeeUpdate(updated.id);
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

    pushCoffeeUpdate(updated.id);
    res.json({ order: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update order status" });
  }
});

export const coffeeRouter = router;
