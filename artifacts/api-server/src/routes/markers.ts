import { Router, type IRouter } from "express";
import { db, markersTable, insertMarkerSchema } from "@workspace/db";
import { eq, count, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/markers/stats", async (req, res) => {
  try {
    const rows = await db
      .select({ category: markersTable.category, count: count() })
      .from(markersTable)
      .groupBy(markersTable.category);

    const total = rows.reduce((sum, r) => sum + Number(r.count), 0);
    const wineries = rows.find((r) => r.category === "winery")?.count ?? 0;
    const restaurants = rows.find((r) => r.category === "restaurant")?.count ?? 0;
    const farmstands = rows.find((r) => r.category === "farmstand")?.count ?? 0;
    const artisans = rows.find((r) => r.category === "artisan")?.count ?? 0;

    res.json({ total, wineries: Number(wineries), restaurants: Number(restaurants), farmstands: Number(farmstands), artisans: Number(artisans) });
  } catch (err) {
    req.log.error({ err }, "Failed to get marker stats");
    res.status(500).json({ error: "Failed to get stats" });
  }
});

router.get("/markers", async (req, res) => {
  try {
    const markers = await db.select().from(markersTable).orderBy(markersTable.createdAt);
    res.json(markers.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to get markers");
    res.status(500).json({ error: "Failed to get markers" });
  }
});

router.post("/markers", async (req, res) => {
  try {
    const input = insertMarkerSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ error: "Invalid input", details: input.error.issues });
      return;
    }
    const [marker] = await db.insert(markersTable).values(input.data).returning();
    res.status(201).json({ ...marker, createdAt: marker.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create marker");
    res.status(500).json({ error: "Failed to create marker" });
  }
});

router.get("/markers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [marker] = await db.select().from(markersTable).where(eq(markersTable.id, id));
    if (!marker) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...marker, createdAt: marker.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to get marker");
    res.status(500).json({ error: "Failed to get marker" });
  }
});

router.put("/markers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const partial = insertMarkerSchema.partial().safeParse(req.body);
    if (!partial.success) {
      res.status(400).json({ error: "Invalid input", details: partial.error.issues });
      return;
    }
    const [marker] = await db
      .update(markersTable)
      .set(partial.data)
      .where(eq(markersTable.id, id))
      .returning();
    if (!marker) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...marker, createdAt: marker.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to update marker");
    res.status(500).json({ error: "Failed to update marker" });
  }
});

router.delete("/markers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }
    const [deleted] = await db
      .delete(markersTable)
      .where(eq(markersTable.id, id))
      .returning();
    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete marker");
    res.status(500).json({ error: "Failed to delete marker" });
  }
});

export default router;
