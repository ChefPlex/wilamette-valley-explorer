import { db, markersTable } from "@workspace/db";
import { count, eq, inArray, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

// Entries removed from the curated list — deleted from DB on every boot
const REMOVED_FROM_SEED: string[] = [];

const SEED_DATA = [
  // ── WINERIES: DUNDEE HILLS ────────────────────────────────────────────────
  // Jory volcanic soil, the historic heart of Oregon Pinot Noir
  { name: "Domaine Drouhin Oregon", city: "Dayton", note: "The Burgundy–Oregon connection made permanent in 1988 when the Drouhin family planted Jory-soil Dundee Hills. Véronique Drouhin-Boss makes wines that are unmistakably Oregonian and unmistakably Burgundian at once — the Laurène Pinot Noir is a benchmark. Appointment-only, but worth every step of the planning.", category: "winery", lat: 45.2698, lng: -123.0529, website: "https://www.domainedrouhin.com" },
  { name: "Argyle Winery", city: "Dundee", note: "The valley's finest sparkling wine house, full stop. Vintage Brut and Extended Tirage releases rival grower Champagne at a fraction of the price. The tasting room sits on 99W in downtown Dundee — walk-ins welcome. The still wines (Pinot, Chardonnay) are serious in their own right.", category: "winery", lat: 45.2724, lng: -123.1027, website: "https://www.argylwinery.com" },
  { name: "Sokol Blosser", city: "Dayton", note: "One of Oregon's founding wineries — the Blosser family has farmed Dundee Hills organically since the beginning. The Evolution line is the entry point; the Orchard Block and Old Vineyard Block Pinots are where the terroir really speaks. Stunning hilltop views over the valley. Open daily, no appointment needed.", category: "winery", lat: 45.2625, lng: -123.0681, website: "https://www.sokolblosser.com" },
  { name: "Winderlea Vineyard & Winery", city: "Dundee", note: "Tiny, serious, and worth seeking out. Bill and Donna Redman farm organically on a Worden Hill Road hillside with deep Jory soil. Single-vineyard Pinot Noirs of genuine precision. The tasting room is intimate and the conversation is always substantive.", category: "winery", lat: 45.2868, lng: -123.0482, website: "https://www.winderlea.com" },

  // ── WINERIES: EOLA-AMITY HILLS ────────────────────────────────────────────
  // Van Duzer wind corridor; mineral, elegant, slower to ripen
  { name: "Cristom Vineyards", city: "Salem", note: "Paul Gerrie's estate in the Eola-Amity Hills is a pilgrimage for anyone serious about Oregon Pinot Noir. Four estate single-vineyard bottlings named for women — Eileen, Jessie, Louise, Marjolaine — each a portrait of this wind-cooled appellation. Biodynamic farming. The wines age beautifully.", category: "winery", lat: 44.9996, lng: -123.1454, website: "https://www.cristomvineyards.com" },
  { name: "Bethel Heights Vineyard", city: "Salem", note: "Ted and Terry Casteel's family estate has shaped the Eola-Amity Hills conversation since 1977. The Southeast Block Pinot Noir — from old vines planted at the vineyard's founding — is one of Oregon's most historically significant wines. Warm, unhurried tasting room. Open by appointment.", category: "winery", lat: 44.9905, lng: -123.1299, website: "https://www.bethelheights.com" },
  { name: "Witness Tree Vineyard", city: "Salem", note: "Named for the ancient oak used as a survey landmark in 1854, this Eola-Amity estate grows Pinot Noir, Chardonnay, and Viognier. The Pristine Pinot — grown without synthetic inputs since day one — has a purity that's difficult to explain without a glass in hand.", category: "winery", lat: 44.9935, lng: -123.1398, website: "https://www.witnesstreevineyard.com" },

  // ── WINERIES: CHEHALEM MOUNTAINS ─────────────────────────────────────────
  // Three distinct soil types on one ridge
  { name: "Adelsheim Vineyard", city: "Newberg", note: "David Adelsheim is one of the founders of the Oregon wine industry — he was here before almost anyone. The estate on Calkins Lane in the Chehalem Mountains now spans 200+ acres. The Breaking Ground Pinot Noir and Bryan Creek Chardonnay are the benchmarks. Open Wed–Sun by appointment.", category: "winery", lat: 45.3298, lng: -122.9613, website: "https://www.adelsheim.com" },
  { name: "Bergström Winery", city: "Newberg", note: "Josh Bergström spent years in Burgundy and it shows. Biodynamic certified, minimal-intervention, and deeply serious about place. The Silice Pinot Noir (from Jory soil) and Sigrid Chardonnay are the reference points. The tasting room on Calkins Lane is understated and precisely right.", category: "winery", lat: 45.3264, lng: -122.9430, website: "https://www.bergstromwines.com" },
  { name: "Rex Hill", city: "Newberg", note: "The big red barn on 99W has been pouring serious Chehalem Mountains Pinot since 1982. A Pinot Project — the winery's ownership group — has expanded the sourcing network, but the estate fruit from Jacob-Hart Vineyard remains the anchor. Worth a stop on any Newberg run.", category: "winery", lat: 45.3055, lng: -122.9711, website: "https://www.rexhill.com" },

  // ── WINERIES: RIBBON RIDGE ────────────────────────────────────────────────
  // Tiny, fog-prone, coveted sub-appellation
  { name: "Beaux Frères", city: "Newberg", note: "Robert Parker's brother-in-law planted this North Valley Road site in 1988 with Burgundian clones, and Michael Etzel has made it one of Ribbon Ridge's defining estates. The Beaux Frères Vineyard bottling is intense, structured, and built for the cellar. Appointment required.", category: "winery", lat: 45.3424, lng: -123.0024, website: "https://www.beauxfreres.com" },
  { name: "Brick House Wine Company", city: "Newberg", note: "Doug Tunnell's certified-biodynamic estate on Ribbon Ridge is one of Oregon's most authentic farm operations. He grows Pinot Noir, Gamay Noir, and Chardonnay without synthetic inputs of any kind — the farming and the wines are inseparable. Small production. Appointment only.", category: "winery", lat: 45.3485, lng: -122.9979, website: "https://www.brickhousewines.com" },
  { name: "Patricia Green Cellars", city: "Newberg", note: "No winery in Oregon bottles more distinct Pinot Noir single-vineyard wines than Patricia Green. Jim Anderson and Patty Green have built a reference library of Ribbon Ridge and Chehalem Mountains terroir. The tasting fee is modest and the pours are generous. A mandatory stop for Pinot obsessives.", category: "winery", lat: 45.3399, lng: -123.0011, website: "https://www.patriciagreencellars.com" },

  // ── WINERIES: McMANNVILLE AVA ─────────────────────────────────────────────
  // Volcanic basalt soils; warm, structured
  { name: "Eyrie Vineyards", city: "McMinnville", note: "David Lett planted Oregon's first Pinot Noir vines in 1966 when no one believed it was possible. He proved them wrong. The original estate Pinot — still bottled from those old vines — is a living piece of Oregon wine history. Jason Lett now makes the wines his father pioneered. The tasting room in McMinnville is open daily.", category: "winery", lat: 45.2099, lng: -123.1994, website: "https://www.eyrievineyards.com" },
  { name: "Evening Land Vineyards", city: "McMinnville", note: "Sashi Moorman's project in the Seven Springs Vineyard — one of Oregon's great old-vine sites — produces Pinot Noir of remarkable tension and freshness. The Summum Seven Springs bottling is austere and magnificent. Tasting room on 3rd Street in McMinnville.", category: "winery", lat: 45.2105, lng: -123.1979, website: "https://www.eveninglandvineyards.com" },

  // ── WINERIES: YAMHILL-CARLTON ─────────────────────────────────────────────
  // Ancient marine sedimentary soils (Willakenzie); warm, structured
  { name: "WillaKenzie Estate", city: "Yamhill", note: "Named for the ancient Willakenzie marine sedimentary soils that define this appellation. The estate on Laughlin Road grows Pinot Noir, Pinot Gris, Pinot Blanc, and Gamay — all farmed with Burgundian seriousness. The single-vineyard Pinots show exactly what sedimentary terroir tastes like versus volcanic Jory.", category: "winery", lat: 45.3591, lng: -123.1561, website: "https://www.willakenzie.com" },
  { name: "Penner-Ash Wine Cellars", city: "Newberg", note: "Lynn Penner-Ash was Rex Hill's winemaker for 13 years before starting her own label in 1998. The home estate on Ribbon Ridge Road produces structured, age-worthy Pinot Noir with a winemaker's precision. The tasting room has one of the best views in the valley.", category: "winery", lat: 45.3432, lng: -123.0021, website: "https://www.pennerash.com" },
  { name: "Carlton Winemakers Studio", city: "Carlton", note: "A collective tasting room for small Willamette Valley producers sharing a facility in downtown Carlton. The best way to taste across multiple appellations and styles in one stop. Walk-ins welcome. The town of Carlton itself rewards exploration — good food options nearby.", category: "winery", lat: 45.2953, lng: -123.1772, website: "https://www.winemakersstudio.com" },
  { name: "Anne Amie Vineyards", city: "Carlton", note: "A biodynamic estate on Mineral Springs Road in the Yamhill-Carlton District with commanding views over the valley. The portfolio reaches beyond Pinot Noir into Pinot Gris, Pinot Blanc, Müller-Thurgau, and Riesling — some of the most thoughtfully made white wines in Oregon. The tasting room is welcoming, the vineyard walks are informative, and the picnic grounds are among the most beautiful in the appellation.", category: "winery", lat: 45.2814, lng: -123.2094, website: "https://www.anneamie.com" },
  { name: "Lemelson Vineyards", city: "Carlton", note: "One of Oregon's earliest certified-organic estates, founded by Eric Lemelson in the Stag Hollow ridge above Carlton. The wines are grown on farmed-in-place volcanic and sedimentary soils and made with restrained, terroir-first winemaking. The Jerome Reserve is the flagship — concentrated, age-worthy, and deeply Oregon. Open Friday through Monday in the tasting room; the views of the Coast Range are worth the drive alone.", category: "winery", lat: 45.3020, lng: -123.1315, website: "https://www.lemelsonvineyards.com" },

  // ── WINERIES: SOUTHERN VALLEY ─────────────────────────────────────────────
  { name: "King Estate Winery", city: "Eugene", note: "The largest certified-organic winery in the U.S., tucked into the southern end of the Willamette Valley above Eugene. The estate Pinot Gris is the reference point for Oregon Pinot Gris — bright, mineral, and decisively dry. The restaurant on-site sources heavily from the estate farm and is worth the drive.", category: "winery", lat: 43.9721, lng: -123.2244, website: "https://www.kingestate.com" },

  // ── RESTAURANTS ───────────────────────────────────────────────────────────
  { name: "Joel Palmer House", city: "Dayton", note: "Jack Czarnecki and family have built the definitive truffle restaurant in America inside a 19th-century home on Ferry Street in Dayton. Every menu revolves around Oregon wild mushrooms — truffles, chanterelles, porcini, matsutake — sourced locally and prepared without ego. The Mushroom Madness tasting menu is a pilgrimage. This is why people come to Dayton.", category: "restaurant", lat: 45.2236, lng: -123.0654, website: "https://www.joelpalmerhouse.com" },
  { name: "Nick's Italian Café", city: "McMinnville", note: "The original Willamette Valley wine-country restaurant, open since 1977. Nick Peirano's five-course prix fixe launched the idea that Oregon wine deserved serious food alongside it. The room is imperfect, the pasta is house-made, and the Oregon wine list is encyclopedic. This is where the valley's food culture was born.", category: "restaurant", lat: 45.2085, lng: -123.1966, website: "https://www.nicksitaliancafe.com" },
  { name: "Red Hills Market", city: "Dundee", note: "The essential daytime stop in Dundee — a market, bakery, wood-fired pizzeria, and bottle shop rolled into one warm room on 99W. The pizza uses Oregon grains, the charcuterie board is serious, and the wine selection focuses tightly on local producers. This is where winery workers eat.", category: "restaurant", lat: 45.2718, lng: -123.1009, website: "https://www.redhillsmarket.com" },
  { name: "Thistle Restaurant", city: "McMinnville", note: "Eric Bechard's small room on Evans Street is the most consistently excellent dinner in McMinnville — precise seasonal cooking from Oregon ingredients, a wine list built with real knowledge, and service that doesn't perform. Reservations essential. This is quiet, serious, and very good.", category: "restaurant", lat: 45.2104, lng: -123.1961, website: "https://www.thistlerestaurant.com" },
  { name: "Subterra Restaurant", city: "Newberg", note: "Underground (literally — it's in a basement on First Street) and one of Newberg's best. Seasonal Pacific Northwest menu built around local farms and foraged ingredients. Good Oregon wine list, intimate setting, and the kind of cooking that doesn't need to explain itself.", category: "restaurant", lat: 45.3006, lng: -122.9705, website: "https://www.subterrarestaurant.com" },
  { name: "Community Plate", city: "McMinnville", note: "The daily anchor of downtown McMinnville — breakfast and lunch built around local farms, Oregon eggs, and seasonal produce. The hash is serious, the bread is good, and the coffee is from a local roaster. Where you eat before or after an Eyrie or Evening Land tasting.", category: "restaurant", lat: 45.2102, lng: -123.1979, website: "https://www.communityplate.com" },
  { name: "King Estate Winery Restaurant", city: "Eugene", note: "The on-site restaurant at King Estate sources heavily from the certified-organic estate farm — real farm-to-table, not decorative. The menu rotates with what's growing, the wines are poured by the estate team, and the views over the vineyard are worth the drive to the southern end of the valley.", category: "restaurant", lat: 43.9724, lng: -123.2239, website: "https://www.kingestate.com/visit/restaurant" },
  { name: "The Painted Lady", city: "Newberg", note: "Oregon wine country's most decorated fine dining destination — Forbes Four-Star, AAA Four-Diamond, and consistently the benchmark for what farm-driven tasting-menu cooking looks like in the Willamette Valley. The Victorian house on College Street in Newberg has been setting the standard since 2005. Every course is anchored to Oregon ingredients and the extraordinary Pinot Noir being made in the surrounding hills. Reservations required; plan ahead.", category: "restaurant", lat: 45.3017, lng: -122.9722, website: "https://www.thepaintedladyrestaurant.com" },
  { name: "Hayward", city: "Carlton", note: "Chef Kari Shaughnessy's James Beard Award–nominated restaurant (Best New Restaurant 2024 finalist, Best Chef NW & Pacific 2025 semifinalist) in downtown Carlton. Hyper-seasonal, zero-waste, deeply rooted in Willamette Valley producers. The space feels like a well-loved home; the cooking is precise and completely unsentimental. The best argument for why Carlton is now the valley's most exciting dining address.", category: "restaurant", lat: 45.2946, lng: -123.1788, website: "https://www.haywardrestaurant.com" },
  { name: "The Dundee Bistro", city: "Dundee", note: "The Ponzi family's wine-country institution on the highway in Dundee has been the meeting place for vintners, farmers, and visitors since 1999. Warm room, serious Oregon wine list, and the kind of farm-sourced menu that proves this valley figured out farm-to-table long before it became a marketing phrase. Lunch is especially good — the charcuterie and seasonal salads are the move.", category: "restaurant", lat: 45.2784, lng: -123.0109, website: "https://www.dundeebistro.com" },

  // ── FARMSTANDS & FARMS ────────────────────────────────────────────────────
  { name: "Red Ridge Farms — Oregon Olive Mill", city: "Dayton", note: "The Durant family's 200-acre hazelnut and olive farm in the Dundee Hills produces Oregon's finest estate olive oil. The Olive Mill is the only estate olive oil producer in the Pacific Northwest — the oil is pressed from the estate's Arbequina, Arbosana, and Koroneiki trees, harvested in November. The farm store carries the olive oil, Durant Vineyards wines, and local pantry goods. This is a genuine farm, not a lifestyle brand.", category: "farmstand", lat: 45.2742, lng: -123.0485, website: "https://www.redridgefarms.com" },
  { name: "Gathering Together Farm", city: "Philomath", note: "One of the Willamette Valley's most respected organic farms, supplying restaurants from Portland to Eugene. The on-farm store and CSA sell direct to the public, and the farm stand at the Eugene Farmers Market is a Thursday-morning institution. They grow hundreds of varieties of vegetables — the diversity alone is worth the visit.", category: "farmstand", lat: 44.5398, lng: -123.3695, website: "https://www.gatheringtogetherfarm.com" },
  { name: "Baggenstos Farm", city: "Dayton", note: "A hazelnut and berry farm in the heart of Yamhill County selling direct from the farm and at regional farmers markets. U-pick blackberries and boysenberries in season, hazelnuts after harvest. The kind of operation that feeds the valley's best kitchens without fanfare.", category: "farmstand", lat: 45.2311, lng: -123.0691, website: null },
  { name: "Hopewell Farm", city: "Hopewell", note: "Certified-organic and deeply committed to heirloom vegetable varieties and seed stewardship. The farm stand at the Salem Saturday Market is a destination for restaurant chefs and home cooks alike. The tomato selection in August rivals any in the Pacific Northwest.", category: "farmstand", lat: 45.0488, lng: -123.1064, website: null },

  // ── ARTISAN PRODUCERS ─────────────────────────────────────────────────────
  { name: "Jacobsen Salt Co.", city: "Portland", note: "Portland-based, but foundational to the Pacific Northwest food identity — Ben Jacobsen hand-harvests salt from Netarts Bay on the Oregon coast. Pure, clean flake salt that is used at nearly every serious restaurant in the valley. This is what finishing salt looks like in Oregon.", category: "producer", lat: 45.5236, lng: -122.6814, website: "https://www.jacobsensalt.com" },
  { name: "Fraga Farm", city: "Sweet Home", note: "One of Oregon's finest artisan cheesemakers — the Fraga family's Alsea Acre goat cheeses are Slow Food Ark of Taste products. Fresh chèvre, aged tomme, and bloomy-rind rounds that pair precisely with Eola-Amity Hills Pinot Gris. Available at farmers markets and Portland specialty stores.", category: "producer", lat: 44.4008, lng: -122.7319, website: "https://www.fragafarm.com" },
  { name: "Wandering Aengus Ciderworks", city: "Salem", note: "The most serious cidermaker in the Willamette Valley — working with heritage and heirloom apple varieties, some from trees planted by homesteaders, to make ciders with the structural complexity of wine. Tasting room in Salem pours the full range. The Anthem and Wandering Aengus labels are benchmarks for American craft cider.", category: "producer", lat: 44.9340, lng: -123.0334, website: "https://www.wanderingaengus.com" },
  { name: "Oregon Truffle Festival", city: "Eugene", note: "The defining event of the Willamette Valley's winter food calendar — held January and February in Eugene and the valley, with truffle hunts, cultivation workshops, winemaker dinners, and the Grand Truffle Dinner, which brings together the valley's best chefs and foragers. David Lumpkin's event is serious, educational, and essential if you're here in truffle season.", category: "producer", lat: 44.0521, lng: -123.0868, website: "https://www.oregontrufflefestival.com" },
];

export async function seedIfEmpty() {
  try {
    const [row] = await db.select({ count: count() }).from(markersTable);
    const existing = Number(row?.count ?? 0);

    if (existing === 0) {
      logger.info("Database is empty — seeding initial data...");
      const result = await db.insert(markersTable).values(SEED_DATA).returning({ name: markersTable.name });
      logger.info({ count: result.length }, "Seed complete");
      return;
    }

    // Insert any new seed entries not yet in the database (key: name+category)
    const rows = await db.select({ name: markersTable.name, category: markersTable.category }).from(markersTable);
    const existingKeys = new Set(rows.map((r) => `${r.name}||${r.category}`));
    const missing = SEED_DATA.filter((s) => !existingKeys.has(`${s.name}||${s.category}`));
    if (missing.length > 0) {
      const result = await db.insert(markersTable).values(missing).returning({ name: markersTable.name });
      logger.info({ count: result.length, names: result.map((r) => r.name) }, "Inserted new seed entries");
    } else {
      logger.info({ existing }, "Database already seeded — skipping");
    }
  } catch (err) {
    logger.error({ err }, "Seed failed — continuing without seeding");
  }
}

export async function correctCoordinates() {
  try {
    // Remove entries that have been deleted from the curated seed list
    if (REMOVED_FROM_SEED.length > 0) {
      const deleted = await db
        .delete(markersTable)
        .where(inArray(markersTable.name, REMOVED_FROM_SEED))
        .returning({ name: markersTable.name });
      if (deleted.length > 0) {
        logger.info({ names: deleted.map((r) => r.name) }, "Removed entries deleted from DB");
      }
    }

    // Remove ALL existing Sonoma-era markers before inserting new Willamette Valley data
    // This ensures a clean slate when re-seeding for the new region
    const allRows = await db.select({ name: markersTable.name, category: markersTable.category }).from(markersTable);
    const seedKeys = new Set(SEED_DATA.map((s) => `${s.name}||${s.category}`));
    const obsolete = allRows.filter((r) => !seedKeys.has(`${r.name}||${r.category}`));
    if (obsolete.length > 0) {
      for (const row of obsolete) {
        await db.delete(markersTable)
          .where(eq(markersTable.name, row.name));
      }
      logger.info({ count: obsolete.length }, "Removed obsolete markers not in current seed");
    }

    // Remove duplicate entries — keep the highest ID for each name+category pair
    const deduped = await db.execute(sql`
      DELETE FROM ${markersTable}
      WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY name, category ORDER BY id DESC) AS rn
          FROM ${markersTable}
        ) sub WHERE rn > 1
      )
      RETURNING name
    `);
    if (deduped.rows.length > 0) {
      logger.info({ count: deduped.rows.length }, "Duplicate entries removed");
    }

    logger.info("Correcting marker data to verified values...");
    let updated = 0;
    for (const spot of SEED_DATA) {
      const result = await db
        .update(markersTable)
        .set({ lat: spot.lat, lng: spot.lng, note: spot.note, website: spot.website ?? null, city: spot.city ?? null })
        .where(eq(markersTable.name, spot.name))
        .returning({ id: markersTable.id });
      updated += result.length;
    }
    logger.info({ updated }, "Marker data correction complete");
  } catch (err) {
    logger.error({ err }, "Coordinate correction failed");
  }
}
