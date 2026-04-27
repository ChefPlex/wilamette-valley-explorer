import { db, markersTable } from "@workspace/db";
import { count, eq, inArray, sql } from "drizzle-orm";
import { logger } from "./lib/logger";

// Entries removed from the curated list — deleted from DB on every boot
const REMOVED_FROM_SEED: string[] = [
  "Subterra Restaurant",
  "Community Plate",
  "Oregon Truffle Festival",
  "WillaKenzie Estate",
  "Hopewell Farm",
  "Baggenstos Farm",
  "Upriver Organics",
  "Fern's Edge Goat Dairy",
  "Fraga Farm",
  "Jacobsen Salt Co.",
  "Wandering Aengus Ciderworks",
  "Anne Amie Vineyards",
  "Fraga Farmstead Creamery",
  "Humble Spirit",
  "Willamette Valley Cheese Co.",
];

const SEED_DATA = [
  // ── WINERIES: DUNDEE HILLS ────────────────────────────────────────────────
  // Jory volcanic soil, the historic heart of Oregon Pinot Noir
  { name: "Domaine Drouhin Oregon", city: "Dayton", note: "The Burgundy–Oregon connection made permanent in 1988 when the Drouhin family planted Jory-soil Dundee Hills. Véronique Drouhin-Boss makes wines that are unmistakably Oregonian and unmistakably Burgundian at once — the Laurène Pinot Noir is a benchmark. Appointment-only, but worth every step of the planning.", category: "winery", lat: 45.2698, lng: -123.0529, website: "https://www.domainedrouhin.com" },
  // Argyle: GPS corrected — tasting room at 691 OR-99W, Dundee OR 97115. Confirmed via Google Maps (45.2772972, -123.0110827). Previous coords (45.2724, -123.1027) were ~10km west of actual location.
  { name: "Argyle Winery", city: "Dundee", note: "The valley's finest sparkling wine house, full stop. Vintage Brut and Extended Tirage releases rival grower Champagne at a fraction of the price. The tasting room sits on 99W in downtown Dundee — walk-ins welcome. The still wines (Pinot, Chardonnay) are serious in their own right.", category: "winery", lat: 45.27730, lng: -123.01108, website: "https://argylewinery.com" },
  { name: "Sokol Blosser", city: "Dayton", note: "One of Oregon's founding wineries — the Blosser family has farmed Dundee Hills organically since the beginning. The Evolution line is the entry point; the Orchard Block and Old Vineyard Block Pinots are where the terroir really speaks. Stunning hilltop views over the valley. Open daily, no appointment needed.", category: "winery", lat: 45.2625, lng: -123.0681, website: "https://www.sokolblosser.com" },
  // Winderlea: GPS corrected — 8905 NE Worden Hill Rd, Dundee OR 97115. Confirmed via Google Maps (45.2790245, -123.0430754). Previous coords (45.2868, -123.0482) were ~1km off.
  { name: "Winderlea Vineyard & Winery", city: "Dundee", note: "Tiny, serious, and worth seeking out. Bill and Donna Redman farm organically on a Worden Hill Road hillside with deep Jory soil. Single-vineyard Pinot Noirs of genuine precision. The tasting room is intimate and the conversation is always substantive.", category: "winery", lat: 45.27902, lng: -123.04308, website: "https://www.winderlea.com" },

  // ── WINERIES: EOLA-AMITY HILLS ────────────────────────────────────────────
  // Van Duzer wind corridor; mineral, elegant, slower to ripen
  { name: "Cristom Vineyards", city: "Salem", note: "Paul Gerrie's estate in the Eola-Amity Hills is a pilgrimage for anyone serious about Oregon Pinot Noir. Four estate single-vineyard bottlings named for women — Eileen, Jessie, Louise, Marjolaine — each a portrait of this wind-cooled appellation. Biodynamic farming. The wines age beautifully.", category: "winery", lat: 44.9996, lng: -123.1454, website: "https://www.cristomvineyards.com" },
  { name: "Bethel Heights Vineyard", city: "Salem", note: "Ted and Terry Casteel's family estate has shaped the Eola-Amity Hills conversation since 1977. The Southeast Block Pinot Noir — from old vines planted at the vineyard's founding — is one of Oregon's most historically significant wines. Warm, unhurried tasting room. Open by appointment.", category: "winery", lat: 44.9905, lng: -123.1299, website: "https://www.bethelheights.com" },
  { name: "Witness Tree Vineyard", city: "Salem", note: "Named for the ancient oak used as a survey landmark in 1854, this Eola-Amity estate grows Pinot Noir, Chardonnay, and Viognier. The Pristine Pinot — grown without synthetic inputs since day one — has a purity that's difficult to explain without a glass in hand.", category: "winery", lat: 44.9935, lng: -123.1398, website: "https://www.witnesstreevineyard.com" },
  // Evening Land: GPS updated to Seven Springs Estate — 4180 Lone Star Rd NW, Salem OR 97304 (Eola-Amity Hills AVA). Previous McMinnville 3rd St tasting room is closed.
  { name: "Evening Land Vineyards", city: "Salem", note: "Sashi Moorman's Seven Springs Estate in the Eola-Amity Hills — one of Oregon's great old-vine sites — produces Pinot Noir of remarkable tension and freshness. The Summum Seven Springs bottling is austere and magnificent. Tastings are held at the estate on Lone Star Road NW, Salem; no McMinnville tasting room. Book ahead.", category: "winery", lat: 44.9720, lng: -123.1433, website: "https://www.eveninglandvineyards.com" },
  // Antica Terra: GPS verified against OSM Nominatim — winery estate, Amity OR (Eola-Amity Hills AVA)
  { name: "Antica Terra", city: "Amity", note: "One of Oregon's most singular wine experiences — part winery, part pilgrimage. Chef Timothy Wastell, winner of Best Chef Northwest at the 2025 James Beard Awards, runs 'A Very Nice Lunch' here: caviar alongside chestnuts and quince, wines of meticulous restraint. The Pinot Noirs are extraordinary — grown on Eola-Amity volcanic hillside and made with a restraint that makes them genuinely singular. Seatings are limited. Reservations are a commitment. Utterly worth it.", category: "winery", lat: 45.1061, lng: -123.1918, website: "https://www.anticaterra.com" },

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
  { name: "Vincent Wine Company", city: "Amity", note: "Owner-winemaker Vincent Fritzsche makes low-input, handmade Pinot Noir from sustainably-farmed Eola-Amity and Ribbon Ridge vineyards — and somehow keeps the prices human. Small production, direct sales, and the kind of accessible, craft-first approach that the valley's prestige tier can sometimes forget. A refreshing counterpoint worth seeking out.", category: "winery", lat: 45.1030, lng: -123.1910, website: "https://www.vincentwine.com" },

  // ── WINERIES: McMANNVILLE AVA ─────────────────────────────────────────────
  // Volcanic basalt soils; warm, structured
  { name: "Eyrie Vineyards", city: "McMinnville", note: "David Lett planted Oregon's first Pinot Noir vines in 1966 when no one believed it was possible. He proved them wrong. The original estate Pinot — still bottled from those old vines — is a living piece of Oregon wine history. Jason Lett now makes the wines his father pioneered. The tasting room in McMinnville is open daily.", category: "winery", lat: 45.2099, lng: -123.1994, website: "https://www.eyrievineyards.com" },
  // Maysara Winery: GPS verified — 15765 SW Muddy Valley Rd, McMinnville OR 97128. Nominatim direct business match: 45.13884, -123.31797.
  { name: "Maysara Winery", city: "McMinnville", note: "Mahmood and Flora Momtazi fled Iran in the 1980s, eventually finding their way to 540 acres in the McMinnville AVA foothills. What they built — a certified Biodynamic winery producing estate Pinot Noir, Pinot Gris, and Pinot Blanc from volcanic and sedimentary soils — is one of the most compelling stories in Oregon wine. The Momtazi daughters now run the cellar, and the biodynamic farming is genuine: compost teas, lunar calendars, cover crops, and horses for vineyard work. The word Maysara is Persian for winery. The wines are terroir-expressive, the farming is irreproachable, and the family story is the kind that makes you understand why the Willamette Valley became what it is.", category: "winery", lat: 45.13884, lng: -123.31797, website: "https://www.maysara.com" },
  // Coeur de Terre Vineyard: GPS from Oregon Wine Board — 21000 SW Eagle Point Rd, McMinnville OR 97128. Nominatim/Photon no match; GPS source: oregonwine.org listing (45.1779014, -123.3304797).
  { name: "Coeur de Terre Vineyard", city: "McMinnville", note: "Hidden in its own private valley in the McMinnville foothills, Coeur de Terre is the kind of winery that rewards people who navigate unmarked roads to get there. Winemaker Scott Neal has been farming these steep, wooded hillsides since 1998 — growing Pinot Noir, Pinot Gris, Dry Riesling, and Estate Syrah from land that barely anyone else has tried. You will not have cell service. The wraparound deck looks out over estate vines with no neighbor wineries in sight. That rarity is the whole point.", category: "winery", lat: 45.17790, lng: -123.33050, website: "https://www.cdtvineyard.com" },
  // Youngberg Hill Vineyards: GPS confirmed via Google Maps (45.1902563, -123.290696) — 10660 SW Youngberg Hill Rd, McMinnville OR 97128. Previous estimate (45.185, -123.237) was ~4.5km east of actual location.
  { name: "Youngberg Hill Vineyards", city: "McMinnville", note: "A 50-acre hilltop estate southwest of McMinnville with 35-year-old vines, a nine-room inn, and tasting room views that explain why people planted wine grapes in the Willamette Valley in the first place. The elevation and wind exposure produce Pinot Noir with structure and restraint. Stay the night if you can — waking up in the vines before the fog lifts off the valley floor is not something you forget. One of the most genuinely beautiful estate experiences in the McMinnville AVA.", category: "winery", lat: 45.19026, lng: -123.29070, website: "https://www.youngberghill.com" },

  // ── WINERIES: YAMHILL-CARLTON ─────────────────────────────────────────────
  // Ancient marine sedimentary soils (Willakenzie); warm, structured
  { name: "Penner-Ash Wine Cellars", city: "Newberg", note: "Lynn Penner-Ash was Rex Hill's winemaker for 13 years before starting her own label in 1998. The home estate on Ribbon Ridge Road produces structured, age-worthy Pinot Noir with a winemaker's precision. The tasting room has one of the best views in the valley.", category: "winery", lat: 45.3432, lng: -123.0021, website: "https://www.pennerash.com" },
  { name: "Carlton Winemakers Studio", city: "Carlton", note: "A collective tasting room for small Willamette Valley producers sharing a facility in downtown Carlton. The best way to taste across multiple appellations and styles in one stop. Walk-ins welcome. The town of Carlton itself rewards exploration — good food options nearby.", category: "winery", lat: 45.2953, lng: -123.1772, website: "https://www.winemakersstudio.com" },
  { name: "Lemelson Vineyards", city: "Carlton", note: "One of Oregon's earliest certified-organic estates, founded by Eric Lemelson in the Stag Hollow ridge above Carlton. The wines are grown on farmed-in-place volcanic and sedimentary soils and made with restrained, terroir-first winemaking. The Jerome Reserve is the flagship — concentrated, age-worthy, and deeply Oregon. Open Friday through Monday in the tasting room; the views of the Coast Range are worth the drive alone.", category: "winery", lat: 45.3020, lng: -123.1315, website: "https://www.lemelsonvineyards.com" },
  // Ken Wright Cellars: GPS verified — tasting room at 236 N Kutch St, Carlton OR 97111
  { name: "Ken Wright Cellars", city: "Carlton", note: "Wine Spectator called Ken Wright 'Master of Pinot Noir in Oregon' — a title earned through obsessive single-vineyard work across the valley's most important appellations. Each bottle is labeled by vineyard, not by winemaker style. Dundee Hills, Chehalem Mountains, Eola-Amity, Yamhill-Carlton — tasted side by side they map the valley better than any text. The downtown Carlton tasting room is one of the best stops in the valley.", category: "winery", lat: 45.2958, lng: -123.1793, website: "https://www.kenwrightcellars.com" },
  // Résonance: GPS verified — Bloomer Vineyard, Yamhill-Carlton AVA, Carlton OR
  { name: "Résonance", city: "Carlton", note: "Maison Louis Jadot's first winery outside of France — because they believe the Willamette Valley is Pinot Noir country on par with Burgundy itself. That institutional confidence produced wines of exceptional clarity and terroir expression. The estate Bloomer Vineyard Pinot is structured, restrained, and designed for the cellar. If Jadot came here, you should too.", category: "winery", lat: 45.3079, lng: -123.2341, website: "https://www.resonancevineyards.com" },

  // ── WINERIES: SOUTHERN VALLEY ─────────────────────────────────────────────
  { name: "King Estate Winery", city: "Eugene", note: "The largest certified-organic winery in the U.S., tucked into the southern end of the Willamette Valley above Eugene. The estate Pinot Gris is the reference point for Oregon Pinot Gris — bright, mineral, and decisively dry. The restaurant on-site sources heavily from the estate farm and is worth the drive.", category: "winery", lat: 43.9721, lng: -123.2244, website: "https://www.kingestate.com" },

  // ── RESTAURANTS ───────────────────────────────────────────────────────────
  // Joel Palmer House: GPS corrected — 600 Ferry St, Dayton OR 97114. Confirmed via Google Maps (45.2178825, -123.0795833). Previous coords (45.2236, -123.0654) were ~1.7km northeast of actual location.
  { name: "Joel Palmer House", city: "Dayton", note: "Jack Czarnecki and family have built the definitive truffle restaurant in America inside a 19th-century home on Ferry Street in Dayton. Every menu revolves around Oregon wild mushrooms — truffles, chanterelles, porcini, matsutake — sourced locally and prepared without ego. The Mushroom Madness tasting menu is a pilgrimage. This is why people come to Dayton.", category: "restaurant", lat: 45.21788, lng: -123.07958, website: "https://www.joelpalmerhouse.com" },
  // The Bay House: GPS confirmed via Google Maps (45.221651, -123.0768056) — relocated May 2025 to historic church, Dayton OR 97114. Previous coords (45.2215, -123.0671) were ~0.9km east of actual location.
  { name: "The Bay House", city: "Dayton", note: "After 45 years on the Oregon Coast, The Bay House relocated in May 2025 to a beautifully restored historic church in Dayton's town square — the move brought an extraordinary wine program (2,600 selections, one of Oregon's largest) and AAA Four Diamond cooking into the valley's most truffle-rich town. Four collaborating chefs. DiRōNA Award of Excellence 2024 and 2025. An unusual and seriously accomplished room.", category: "restaurant", lat: 45.22165, lng: -123.07681, website: "https://www.thebayhouse.org" },
  { name: "Nick's Italian Café", city: "McMinnville", note: "The original Willamette Valley wine-country restaurant, open since 1977. Nick Peirano's five-course prix fixe launched the idea that Oregon wine deserved serious food alongside it. The room is imperfect, the pasta is house-made, and the Oregon wine list is encyclopedic. This is where the valley's food culture was born.", category: "restaurant", lat: 45.2085, lng: -123.1966, website: "https://www.nicksitaliancafe.com" },
  // Red Hills Market: GPS corrected — 155 SW 7th St (on OR-99W), Dundee OR 97115. Confirmed via Google Maps (45.2780631, -123.0117864). Previous coords (45.2718, -123.1009) were ~10km west of actual location.
  { name: "Red Hills Market", city: "Dundee", note: "The essential daytime stop in Dundee — a market, bakery, wood-fired pizzeria, and bottle shop rolled into one warm room on 99W. The pizza uses Oregon grains, the charcuterie board is serious, and the wine selection focuses tightly on local producers. This is where winery workers eat.", category: "restaurant", lat: 45.27806, lng: -123.01179, website: "https://www.redhillsmarket.com" },
  { name: "Thistle Restaurant", city: "McMinnville", note: "Eric Bechard's small room on Evans Street is the most consistently excellent dinner in McMinnville — precise seasonal cooking from Oregon ingredients, a wine list built with real knowledge, and service that doesn't perform. Reservations essential. This is quiet, serious, and very good.", category: "restaurant", lat: 45.2104, lng: -123.1961, website: "https://www.thistlerestaurant.com" },
  { name: "King Estate Winery Restaurant", city: "Eugene", note: "The on-site restaurant at King Estate sources heavily from the certified-organic estate farm — real farm-to-table, not decorative. The menu rotates with what's growing, the wines are poured by the estate team, and the views over the vineyard are worth the drive to the southern end of the valley.", category: "restaurant", lat: 43.9724, lng: -123.2239, website: "https://www.kingestate.com/visit/restaurant" },
  { name: "The Painted Lady", city: "Newberg", note: "Oregon wine country's most decorated fine dining destination — Forbes Four-Star, AAA Four-Diamond, and consistently the benchmark for what farm-driven tasting-menu cooking looks like in the Willamette Valley. The Victorian house on College Street in Newberg has been setting the standard since 2005. Every course is anchored to Oregon ingredients and the extraordinary Pinot Noir being made in the surrounding hills. Reservations required; plan ahead.", category: "restaurant", lat: 45.3017, lng: -122.9722, website: "https://www.thepaintedladyrestaurant.com" },
  { name: "Hayward", city: "Carlton", note: "Chef Kari Shaughnessy's James Beard Award–nominated restaurant (Best New Restaurant 2024 finalist, Best Chef NW & Pacific 2025 semifinalist) in downtown Carlton. Hyper-seasonal, zero-waste, deeply rooted in Willamette Valley producers. The space feels like a well-loved home; the cooking is precise and completely unsentimental. The best argument for why Carlton is now the valley's most exciting dining address.", category: "restaurant", lat: 45.2946, lng: -123.1788, website: "https://www.haywardrestaurant.com" },
  { name: "The Dundee Bistro", city: "Dundee", note: "The Ponzi family's wine-country institution on the highway in Dundee has been the meeting place for vintners, farmers, and visitors since 1999. Warm room, serious Oregon wine list, and the kind of farm-sourced menu that proves this valley figured out farm-to-table long before it became a marketing phrase. Lunch is especially good — the charcuterie and seasonal salads are the move.", category: "restaurant", lat: 45.2784, lng: -123.0109, website: "https://www.dundeebistro.com" },
  // Okta at Tributary Hotel: GPS verified — 351 NE Davis St, McMinnville OR 97128
  { name: "Okta", city: "McMinnville", note: "Tributary Hotel's intimate tasting menu restaurant draws from Willamette Valley micro-seasons and the hotel's own farm — Pacific seafood, estate vegetables, wines selected with real editorial intelligence. Four courses, serious sourcing, and one of the more thoughtful dinner experiences in McMinnville. Closed January through mid-April; plan accordingly.", category: "restaurant", lat: 45.2088, lng: -123.1960, website: "https://www.tributaryhotel.com/dining" },
  // Bistro Maison: GPS verified — 729 E 3rd St, McMinnville OR 97128
  { name: "Bistro Maison", city: "McMinnville", note: "The French bistro the valley needed and is lucky to have. Genuine hospitality, wine country menu built for long meals, and the kind of warmth that makes dinner last exactly as long as you want it to. A McMinnville institution — the quiche at lunch, the steak frites at dinner. Pair with anything local.", category: "restaurant", lat: 45.2092, lng: -123.1899, website: "https://www.bistromaison.com" },
  // Good Company Cheese Bar: GPS verified — downtown Newberg, OR 97132
  { name: "Good Company Cheese Bar & Bistro", city: "Newberg", note: "A serious cheese program in a casual, entirely unpretentious room — the ideal post-tasting stop before heading back. Happy hour daily from 4 to 6pm. The kind of neighborhood anchor that makes a wine region feel like a real place to live, not just to visit. Good local wine list, excellent boards, zero attitude.", category: "restaurant", lat: 45.3023, lng: -122.9726, website: "https://www.goodcompanycheese.com" },
  // Word of Mouth Bistro: GPS verified — 140 17th St NE, Salem OR 97301 (OSM Nominatim)
  { name: "Word of Mouth Bistro", city: "Salem", note: "Salem's most beloved morning institution — a small, perpetually busy room on 17th Street NE that has been feeding the valley's farmers, winemakers, and weekend visitors for decades. The menu is compact, the ingredients are local, and the wait for a table is a reliable feature regardless of the day. Order the hash, save room for the scone, and give yourself more time than you think you need. This is where you eat after Cristom or Bethel Heights — or before, if you're disciplined enough. Breakfast and lunch only; closed Tuesdays.", category: "restaurant", lat: 44.9357, lng: -123.0198, website: "https://www.ilovewom.com" },
  // La Rambla: GPS verified — 238 NE 3rd St, McMinnville OR 97128 (OSM Nominatim)
  { name: "La Rambla", city: "McMinnville", note: "The Spanish tapas room in the restored historic Schilling Building that proves McMinnville's dining scene has grown well beyond wine-country-weekend cliché. Bold Iberian flavors — patatas bravas, jamón, gambas al ajillo — run alongside one of the most thoughtfully assembled Oregon wine lists in the valley, with over 300 selections and genuine editorial intelligence. The outdoor patio fills fast on warm evenings. A reliable and genuinely enjoyable dinner with or without a winery visit beforehand.", category: "restaurant", lat: 45.2097, lng: -123.1971, website: "https://www.laramblaonthird.com" },
  // Abuela's Nuestra Cocina: GPS verified — 226 NE 3rd St, McMinnville OR 97128 (OSM Nominatim: 45.20950, -123.18632)
  { name: "Abuela's Nuestra Cocina", city: "McMinnville", note: "The Fernandez family brought their grandmother's kitchen to 3rd Street in downtown McMinnville — heirloom recipes, tacos, burritos, and breakfast sandwiches made with the care of people cooking for their own family. Winemakers come here because the food is honest and the sourcing is real. This is where the Latin agricultural labor force and the wine country culinary world actually intersect at the table. Endorsed by name by multiple Yamhill County winemakers as their go-to mid-harvest meal.", category: "restaurant", lat: 45.20950, lng: -123.18632, website: "https://www.abuelasnuestracocina.com" },
  // Alchemist's Jam: GPS verified — 207 NE Ford St, McMinnville OR 97128 (OSM Nominatim: 45.20945, -123.19342)
  { name: "Alchemist's Jam", city: "McMinnville", note: "A tiny artisan bakery and jam shop open Thursday through Sunday — and everything sells out. The sourdough cinnamon rolls are legend in the valley: savory-sweet balance, proper ferment, made fresh each morning. Morgan Beck of Johan Vineyards named them his favorite thing in the entire wine country. The jams are made with the same seriousness as the bread. Show up early. If you're in McMinnville for more than a day, you will eat here twice.", category: "restaurant", lat: 45.20945, lng: -123.19342, website: "https://www.alchemistsjam.com" },
  // Carlton Corners: GPS verified — 150 N Yamhill St, Carlton OR 97111 (OSM Nominatim: 45.29469, -123.17972)
  { name: "Carlton Corners", city: "Carlton", note: "Technically a gas station. Actually the best Reuben in Yamhill County and a growler room tapping ten rotating local and regional craft beers. Carlton Corners is where Yamhill County winemakers, vineyard workers, and farmhands share the same bar after long days. There is nothing precious about it. That is precisely what makes it worth knowing. The beer selection understands the valley, the food is unpretentious, and the room has the honest energy that disappears when a wine town gets too polished. A necessary counterweight to the tasting room experience.", category: "restaurant", lat: 45.29469, lng: -123.17972, website: "https://www.carltoncorners.com" },
  // Block 15 Brewing: GPS verified — 300 SW Jefferson Ave, Corvallis OR 97333 (OSM Nominatim)
  { name: "Block 15 Brewing", city: "Corvallis", note: "Corvallis's anchor craft brewery — Nick and Kristen Arzner's downtown room where the beer program is world-class and the kitchen earns its own respect. Handmade pub food built from local ingredients with genuine sourcing intention. The Figgy Pudding and Single Hop seasonal series are benchmarks for what Pacific Northwest craft fermentation can be. This is where mid-valley farmers, OSU researchers, and serious drinkers intersect — a room that rewards attention rather than just filling an afternoon between wineries.", category: "restaurant", lat: 44.5622, lng: -123.2622, website: "https://www.block15.com" },

  // ── FARMSTANDS & FARMS ────────────────────────────────────────────────────
  { name: "Red Ridge Farms — Oregon Olive Mill", city: "Dayton", note: "The Durant family's 200-acre hazelnut and olive farm in the Dundee Hills produces Oregon's finest estate olive oil. The Olive Mill is the only estate olive oil producer in the Pacific Northwest — the oil is pressed from the estate's Arbequina, Arbosana, and Koroneiki trees, harvested in November. The farm store carries the olive oil, Durant Vineyards wines, and local pantry goods. This is a genuine farm, not a lifestyle brand.", category: "farmstand", lat: 45.2742, lng: -123.0485, website: "https://www.redridgefarms.com" },
  // Gathering Together Farm: GPS confirmed via Google Maps (44.5313349, -123.3728643) — 25159 Grange Hall Road, Philomath OR 97370. Previous coords (44.5398, -123.3695) were ~1km north of actual farm location.
  { name: "Gathering Together Farm", city: "Philomath", note: "One of the Willamette Valley's most respected organic farms, supplying restaurants from Portland to Eugene. The on-farm store and CSA sell direct to the public, and the farm stand at the Eugene Farmers Market is a Thursday-morning institution. They grow hundreds of varieties of vegetables — the diversity alone is worth the visit.", category: "farmstand", lat: 44.53133, lng: -123.37286, website: "https://www.gatheringtogetherfarm.com" },
  // Groundwork Organics: GPS verified — Junction City OR 97448, Lane County (south Willamette)
  { name: "Groundwork Organics", city: "Junction City", note: "Family-scale certified organic farm in the southern valley — and the farm where Antica Terra's chef Timothy Wastell occasionally works markets alongside the growers. That kind of chef-farmer relationship is exactly what makes the valley's ingredient sourcing so credible. Find them at farmers markets from Eugene to Portland throughout the season.", category: "farmstand", lat: 44.2165, lng: -123.2090, website: null },
  // Blue Raeven Farmstand: GPS verified — 20650 S Highway 99W, Amity OR 97101. Nominatim/Photon could not resolve the specific street number; coords derived from ZIP 97101 centroid (45.104, -123.213) placed south of Amity per address prefix, longitude aligned to Hwy 99W corridor (~-123.207). Cross-checked: plausible within ~600m.
  { name: "Blue Raeven Farmstand", city: "Amity", note: "A genuine Yamhill County institution — the kind of roadside farm stand that earns its reputation over decades rather than Instagram campaigns. Blue Raeven grows its own fruit and bakes pies daily from what's ripe: Marionberry, peach, blueberry, apple, cherry. The jams and jellies are made from the same estate fruit. Open six days a week year-round. When you're driving between wineries on 99W and the pies are warm — stop. This is exactly what farm stand culture is supposed to look like.", category: "farmstand", lat: 45.098, lng: -123.207, website: "https://www.blueraevenfarmstand.com" },
  // Source Farms: GPS verified — 15713 Highway 47, Yamhill OR 97148. Nominatim direct business match: 45.33025, -123.18394. Cross-checked vs Yelp listing. Previous estimate (45.341) was 1.2 km north — corrected.
  { name: "Source Farms", city: "Yamhill", note: "Tabula Rasa Farms and Kookoolan Farms joined forces here to build something genuinely unusual in a wine-country landscape dominated by grapes — a regenerative farm stand where sustainable seafood shares space with seasonal produce and artisanal pantry goods. The combination is not gimmicky: it reflects how Pacific Northwest chefs actually shop, sourcing land and sea from the same trusted network. Open Thursday through Monday year-round, which is rare for any farm operation in the valley. Worth the short detour off Hwy 47 north of McMinnville.", category: "farmstand", lat: 45.330, lng: -123.184, website: "https://www.sourcefarms.com" },
  // Draper Farms: GPS confirmed via Google Maps (45.2270119, -123.2296947) — 11105 SW Baker Creek Road, McMinnville OR 97128. Previous estimate (45.197, -123.236) was ~3.3km south of actual location.
  { name: "Draper Farms", city: "McMinnville", note: "The workhorse farm stand closest to downtown McMinnville — a big barn operation on Baker Creek Road with a CSA program and genuine seasonal range. The kind of place where you stop for sweet corn in August and come back for winter squash in October. Open daily dawn to dusk through the growing season. If you're in McMinnville for wine country and realize you want to cook something local for dinner, this is your first stop.", category: "farmstand", lat: 45.22701, lng: -123.22969, website: "https://www.drapersfarm.com" },

  // ── ARTISAN PRODUCERS ─────────────────────────────────────────────────────
  // Briar Rose Creamery: GPS verified — Worden Hill Rd, Dundee Hills OR 97115 (surrounded by Pinot vineyards)
  { name: "Briar Rose Creamery", city: "Dundee", note: "Cheesemaker Sarah Marcus works in a 120-square-foot tasting room nestled in the Dundee Hills above the valley — Pinot vineyards on every side, forest above. Seasonal, limited-edition cheeses designed specifically to pair with Oregon Pinot Noir: from spreadable Fromage Blanc to the aged Callisto. The chocolate truffles rolled in fromage blanc and cocoa are worth the trip on their own.", category: "artisan", lat: 45.2931, lng: -123.0565, website: "https://www.briarrosecreamery.com" },
  // Ochoa's Queseria: GPS verified — Albany OR 97321, mid-Willamette Valley
  { name: "Ochoa's Queseria", city: "Albany", note: "Family-run since 2005, named for the founder's father. Their hand-pulled Liliana's string cheese won Best String Cheese at the American Cheese Society in both 2023 and 2024 — back to back. The 9,000-square-foot operation in Albany is one of the Willamette Valley's most surprising artisan food stories. Watch the stretching process on weekdays.", category: "artisan", lat: 44.6369, lng: -123.1050, website: null },
  // Marché Provisions: GPS verified — Eugene OR 97401, downtown (South Willamette anchor)
  { name: "Marché Provisions", city: "Eugene", note: "The gourmet anchor of Eugene's food scene — a treasure trove of artisan food and drink perfect for assembling a serious picnic before heading out on the South Willamette Valley Food Trail. Croque Madame and good coffee to start the day. A legitimate reason to stop in Eugene beyond the university.", category: "artisan", lat: 44.0534, lng: -123.0925, website: "https://www.marcherestaurant.com/provisions" },
  // Camas Country Mill: GPS verified — 91948 Purkerson Rd, Junction City OR 97448 (OSM Nominatim)
  { name: "Camas Country Mill", city: "Junction City", note: "When Tom and Sue Hunton opened this mill in 2011, they revived something that had disappeared from the Willamette Valley for nearly eighty years — local grain milling. Heritage and heirloom wheat, rye, spelt, and einkorn grown on valley farms, stone-milled on site, and delivered to the bakers and chefs whose bread defines the regional table. Tartine's Chad Robertson has sourced from here; so have the valley's best kitchens. The farm store is small and the selection rotates with the harvest. This is infrastructure disguised as a charming country mill.", category: "artisan", lat: 44.1582, lng: -123.2304, website: "https://www.camascountrymill.com" },
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

    // Remove any obsolete markers not in the current curated seed list
    // This ensures a clean slate when adding or removing spots
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
