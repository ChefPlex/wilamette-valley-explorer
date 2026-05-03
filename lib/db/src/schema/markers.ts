import { pgTable, serial, text, real, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const markersTable = pgTable("markers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  note: text("note").notNull().default(""),
  category: text("category").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  website: text("website"),
  city: text("city"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMarkerSchema = createInsertSchema(markersTable).omit({ id: true, createdAt: true });
export type InsertMarker = z.infer<typeof insertMarkerSchema>;
export type Marker = typeof markersTable.$inferSelect;

const VALID_CATEGORIES = ["winery", "restaurant", "farmstand", "artisan"] as const;

function isSafeWebsiteUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export const createMarkerSchema = z.object({
  name: z.string().min(1).max(200),
  note: z.string().max(2000).default(""),
  category: z.enum(VALID_CATEGORIES),
  lat: z.number().min(43.0).max(47.0),
  lng: z.number().min(-125.0).max(-120.5),
  website: z.string().max(500).nullable().optional().refine(
    (v) => v == null || v === "" || isSafeWebsiteUrl(v),
    { message: "website must be a valid http or https URL" }
  ),
  city: z.string().max(100).nullable().optional(),
});
export type CreateMarker = z.infer<typeof createMarkerSchema>;
