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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMarkerSchema = createInsertSchema(markersTable).omit({ id: true, createdAt: true });
export type InsertMarker = z.infer<typeof insertMarkerSchema>;
export type Marker = typeof markersTable.$inferSelect;
