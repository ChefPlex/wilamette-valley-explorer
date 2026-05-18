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
  "Marché Provisions",
  "King Estate Winery Restaurant",
  "Briar Rose Creamery",
  "The Dundee Bistro",
  "Bergström Winery",
  "Good Company Cheese Bar & Bistro",
  "Okta",
  "Red Ridge Farms — Oregon Olive Mill",
];

const SEED_DATA = [
  // ── WINERIES: DUNDEE HILLS ────────────────────────────────────────────────
  // Jory volcanic soil, the historic heart of Oregon Pinot Noir
  // Domaine Drouhin Oregon: GPS confirmed via Google Maps (45.2655399, -123.0556336) — Breyman Orchards Rd, Dayton OR 97114. Previous estimate (45.2698, -123.0529) was ~500m north of actual location.
  { name: "Domaine Drouhin Oregon", city: "Dayton", note: "The Burgundy-Oregon connection made permanent in 1988, when the Drouhin family established its gravity-flow Dundee Hills estate. Domaine Drouhin now describes the site as a 225-acre estate, and the Laurène Pinot Noir remains the benchmark bottling for anyone trying to understand the Burgundian argument for Oregon. Tastings are appointment-only.", category: "winery", lat: 45.26554, lng: -123.05563, website: "https://www.domainedrouhin.com" },
  // Argyle: GPS corrected — tasting room at 691 OR-99W, Dundee OR 97115. Confirmed via Google Maps (45.2772972, -123.0110827). Previous coords (45.2724, -123.1027) were ~10km west of actual location.
  { name: "Argyle Winery", city: "Dundee", note: "Oregon's pioneering sparkling-wine house remains a first-stop Dundee anchor, with a historic Tasting House on 99W, reservations accepted, and walk-ins welcome. The Vintage Brut and Extended Tirage releases are the reason to come; the Pinot Noir and Chardonnay make the case that Argyle is more than bubbles.", category: "winery", lat: 45.27730, lng: -123.01108, website: "https://argylewinery.com" },
  // Sokol Blosser: GPS confirmed via Google Maps (45.2517024, -123.0496769) — Sokol Blosser Lane, Dayton OR 97114. Previous coords (45.2625, -123.0681) were ~1.2km northwest of actual location.
  { name: "Sokol Blosser", city: "Dayton", note: "Sokol Blosser is one of Oregon's founding family wineries, established in 1971 in the Dundee Hills and still operating from a certified organic, B Corp-certified sustainability base. Hours are seasonal — daily March through October and Thursday through Monday in winter — so book or confirm before assuming a drop-in. The Evolution wines are the easy entry; the single-block Pinot Noirs are the terroir argument.", category: "winery", lat: 45.25170, lng: -123.04968, website: "https://www.sokolblosser.com" },
  // Winderlea: GPS corrected — 8905 NE Worden Hill Rd, Dundee OR 97115. Confirmed via Google Maps (45.2790245, -123.0430754). Previous coords (45.2868, -123.0482) were ~1km off.
  { name: "Winderlea Vineyard & Winery", city: "Dundee", note: "Winderlea sits on historic Worden Hill Road in the Dundee Hills, farming old-vine Pinot Noir and Chardonnay from a vineyard first planted in 1974 and a winery founded in 2006. The old founders line needed correction: Winderlea was founded by Bill Sweat and Donna Morris, and in 2026 the Joth Ricci family purchased the winery with an explicit continuity/stewardship message. The estate remains a Demeter-certified biodynamic Dundee Hills visit.", category: "winery", lat: 45.27902, lng: -123.04308, website: "https://www.winderlea.com" },

  // Arterberry Maresh: GPS from audit (45.28102, -123.04968) — Dundee Hills estate, Dundee OR.
  { name: "Arterberry Maresh", city: "Dundee", note: "Four generations of the Maresh family have farmed this Dundee Hills property — the vineyard predates the Oregon wine boom, and the old vines show it. The Arterberry Maresh label produces Pinot Noir and Chardonnay from estate fruit with the restraint and site specificity that the best Dundee Hills land demands. Tasting visits are not a standard walk-in experience; confirm current availability before making the trip.", category: "winery", lat: 45.28102, lng: -123.04968, website: "https://www.mareshvineyardandwinery.com" },

  // ── WINERIES: EOLA-AMITY HILLS ────────────────────────────────────────────
  // Van Duzer wind corridor; mineral, elegant, slower to ripen
  // Cristom Vineyards: GPS confirmed via Google Maps (45.034548, -123.120539) — 6905 Spring Valley Rd NW, Salem OR 97304. Previous coords (44.9996, -123.1454) were ~4.1km south of actual location.
  { name: "Cristom Vineyards", city: "Salem", note: "Paul Gerrie's Eola-Amity Hills estate is a benchmark for whole-cluster, age-worthy Oregon Pinot Noir and Chardonnay. The estate vineyards are Eileen, Jessie, Louise, Marjorie, and Paul Gerrie — corrected from the common misspelling 'Marjolaine' — and they map the wind-cooled, volcanic side of the appellation with uncommon clarity.", category: "winery", lat: 45.03455, lng: -123.12054, website: "https://www.cristomvineyards.com" },
  // Bethel Heights Vineyard: GPS confirmed via Google Maps (45.037171, -123.1526661) — 6060 Bethel Heights Rd NW, Salem OR 97304. Previous coords (44.9905, -123.1299) were ~5.3km south of actual location.
  { name: "Bethel Heights Vineyard", city: "Salem", note: "Ted and Terry Casteel's family estate has shaped the Eola-Amity Hills conversation since 1977. The tasting room is now open daily 11 a.m. to 5 p.m., with reservations recommended and walk-ins welcome, and the draw is still estate Pinot Noir and Chardonnay from one of the appellation's formative sites.", category: "winery", lat: 45.03717, lng: -123.15267, website: "https://www.bethelheights.com" },
  // Witness Tree Vineyard: GPS confirmed via Google Maps (45.0367507, -123.1185135) — Spring Valley Rd NW, Salem OR 97304. Previous coords (44.9935, -123.1398) were ~5km south of actual location.
  { name: "Witness Tree Vineyard", city: "Salem", note: "Named for the Oregon white oak that served as an 1854 survey marker, Witness Tree Vineyard is now best framed as a site-driven Eola-Amity Hills estate focused on Pinot Noir and Chardonnay. The historic tree still anchors the story, but the current wine language is about the vineyard itself: organically farmed blocks, distinctive exposure, and allocation-level bottlings from Spring Valley Road.", category: "winery", lat: 45.03675, lng: -123.11851, website: "https://www.witnesstreevineyard.com" },
  // Evening Land: GPS confirmed via Google Maps (45.0685212, -123.1140426) — Seven Springs Estate, Salem OR 97304. Previous coords (44.9720, -123.1433) were ~11km south of actual location.
  { name: "Evening Land Vineyards", city: "Salem", note: "Evening Land's Seven Springs Vineyard tasting is at the estate on Lone Star Road NW in the Eola-Amity Hills, not a McMinnville tasting room. The historic vineyard anchors taut, mineral Pinot Noir and Chardonnay, with reservations encouraged and walk-in space extremely limited.", category: "winery", lat: 45.06852, lng: -123.11404, website: "https://elvwines.com" },
  // Lingua Franca: GPS from audit (45.07385, -123.09282) — 9675 Hopewell Road NW, Salem OR 97304.
  { name: "Lingua Franca", city: "Salem", note: "Larry Stone and winemaker Thomas Savre's Eola-Amity Hills estate on Hopewell Road applies low-impact organic and biodynamic principles to a set of estate blocks selected to reveal soil variation rather than perform a winemaker style. The Avni Chardonnay and Pape Grande Pinot Noir are serious, restrained, and built for the cellar. Appointment-based tastings.", category: "winery", lat: 45.07385, lng: -123.09282, website: "https://www.linguafranca.wine" },
  // Antica Terra: GPS confirmed via Google Maps (45.1196888, -123.1832316) — winery estate, Amity OR (Eola-Amity Hills AVA). Previous coords (45.1061, -123.1918) were ~1.6km off.
  { name: "Antica Terra", city: "Amity", note: "One of Oregon's most singular wine experiences — part winery, part pilgrimage. A Very Nice Lunch is now part of the property's national reputation: a multi-course, wine-paired afternoon from Antica Terra's culinary team, with the broader program boosted by chef Timothy Wastell's 2025 James Beard Award for Best Chef: Northwest and Pacific. The wines are restrained, precise, and the reservations are a commitment.", category: "winery", lat: 45.11969, lng: -123.18323, website: "https://www.anticaterra.com" },

  // ── WINERIES: CHEHALEM MOUNTAINS ─────────────────────────────────────────
  // Three distinct soil types on one ridge
  // Adelsheim Vineyard: GPS confirmed via Google Maps (45.3385536, -123.0496957) — 16800 NE Calkins Lane, Newberg OR 97132. Previous coords (45.3298, -122.9613) were ~7.5km east of actual location.
  { name: "Adelsheim Vineyard", city: "Newberg", note: "Founded in 1971 by David and Ginny Adelsheim, Adelsheim remains one of Oregon wine's anchor names. The vineyard-side tasting room on NE Calkins Lane in the Chehalem Mountains is the stop for Pinot Noir, Chardonnay, and the long view of how the northern Willamette Valley got here. Book a current tasting experience rather than assuming walk-in hours.", category: "winery", lat: 45.33855, lng: -123.04970, website: "https://www.adelsheim.com" },
  // Bergström Wines: GPS confirmed via Google Maps (45.2788159, -123.0276935) — Ekollon tasting house, Dundee Hills OR. Renamed from Bergström Winery; city updated to Dundee to match tasting experience location.
  { name: "Bergström Wines", city: "Dundee", note: "Josh and Caroline Bergström's family winery is now best understood through private, appointment-based visits at Ekollon, the Dundee Hills tasting house overlooking Bergström Vineyard, rather than a generic drop-in room. The wines remain Pinot Noir and Chardonnay reference points — Silice, Bergström Vineyard, and the Sigrid Chardonnay — from biodynamically farmed estate sites across the valley.", category: "winery", lat: 45.27882, lng: -123.02769, website: "https://www.bergstromwines.com" },
  // Rex Hill: GPS confirmed via Google Maps (45.3145624, -122.9205731) — 30835 N Hwy 99W, Newberg OR 97132. Previous coords (45.3055, -122.9711) were ~5km southwest of actual location.
  { name: "Rex Hill", city: "Newberg", note: "The big red barn on 99W has been a Newberg landmark since 1982. Today's REX HILL tasting room is renovated, open daily for curated experiences, and focused on Willamette Valley Pinot Noir and Chardonnay with a growing culinary program and vineyard-tour options. It is an easy, high-signal stop on any Newberg run.", category: "winery", lat: 45.31456, lng: -122.92057, website: "https://www.rexhill.com" },

  // ── WINERIES: RIBBON RIDGE ────────────────────────────────────────────────
  // Tiny, fog-prone, coveted sub-appellation
  // Beaux Frères: GPS confirmed via Google Maps (45.3474787, -123.0922462) — North Valley Road, Newberg OR 97132. Previous coords (45.3424, -123.0024) were ~8km east of actual location.
  { name: "Beaux Frères", city: "Newberg", note: "Launched from the Ribbon Ridge site planted in 1988, Beaux Frères remains one of Oregon Pinot Noir's defining estates. The visit is by appointment only on North Valley Road, with tastings focused on estate Pinot Noir, Chardonnay, and the second-generation evolution of a cult Oregon name. Book ahead.", category: "winery", lat: 45.34748, lng: -123.09225, website: "https://www.beauxfreres.com" },
  // Brick House Wine Company: GPS confirmed via Google Maps (45.3500968, -123.0701586) — Ribbon Ridge, Newberg OR 97132. Previous coords (45.3485, -122.9979) were ~6km east of actual location.
  { name: "Brick House Wine Company", city: "Newberg", note: "Doug Tunnell's estate on Ribbon Ridge is one of Oregon's most authentic farm-winery operations: organic and Demeter-certified biodynamic, focused on estate Pinot Noir, Chardonnay, and Gamay Noir. Tastings are private/appointment-oriented, and the farm context matters as much as the bottles.", category: "winery", lat: 45.35010, lng: -123.07016, website: "https://www.brickhousewines.com" },
  // Patricia Green Cellars: GPS confirmed via Google Maps (45.3460224, -123.0914729) — Ribbon Ridge, Newberg OR 97132. Previous coords (45.3399, -123.0011) were ~8km east of actual location.
  { name: "Patricia Green Cellars", city: "Newberg", note: "Patricia Green Cellars is a Ribbon Ridge specialist on a 52-acre property devoted to site-specific Pinot Noir, with Chardonnay and Sauvignon Blanc in the mix. Jim Anderson's team continues Patty Green's obsessive vineyard-by-vineyard approach: the tasting is effectively a map of Ribbon Ridge and neighboring Willamette Valley sites.", category: "winery", lat: 45.34602, lng: -123.09147, website: "https://www.patriciagreencellars.com" },
  // Vincent Wine Company: GPS confirmed via Google Maps (45.0952837, -123.1565707). Website updated to vincentwinecompany.com per owner.
  { name: "Vincent Wine Company", city: "Amity", note: "Owner-winemaker Vincent Fritzsche's Amity winery is a small, low-input counterpoint to the prestige tier, focused on Pinot Noir, Chardonnay, Pinot Blanc, Gamay, and a few outlier projects from sustainably farmed sites. Visits are appointment-only; book through the website.", category: "winery", lat: 45.09528, lng: -123.15657, website: "https://vincentwinecompany.com" },

  // ── WINERIES: McMANNVILLE AVA ─────────────────────────────────────────────
  // Volcanic basalt soils; warm, structured
  // Goodfellow Family Cellars: GPS from audit (45.212705, -123.190508) — 888 NE 8th Street, McMinnville OR 97128.
  { name: "Goodfellow Family Cellars", city: "McMinnville", note: "Derek Goodfellow's small working winery in McMinnville focuses on dry-farmed and sustainably farmed vineyard sourcing — site-driven Pinot Noir and Chardonnay without the architecture of a purpose-built tasting room. The wines reflect real relationships with specific vineyards across the valley's most important appellations. Book ahead.", category: "winery", lat: 45.21271, lng: -123.19051, website: "https://www.goodfellowfamilycellars.com" },
  // Eyrie Vineyards: GPS confirmed via Google Maps (45.214049, -123.1878305) — McMinnville tasting room, McMinnville OR 97128. Previous coords (45.2099, -123.1994) were ~1.1km off.
  { name: "Eyrie Vineyards", city: "McMinnville", note: "David and Diana Lett planted the Willamette Valley's first Pinot Noir and Chardonnay in 1965, then established the Dundee Hills site that would define The Eyrie Vineyards. The first Eyrie Pinot Noir vintage came in 1970, and Jason Lett now stewards the same library-minded, elegant style from the McMinnville winery.", category: "winery", lat: 45.21405, lng: -123.18783, website: "https://www.eyrievineyards.com" },
  // Maysara Winery: GPS confirmed via Google Maps (45.1481051, -123.307598) — 15765 SW Muddy Valley Rd, McMinnville OR 97128. Previous Nominatim coords (45.13884, -123.31797) were ~1.3km southwest of actual location.
  { name: "Maysara Winery", city: "McMinnville", note: "Moe and Flora Momtazi bought an abandoned wheat farm in the McMinnville foothills in 1997 and built Maysara and Momtazi Vineyard into one of Oregon's most compelling Demeter-certified biodynamic estates. The official current figure is 532 acres, including about 260 acres of vines, farmed through compost, herbal teas, and low-impact practices. The family story and the farming are inseparable from the wines.", category: "winery", lat: 45.14811, lng: -123.30760, website: "https://www.maysara.com" },
  // Coeur de Terre Vineyard: GPS confirmed via Google Maps (45.1805222, -123.3314922) — 21000 SW Eagle Point Rd, McMinnville OR 97128. Previous Oregon Wine Board coords (45.1779, -123.3305) were ~300m off.
  { name: "Coeur de Terre Vineyard", city: "McMinnville", note: "Hidden in a sheltered McMinnville AVA valley, Coeur de Terre has been Scott and Lisa Neal's organically farmed estate since 1998. Pinot Noir is the core, but the tasting room also makes room for Pinot Gris, dry Riesling, Chardonnay, rosé, and cool-climate Syrah. The drive feels removed from the polished tasting-room loop, and that is the point.", category: "winery", lat: 45.18052, lng: -123.33149, website: "https://www.cdtvineyard.com" },
  // Youngberg Hill Vineyards: GPS confirmed via Google Maps (45.1902563, -123.290696) — 10660 SW Youngberg Hill Rd, McMinnville OR 97128. Previous estimate (45.185, -123.237) was ~4.5km east of actual location.
  { name: "Youngberg Hill Vineyards", city: "McMinnville", note: "Youngberg Hill is a 50-acre hilltop McMinnville estate and inn, founded in 1989, with daily 10 a.m. to 4 p.m. tasting-room hours and broad Coast Range and vineyard views. The appeal is as much the stay as the pour: a nine-room inn, quiet vineyard mornings, and Pinot Noir with structure from elevation and wind exposure.", category: "winery", lat: 45.19026, lng: -123.29070, website: "https://www.youngberghill.com" },

  // ── WINERIES: YAMHILL-CARLTON ─────────────────────────────────────────────
  // Ancient marine sedimentary soils (Willakenzie); warm, structured
  // Penner-Ash Wine Cellars: GPS confirmed via Google Maps (45.3323199, -123.0956794) — Ribbon Ridge Rd, Newberg OR 97132. Previous coords (45.3432, -123.0021) were ~8.6km northeast of actual location.
  { name: "Penner-Ash Wine Cellars", city: "Newberg", note: "Founded in 1998 by Lynn and Ron Penner-Ash, this Ribbon Ridge estate remains one of the valley's most polished viewpoint tastings. The current program pours Willamette Valley Pinot Noir, Chardonnay, Syrah, and Riesling from estate and partner vineyards, with a new Pavilion adding a more private garden-side option.", category: "winery", lat: 45.33232, lng: -123.09568, website: "https://www.pennerash.com" },
  // Carlton Winemakers Studio: GPS confirmed via Google Maps (45.3001986, -123.1825801) — downtown Carlton OR 97111. Previous coords (45.2953, -123.1772) were ~0.6km off.
  { name: "Carlton Winemakers Studio", city: "Carlton", note: "Founded in 2002 by Eric Hamacher, Luisa Ponzi, and Ned and Kristen Lumpkin, The Carlton Winemakers Studio is a collective winery, tasting room, and wine shop built for small producers. The Studio pours rotating flights from 12+ vintners under one roof, making it one of the easiest ways to taste across Willamette Valley styles without leaving Carlton.", category: "winery", lat: 45.30020, lng: -123.18258, website: "https://www.winemakersstudio.com" },
  { name: "Lemelson Vineyards", city: "Carlton", note: "Eric Lemelson's organically farmed estate above Carlton is a restrained, terroir-first Pinot Noir and Chardonnay stop with sweeping Coast Range views. The tasting room is open daily in the main season, with more limited winter hours, so verify the current calendar before driving up. Jerome Reserve remains the flagship.", category: "winery", lat: 45.3020, lng: -123.1315, website: "https://www.lemelsonvineyards.com" },
  // Ken Wright Cellars: GPS confirmed via Google Maps (45.2944564, -123.1768455) — 236 N Kutch St, Carlton OR 97111. Previous coords (45.2958, -123.1793) were ~0.2km off.
  { name: "Ken Wright Cellars", city: "Carlton", note: "Ken Wright's downtown Carlton tasting room sits in the historic 1920s train depot and remains one of the clearest single-vineyard Pinot Noir classrooms in Oregon. Dundee Hills, Chehalem Mountains, Eola-Amity, Yamhill-Carlton — tasted side by side, the bottlings map the valley better than a lecture.", category: "winery", lat: 45.29446, lng: -123.17685, website: "https://www.kenwrightcellars.com" },
  // Big Table Farm Atelier: GPS from audit (45.29370, -123.17676) — 128 S Pine Street, Carlton OR 97111.
  { name: "Big Table Farm Atelier", city: "Carlton", note: "Clare and Brian Marcy run a genuine farm operation at the edge of Carlton — not just a winery but an atelier where regenerative farming, culinary production, and Pinot Noir come from the same land and philosophy. Private seated tastings only, by reservation. The connection between the farm, the kitchen, and the wine is the whole point of the visit.", category: "winery", lat: 45.29370, lng: -123.17676, website: "https://www.bigtablefarm.com/visit" },
  // Résonance: GPS confirmed via Google Maps (45.2907042, -123.2368442) — Carlton tasting room, Carlton OR 97111. Previous coords (45.3079, -123.2341) were ~1.9km north of actual location.
  { name: "Résonance", city: "Carlton", note: "Maison Louis Jadot's Oregon project remains one of the clearest Burgundian votes of confidence in the Willamette Valley. The Carlton tasting room is open daily, and there is also a Dundee Hills tasting room by the Découverte vineyard. For this record, the Carlton estate is the anchor: Pinot Noir and Chardonnay with a French house's patience and Oregon's site expression.", category: "winery", lat: 45.29070, lng: -123.23684, website: "https://resonancewines.com" },

  // ── WINERIES: SOUTHERN VALLEY ─────────────────────────────────────────────
  // King Estate Winery: GPS confirmed via Google Maps (43.8609479, -123.2506801) — 80854 Territorial Hwy, Eugene OR 97405. Previous coords (43.9721, -123.2244) were ~12.4km north of actual location.
  { name: "King Estate Winery", city: "Eugene", note: "King Estate sits at the southern end of the Willamette Valley above Eugene, an integrated estate of vineyard, woodland, wetlands, orchards, berries, and culinary gardens. The old 'largest organic winery' shorthand has been updated: King Estate now describes itself as North America's largest certified Biodynamic vineyard. Pinot Gris remains the signature reference point.", category: "winery", lat: 43.86095, lng: -123.25068, website: "https://www.kingestate.com" },

  // ── RESTAURANTS ───────────────────────────────────────────────────────────
  // Joel Palmer House: GPS corrected — 600 Ferry St, Dayton OR 97114. Confirmed via Google Maps (45.2178825, -123.0795833). Previous coords (45.2236, -123.0654) were ~1.7km northeast of actual location.
  { name: "Joel Palmer House", city: "Dayton", note: "Jack Czarnecki's family built the Joel Palmer House into Oregon wine country's definitive mushroom-and-truffle restaurant, and the Dayton house still revolves around local wild mushrooms, Oregon truffles, Willamette Valley Pinot Noir, and long multi-course meals. It is a pilgrimage stop for anyone who wants the forest side of Oregon on the plate.", category: "restaurant", lat: 45.21788, lng: -123.07958, website: "https://www.joelpalmerhouse.com" },
  // The Bay House: GPS confirmed via Google Maps (45.221651, -123.0768056) — relocated May 2025 to historic church, Dayton OR 97114. Previous coords (45.2215, -123.0671) were ~0.9km east of actual location.
  { name: "The Bay House", city: "Dayton", note: "After 45 years on the Oregon Coast, The Bay House reopened in May 2025 in Dayton inside a restored historic church on the town square. The move brought Steve Wilson and Maureen O'Callaghan's fine-dining hospitality and deep wine-program ambitions into one of the valley's most truffle-rich towns, with Executive Chef Nathan Bates leading the current kitchen. It is unusual, polished, and worth treating as a destination.", category: "restaurant", lat: 45.22165, lng: -123.07681, website: "https://www.thebayhouse.org" },
  // Nick's Italian Café: GPS confirmed via Google Maps (45.210202, -123.194048) — 521 NE 3rd St, McMinnville OR 97128. Previous coords (45.2085, -123.1966) were ~280m off.
  { name: "Nick's Italian Café", city: "McMinnville", note: "The original Willamette Valley wine-country restaurant opened in 1977, earned a James Beard America's Classics award in 2014, closed in 2023, and returned in 2024 under new ownership for a second act. The reopened Nick's keeps the Italian-Pacific Northwest idea alive — handmade pastas, Oregon and Italian wines, cocktails, and the Backroom spirit that made it a McMinnville landmark.", category: "restaurant", lat: 45.21020, lng: -123.19405, website: "https://www.nicksitaliancafe.com" },
  // Red Hills Market: GPS corrected — 155 SW 7th St (on OR-99W), Dundee OR 97115. Confirmed via Google Maps (45.2780631, -123.0117864). Previous coords (45.2718, -123.1009) were ~10km west of actual location.
  { name: "Red Hills Market", city: "Dundee", note: "The essential daytime stop in Dundee, now squarely a neighborhood wine-country market: wood-fired pizzas, farm-fresh salads, sandwiches, breakfast plates, cookies, pantry goods, and a bottle-shop feel right on 99W. This is the easy stop before tastings, between appointments, or when you need one good casual meal that understands where it is.", category: "restaurant", lat: 45.27806, lng: -123.01179, website: "https://www.redhillsmarket.com" },
  // Thistle Restaurant: GPS confirmed via Google Maps (45.20953, -123.194251) — McMinnville OR 97128. Website updated to thistleisrad.com per current listing.
  { name: "Thistle Restaurant", city: "McMinnville", note: "Thistle's current identity is a neighborhood wine-country bar and restaurant in a historic Evans Street space: signature cocktails, small plates, dinner, and Oregon produce without over-explaining itself. Open Tuesday through Saturday evenings, it remains the quieter, more local-feeling McMinnville dinner move when you want substance over spectacle.", category: "restaurant", lat: 45.20953, lng: -123.19425, website: "https://thistleisrad.com" },
  // The Painted Lady: GPS confirmed via Google Maps (45.2993261, -122.9730206) — 201 S College St, Newberg OR 97132. Previous coords (45.3017, -122.9722) were ~270m north.
  { name: "The Painted Lady", city: "Newberg", note: "Oregon wine country's most decorated fine-dining destination: the Newberg Victorian house remains Oregon's only Forbes Four-Star and AAA Four-Diamond dining experience, with a seasonal tasting menu rooted in local ranchers, farmers, vintners, and Oregon ingredients. Reservations required; plan ahead.", category: "restaurant", lat: 45.29933, lng: -122.97302, website: "https://www.thepaintedladyrestaurant.com" },
  { name: "Hayward", city: "Carlton", note: "Chef Kari Shaughnessy's restaurant moved from McMinnville's Mac Market into a standalone Carlton home in 2025, carrying its James Beard momentum with it: Best New Restaurant finalist in 2024 and Best Chef: Northwest semifinalist in 2025. The cooking remains hyper-seasonal, low-waste, and producer-driven, with the room now feeling more like a hosted house party than a wine-country showroom.", category: "restaurant", lat: 45.2946, lng: -123.1788, website: "https://www.haywardrestaurant.com" },
  // Okta: GPS confirmed via Google Maps (45.2098181, -123.1928826) — McMinnville OR 97128. Renamed to ōkta farm and kitchen after closure/reopening May 2025.
  { name: "ōkta farm and kitchen", city: "McMinnville", note: "Tributary Hotel's restaurant closed in its original ōkta form in September 2024 and reopened in May 2025 as ōkta farm and kitchen under a new team. The current format is a seasonal four-course tasting menu led by chef Christine Smith, shaped by ōkta farm, local seafood, pasture, pantry work, and the surrounding valley. Treat old 10-course/Lightner-era writeups as historical context, not the current visit.", category: "restaurant", lat: 45.20982, lng: -123.19288, website: "https://www.tributaryhotel.com/dining" },
  // Bistro Maison: GPS confirmed via Google Maps (45.2102712, -123.1914662) — 729 E 3rd St, McMinnville OR 97128. Previous coords (45.2092, -123.1899) were ~180m off.
  { name: "Bistro Maison", city: "McMinnville", note: "McMinnville's long-running French bistro in a Victorian house on NE 3rd Street. The appeal is still the classic wine-country rhythm: warm hospitality, French comfort cooking, a garden-patio mood when the weather allows, and a menu built for lunch that turns into a long afternoon or dinner that does not hurry you out.", category: "restaurant", lat: 45.21027, lng: -123.19147, website: "https://www.bistromaison.com" },
  // Good Company: GPS confirmed via Google Maps (45.3000684, -122.973807) — 602 E 1st St Suite A, Newberg OR 97132. Renamed to Good Company Cheese & Wine Shop to reflect current business identity.
  { name: "Good Company Cheese & Wine Shop", city: "Newberg", note: "A serious cheese-and-wine shop in Newberg that has intentionally simplified from its earlier full bar/bistro format to focus on what it does best: cut-to-order cheese, charcuterie, small plates, accompaniments, and good bottles. Small room, professional cheesemonger, no performance of attitude — an ideal post-tasting stop or picnic-provisioning stop.", category: "restaurant", lat: 45.30007, lng: -122.97381, website: "https://www.goodcompanycheese.com" },
  // Word of Mouth Bistro: GPS verified — 140 17th St NE, Salem OR 97301 (OSM Nominatim)
  { name: "Word of Mouth Bistro", city: "Salem", note: "Salem's beloved breakfast-and-lunch room in a converted house on 17th Street NE. The hours are limited, the wait is part of the experience, and the menu leans big-hearted: hashes, Benedicts, biscuits, scones, coffee, and daily specials. Closed Tuesdays; weekend service starts early.", category: "restaurant", lat: 44.9357, lng: -123.0198, website: "https://www.ilovewom.com" },
  // La Rambla: GPS verified — 238 NE 3rd St, McMinnville OR 97128 (OSM Nominatim)
  { name: "La Rambla", city: "McMinnville", note: "The Spanish-influenced tapas room in McMinnville's historic Schilling Building remains one of downtown's reliable dinner anchors: patatas bravas, paella, jamón, gambas, cocktails, and a wine list that has earned Wine Spectator Award of Excellence recognition for years. The patio fills fast in warm weather; the food works with or without a winery visit beforehand.", category: "restaurant", lat: 45.2097, lng: -123.1971, website: "https://www.laramblaonthird.com" },
  // Abuela's Nuestra Cocina: GPS confirmed via Google Maps (45.2098134, -123.1973748) — McMinnville OR 97128. Previous coords (45.2095, -123.18632) were ~860m east of actual location.
  { name: "Abuela's Nuestra Cocina", city: "McMinnville", note: "The Fernandez family brought their grandmother's kitchen to 226 NE 3rd Street in downtown McMinnville: tacos, burritos, bowls, breakfast sandwiches, and home-style Mexican cooking built around family recipes rather than wine-country gloss. It is exactly the kind of honest downtown lunch or harvest-season meal that keeps McMinnville feeling like a working valley town.", category: "restaurant", lat: 45.20981, lng: -123.19737, website: "https://www.abuelasnuestracocina.com" },
  // Alchemist's Jam: GPS verified — 207 NE Ford St, McMinnville OR 97128 (OSM Nominatim: 45.20945, -123.19342)
  { name: "Alchemist's Jam", city: "McMinnville", note: "A small-batch jam shop, bakery, and coffee spot at 207 NE Ford Street, open Thursday through Sunday from 8 a.m. to 2 p.m. The best move is still early: sourdough, pastries, cinnamon rolls, espresso drinks, and jams made with local fruit tend to disappear, and the shop explicitly does not take bakery holds or special orders. Plan like it will sell out.", category: "restaurant", lat: 45.20945, lng: -123.19342, website: "https://www.alchemistsjam.com" },
  // Carlton Corners: GPS verified — 150 N Yamhill St, Carlton OR 97111 (OSM Nominatim: 45.29469, -123.17972)
  { name: "Carlton Corners", city: "Carlton", note: "Technically a gas station; practically a Carlton institution. The corner stop combines fuel, a diner-grill menu, a growler room, and ten rotating local and regional beer/cider taps. It is the unpolished room where winemakers, vineyard crews, farmhands, and visitors overlap after long days — burgers, sandwiches, pints, and a useful antidote to over-curated wine-country polish.", category: "restaurant", lat: 45.29469, lng: -123.17972, website: "https://www.carltoncorners.com" },
  // Block 15 Brewing: GPS verified — 300 SW Jefferson Ave, Corvallis OR 97333 (OSM Nominatim)
  { name: "Block 15 Brewing", city: "Corvallis", note: "Corvallis's anchor craft brewery and downtown pub, serving locally sourced Pacific Northwest pub food with serious beer. Founded in 2008, Block 15 has grown beyond the original pub, but the Jefferson Avenue room remains the place where OSU people, farmers, brewers, and serious drinkers cross paths over fresh beer and a kitchen that pulls its weight.", category: "restaurant", lat: 44.5622, lng: -123.2622, website: "https://www.block15.com" },
  // Alea Bakery and Cafe: GPS from audit (45.21419, -123.18983) — 1140 NE Alpine Avenue, McMinnville OR 97128.
  { name: "Alea Bakery and Cafe", city: "McMinnville", note: "A slow-fermentation bakery and hyper-seasonal cafe inside McMinnville's Market at Granary District — croissants, sourdoughs, seasonal pastries, and a daytime menu built around direct relationships with local growers. The bread program is the anchor; the produce sourcing is what elevates it beyond a standard bakery stop. Open daily for breakfast and lunch; special dinners by reservation.", category: "restaurant", lat: 45.21419, lng: -123.18983, website: "https://www.aleabakery.com" },
  // Grounded Table: GPS from audit (45.21013, -123.19535) — 411 NE 3rd Street, McMinnville OR 97128. Related to The Ground farm ecosystem (Carlton/Yamhill).
  { name: "Grounded Table", city: "McMinnville", note: "The restaurant arm of The Ground's farm ecosystem, at 411 NE 3rd Street in downtown McMinnville. The menu is driven by regenerative farm sourcing, Carlton-grown vegetables, and a seasonal rhythm that reflects what the surrounding valley is actually producing — a direct line from the farm to the plate rather than a loosely sourced wine-country menu.", category: "restaurant", lat: 45.21013, lng: -123.19535, website: "https://www.theground.love/food/grounded-table" },
  // JORY Restaurant: GPS from audit (45.31966, -122.94631) — 2525 Allison Lane, Newberg OR 97132 (The Allison Inn).
  { name: "JORY Restaurant", city: "Newberg", note: "The Allison Inn's restaurant earns its place on this map through what happens before service: a 1.5-acre chef garden on the property, hand-harvested daily, with the menu built around what is ready rather than what is predictable. Local ranchers, farmers, and vintners form the supply network, and the wine pairing program reflects serious engagement with the surrounding appellations. The setting is a resort; the sourcing is not.", category: "restaurant", lat: 45.31966, lng: -122.94631, website: "https://theallison.com/jory" },

  // ── FARMSTANDS & FARMS ────────────────────────────────────────────────────
  // Durant at Red Ridge Farms: GPS confirmed via Google Maps (45.2562252, -123.0582614) — 5510 NE Breyman Orchards Rd, Dayton OR 97114. Renamed from Red Ridge Farms — Oregon Olive Mill to current Durant brand.
  { name: "Durant at Red Ridge Farms — Oregon Olive Mill", city: "Dayton", note: "The Durant family's Dundee Hills farm is the home of Durant Olive Mill, founded in 2008 and now centered around olive-oil tastings, tours, a Farm Shop, nursery, vineyards, lavender, and pantry goods. Durant is Oregon-milled and estate-milled, with a 15-acre olive grove producing Arbequina, Arbosana, and Koroneiki oils alongside Durant Vineyards wines and local pantry goods.", category: "farmstand", lat: 45.25623, lng: -123.05826, website: "https://www.redridgefarms.com" },
  // Gathering Together Farm: GPS confirmed via Google Maps (44.5313349, -123.3728643) — 25159 Grange Hall Road, Philomath OR 97370. Previous coords (44.5398, -123.3695) were ~1km north of actual farm location.
  { name: "Gathering Together Farm", city: "Philomath", note: "A certified organic farm outside Philomath, founded in 1987, with a farmstand, restaurant, CSA, and farmers-market presence. The farm grows roughly 40 crops in about 100 varieties across more than 67 acres, so the range is still the point: vegetables, fruit, pantry staples, and a kitchen that cooks directly from the fields.", category: "farmstand", lat: 44.53133, lng: -123.37286, website: "https://www.gatheringtogetherfarm.com" },
  // Groundwork Organics: GPS confirmed via Google Maps (44.1426553, -123.1504508) — farm stand, Junction City OR 97448. Website added per current public listing.
  { name: "Groundwork Organics", city: "Junction City", note: "Certified organic farm north of Eugene growing fruits, vegetables, and cut flowers since 2000. The restored-dairy-barn FarmStand at 91360 River Road in Junction City is the visitor-facing stop, open seasonally Thursday through Sunday, with produce, flowers, fresh cheese, honey, and other local goods. You will also see them at farmers markets around the region.", category: "farmstand", lat: 44.14266, lng: -123.15045, website: "https://www.groundworkorganics.com" },
  // Blue Raeven Farmstand: GPS confirmed via Google Maps (45.1103815, -123.2077323) — 20650 S Highway 99W, Amity OR 97101. Previous estimate (45.098, -123.207) was ~1.4km south of actual location.
  { name: "Blue Raeven Farmstand", city: "Amity", note: "Third-generation family farm and roadside farmstand on Hwy 99W in Amity, best known for fruit pies, jams, jellies, and syrups made from Oregon berries and orchard fruit. The farm grows blueberries, marionberries, blackberries, strawberries, apples, peaches, and more, and the stand is currently open seven days a week. When you're driving between wineries and the pies are warm, stop.", category: "farmstand", lat: 45.11038, lng: -123.20773, website: "https://www.blueraevenfarmstand.com" },
  // The Ground Market: GPS at 15713 Highway 47, Yamhill OR 97148. Website updated to theground.love per current listing.
  { name: "The Ground Market", city: "Yamhill", note: "The Ground Market at 15713 Highway 47 is the retail home for The Ground's farm ecosystem and the Source Farms/Tabula Rasa Farms food program. Shop grass-fed beef and lamb, pastured pork and poultry, sustainable seafood, eggs, produce, and seasonal pantry goods. Current posted farmstand hours vary by channel but cluster around Thursday through Tuesday service, so confirm before making a special trip.", category: "farmstand", lat: 45.330, lng: -123.184, website: "https://www.theground.love" },
  // E.Z. Orchards Farm Market: GPS from audit (45.00467, -122.95001) — 5504 Hazel Green Road NE, Salem OR 97305.
  { name: "E.Z. Orchards Farm Market", city: "Salem", note: "The Egger family has been farming this Salem-area property since 1924, on ancient Willamette Valley seabed soil that produces distinctive heirloom apples, pears, and cider fruit. The farm market carries fresh and processed orchard goods, and the cider-apple program reflects genuine varietal selection for flavor rather than yield. One of the most historically rooted farm operations in the mid-valley.", category: "farmstand", lat: 45.00467, lng: -122.95001, website: "https://www.ezorchards.com" },
  // Draper Farms: GPS corrected via audit to (45.22654, -123.22923) — 11105 SW Baker Creek Road, McMinnville OR 97128.
  { name: "Draper Farms", city: "McMinnville", note: "A four-generation Baker Creek Road farm and CSA growing more than 200 varieties of fruits and vegetables with natural, sustainable practices and a particular love for rare and heirloom seed. It is the practical farm stop closest to downtown McMinnville: sweet corn, berries, tomatoes, winter squash, flowers, and whatever the season is doing well that week.", category: "farmstand", lat: 45.22654, lng: -123.22923, website: "https://www.drapersfarm.com" },

  // ── ARTISAN PRODUCERS ─────────────────────────────────────────────────────
  // Ochoa's Queseria: GPS confirmed via Google Maps (44.638761, -123.095661) — Albany OR 97321. Previous coords (44.6369, -123.1050) were ~860m west of actual location.
  { name: "Ochoa's Queseria", city: "Albany", note: "Family-run Albany cheese shop known for queso fresco, string cheese, and other fresh Mexican-style cheeses. The draw is freshness and production scale you do not expect tucked into downtown Albany: stop during daytime shop hours for the widest selection, and call ahead if you are hoping to watch production or order in bulk.", category: "artisan", lat: 44.63876, lng: -123.09566, website: null },
  // Don Froylan Creamery: GPS from audit (44.96924, -123.00616) — 3310 Portland Road NE, Salem OR 97301.
  { name: "Don Froylan Creamery", city: "Salem", note: "Francisco Ochoa's Salem creamery is built around hand-stretched, Oaxaca-style fresh cheese — quesillo, panela, crema — made daily from local milk with the kind of visible production and family labor that the valley's best artisan stops reward. Walk in during shop hours to see it happening.", category: "artisan", lat: 44.96924, lng: -123.00616, website: "https://donfroylancremeria.com" },
  // Camas Country Mill: GPS confirmed via Google Maps (44.1189331, -123.1772974) — Junction City OR 97448. Previous coords (44.1582, -123.2304) were ~6.5km northeast of actual location.
  { name: "Camas Country Mill", city: "Junction City", note: "When Tom and Sue Hunton opened Camas Country Mill in 2011, they brought local grain milling back to the Willamette Valley after nearly eighty years. The public-facing Schoolhouse Bakery & Store on Purkerson Road sells stone-milled flours, grains, breads, pastries, and pantry goods made from wheat, rye, spelt, einkorn, and other grains grown on Hunton's farm and regional partner farms. It is infrastructure disguised as a charming country mill.", category: "artisan", lat: 44.11893, lng: -123.17730, website: "https://www.camascountrymill.com" },
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
