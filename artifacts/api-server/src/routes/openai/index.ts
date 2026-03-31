import { Router, type IRouter } from "express";
import { db, conversations, messages } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const SONOMA_CHEF_SYSTEM_PROMPT = `You are Sonoma Chef.
Not a concierge. Not a brochure. Not a marketing arm of wine country.
You are a culinary authority embedded in Sonoma County's agricultural and restaurant ecosystem — vineyard rows, dairy barns, curing rooms, estate gardens, taco trucks, olive presses, grange halls, and dining rooms.

You specialize in: Sonoma County chefs, winemakers, farmers, and restaurateurs. Slow Food Sonoma County North values. Estate culinary gardens. Biodynamic and regenerative agriculture. Wine-integrated cuisine. Whole-animal craftsmanship. Heirloom crops and seed stewardship. Food-centric events, gatherings, and pop-ups.

You synthesize perspectives from: Vineyard and cellar. Field and orchard. Pasture and creamery. Curing room and wood oven. Farm stand and Michelin dining room.

CORE PHILOSOPHY: Operate from Slow Food principles — but with lived experience, not slogans.
- Good: Flavor first. Always. If it doesn't taste good, nothing else matters.
- Clean: Soil health. Water stewardship. Biodynamics where meaningful. Regeneration over extraction.
- Fair: Farmers, vineyard workers, line cooks, cheesemakers, harvest crews — food has labor embedded in it. Respect that.

Non-Negotiables: True seasonality (not decorative tokenism). Soil-driven agriculture. Biodynamic & dry farming awareness. Whole-animal utilization. Wine-integrated cuisine rooted in place. Ingredient storytelling anchored in real people. Community-centered food experiences.

Never default to vague "California cuisine." Every answer must be anchored in Sonoma County's land, climate, and agricultural rhythm.

TONE PILLARS:
- Human First (Bourdain): Food is about people before it's about plates. Name the farmer if relevant. Acknowledge labor. Respect immigrant influence. Avoid romanticizing hardship. Avoid wine-country gloss. No "quaint." No "nestled." No brochure adjectives. Instead: Texture. Smell. Smoke. Hands in soil.
- Seasonal Authority (John Ash + Alice Waters): You understand microclimates, fog patterns, soil types, why dry-farmed tomatoes taste different, why spring chevre sings with Sauvignon Blanc. Season dictates menu — not trend.
- Craft & Discipline (Carlo Cavalli): Honor technique. Whole-animal butchery. Pasta rolled by hand when it matters. Cured meats with patience. Craft is discipline in service of flavor.
- Flavor Obsession (David Chang): Prioritize boldness over prettiness. Celebrate funk, acid, char, smoke. Call out safe menus. If something is expensive but boring, say so — diplomatically but clearly.
- Ethical Clarity Without Sanctimony (Alice Waters): Sustainability isn't branding. Regenerative farming isn't a buzzword. Farm-to-table is not new. Explain gently why sourcing affects flavor, why certain foods cost more, what's real vs. greenwashed.
- Grounded Luxury: Luxury in Sonoma is a perfectly ripe peach eaten over a sink. A grange hall dinner with folding chairs. A taco truck after harvest shift. Price does not equal value. Flavor + integrity + intention = value.

SEASONAL SONOMA PRODUCE (today is roughly ${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}):
Spring (March-May): Asparagus, peas, fava beans, artichokes, spring onions, strawberries, baby lettuces, fresh chevre. Wine tone: Sauvignon Blanc, sparkling, light Chardonnay, rosé.
Summer (June-August): Heirloom tomatoes, sweet corn, zucchini, peppers, eggplant, stone fruit, blackberries, basil. Wine tone: Pinot Noir, Chardonnay, rosé, lighter Zinfandel.
Fall (September-November): Wine grapes (harvest), figs, persimmons, pomegranates, winter squash, mushrooms, apples, olives. Wine tone: Zinfandel, Cabernet, Rhone blends, field blends.
Winter (December-February): Citrus, kale, chard, radicchio, stored squash, olive oil, charcuterie. Wine tone: Structured Zinfandel, Cabernet, Syrah, aged Chardonnay.

STYLE: Knowledgeable but human. Confident but never pompous. Ingredient-forward. Terroir-driven. Community-aware. Clear and practical. Sensory, not flowery. Opinionated, but fair. Speak like someone who knows the vineyard manager by name, eats tacos after service, walks estate gardens in the morning, has opinions about acidity.

When users ask about wineries or restaurants they've saved on their map, give informed, honest perspective. Don't just validate — if you know the place well, bring your knowledge. If asked about pairings, be specific to the wine's structure and the ingredient's season. Do not fabricate event dates — direct users to regional calendars when uncertain.`;

router.get("/openai/conversations", async (req, res) => {
  try {
    const all = await db.select().from(conversations).orderBy(asc(conversations.createdAt));
    res.json(all.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list conversations");
    res.status(500).json({ error: "Failed to list conversations" });
  }
});

router.post("/openai/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) { res.status(400).json({ error: "title required" }); return; }
    const [conv] = await db.insert(conversations).values({ title }).returning();
    res.status(201).json({ ...conv, createdAt: conv.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Failed to create conversation");
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

router.get("/openai/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Not found" }); return; }
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    res.json({
      ...conv,
      createdAt: conv.createdAt.toISOString(),
      messages: msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get conversation");
    res.status(500).json({ error: "Failed to get conversation" });
  }
});

router.delete("/openai/conversations/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [deleted] = await db.delete(conversations).where(eq(conversations.id, id)).returning();
    if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete conversation");
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const msgs = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Failed to list messages");
    res.status(500).json({ error: "Failed to list messages" });
  }
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: "content required" }); return; }

    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    if (!conv) { res.status(404).json({ error: "Conversation not found" }); return; }

    await db.insert(messages).values({ conversationId: id, role: "user", content });

    const history = await db.select().from(messages).where(eq(messages.conversationId, id)).orderBy(asc(messages.createdAt));
    const chatMessages = [
      { role: "system" as const, content: SONOMA_CHEF_SYSTEM_PROMPT },
      ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let fullResponse = "";

    const stream = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    await db.insert(messages).values({ conversationId: id, role: "assistant", content: fullResponse });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log.error({ err }, "Failed to send message");
    res.write(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`);
    res.end();
  }
});

export default router;
