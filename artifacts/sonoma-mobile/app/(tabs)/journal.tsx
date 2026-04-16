import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useIsTablet } from "@/hooks/useIsTablet";
import { useGetMarkers, useGetMarkerStats } from "@workspace/api-client-react";
import type { Marker } from "@workspace/api-client-react";

type FilterType = "all" | "winery" | "restaurant" | "farmstand";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const FILTERS: { key: FilterType; label: string; icon: IoniconsName }[] = [
  { key: "all", label: "All", icon: "map-outline" },
  { key: "winery", label: "Wineries", icon: "wine-outline" },
  { key: "restaurant", label: "Dining", icon: "restaurant-outline" },
  { key: "farmstand", label: "Farms", icon: "leaf-outline" },
];

// Regional latitude boundaries for Willamette Valley
// North  ≥ 45.32: Chehalem Mountains, Ribbon Ridge, Portland metro
// Central 45.10–45.32: Dundee Hills, Yamhill-Carlton, McMinnville AVA
// South  < 45.10: Eola-Amity Hills, Salem, Eugene, southern valley
const REGIONS = [
  { key: "north", label: "North", fullLabel: "North Valley" },
  { key: "central", label: "Central", fullLabel: "Central Valley" },
  { key: "south", label: "South", fullLabel: "South Valley" },
] as const;

type RegionKey = typeof REGIONS[number]["key"];

function getRegion(lat: number): RegionKey {
  if (lat >= 45.32) return "north";
  if (lat >= 45.10) return "central";
  return "south";
}

function getCategoryColor(category: string, colors: ReturnType<typeof useColors>) {
  if (category === "winery") return colors.wineRed;
  if (category === "restaurant") return colors.accent;
  return colors.farmGreen;
}

function getCategoryBg(category: string, colors: ReturnType<typeof useColors>) {
  if (category === "winery") return colors.wineRedLight;
  if (category === "restaurant") return colors.goldLight;
  return colors.farmGreenLight;
}

function getCategoryLabel(category: string) {
  if (category === "winery") return "Winery";
  if (category === "restaurant") return "Dining";
  if (category === "farmstand") return "Farm";
  return category;
}

const CATEGORY_ICON_MAP: Record<string, IoniconsName> = {
  winery: "wine",
  restaurant: "restaurant",
  farmstand: "leaf",
};

function getCategoryIcon(category: string): IoniconsName {
  return CATEGORY_ICON_MAP[category] ?? "location";
}

interface SpotRowProps {
  item: Marker;
  isTablet?: boolean;
}

function SpotRow({ item, isTablet }: SpotRowProps) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);
  const catColor = getCategoryColor(item.category, colors);
  const catBg = getCategoryBg(item.category, colors);
  const catLabel = getCategoryLabel(item.category);
  const catIcon = getCategoryIcon(item.category);
  const hasMore = item.note && item.note.length > 80;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={() => (hasMore || item.website) ? setExpanded((v) => !v) : null}
      style={[
        styles.spotRow,
        { backgroundColor: colors.card, borderColor: expanded ? catColor : colors.border },
        isTablet && styles.spotRowTablet,
      ]}
    >
      <View style={[styles.spotIcon, { backgroundColor: catBg }, isTablet && styles.spotIconTablet]}>
        <Ionicons name={catIcon} size={isTablet ? 22 : 18} color={catColor} />
      </View>
      <View style={styles.spotInfo}>
        <Text style={[styles.spotName, { color: colors.foreground }, isTablet && styles.spotNameTablet]}>
          {item.name}
        </Text>
        {item.city ? (
          <Text style={[styles.cityLabel, { color: catColor }]}>
            {item.city}
          </Text>
        ) : null}
        {item.note ? (
          <Text
            style={[styles.spotNote, { color: colors.mutedForeground }, isTablet && styles.spotNoteTablet]}
            numberOfLines={expanded ? undefined : (isTablet ? 3 : 2)}
          >
            {item.note}
          </Text>
        ) : null}
        {(expanded || !hasMore) && item.website ? (
          <TouchableOpacity
            style={styles.inlineWebsiteLink}
            onPress={(e) => {
              e.stopPropagation?.();
              Linking.openURL(item.website!);
            }}
          >
            <Ionicons name="globe-outline" size={13} color={catColor} />
            <Text style={[styles.inlineWebsiteLinkText, { color: catColor }]}>Visit Website</Text>
          </TouchableOpacity>
        ) : null}
        {hasMore && (
          <Text style={[styles.expandHint, { color: catColor }]}>
            {expanded ? "Show less" : "Read more"}
          </Text>
        )}
      </View>
      <View style={[styles.catBadge, { backgroundColor: catBg }]}>
        <Text style={[styles.catBadgeText, { color: catColor }]}>{catLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title, count, colors }: { title: string; count: number; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      <View style={[styles.sectionCount, { backgroundColor: colors.muted }]}>
        <Text style={[styles.sectionCountText, { color: colors.mutedForeground }]}>{count}</Text>
      </View>
    </View>
  );
}

// ── Sidebar (tablet only) ────────────────────────────────────────────────────
interface SidebarProps {
  activeFilter: FilterType;
  onFilter: (f: FilterType) => void;
  getCount: (f: FilterType) => number;
  sections: { key: string; data: Marker[] }[];
  regionCounts: Record<RegionKey, number>;
  onJumpToRegion: (r: RegionKey) => void;
  colors: ReturnType<typeof useColors>;
  topInset: number;
}

function TabletSidebar({
  activeFilter, onFilter, getCount, sections, regionCounts, onJumpToRegion, colors, topInset,
}: SidebarProps) {
  return (
    <View style={[styles.sidebar, { paddingTop: topInset + 12, backgroundColor: colors.card, borderRightColor: colors.border }]}>
      <Text style={[styles.headerTitle, { color: colors.foreground }]}>Journal</Text>
      <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
        The places worth knowing
      </Text>

      <Text style={[styles.sidebarSectionLabel, { color: colors.mutedForeground }]}>CATEGORY</Text>
      <View style={styles.sidebarFilters}>
        {FILTERS.map((f) => {
          const active = f.key === activeFilter;
          const cnt = getCount(f.key);
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.sidebarFilterBtn,
                {
                  backgroundColor: active ? colors.primary + "18" : "transparent",
                  borderColor: active ? colors.primary : "transparent",
                },
              ]}
              onPress={() => onFilter(f.key)}
              testID={`filter-${f.key}`}
            >
              <Ionicons
                name={f.icon}
                size={16}
                color={active ? colors.primary : colors.mutedForeground}
              />
              <Text style={[styles.sidebarFilterLabel, { color: active ? colors.primary : colors.foreground }]}>
                {f.label}
              </Text>
              <View style={[styles.filterCount, { backgroundColor: active ? colors.primary + "22" : colors.muted }]}>
                <Text style={[styles.filterCountText, { color: active ? colors.primary : colors.mutedForeground }]}>
                  {cnt}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {sections.length > 0 && (
        <>
          <Text style={[styles.sidebarSectionLabel, { color: colors.mutedForeground, marginTop: 20 }]}>JUMP TO</Text>
          <View style={styles.sidebarRegions}>
            {REGIONS.map((r) => {
              const cnt = regionCounts[r.key];
              if (cnt === 0) return null;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.sidebarRegionBtn, { borderColor: colors.border }]}
                  onPress={() => onJumpToRegion(r.key)}
                  testID={`region-jump-${r.key}`}
                >
                  <Ionicons name="location-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.sidebarRegionLabel, { color: colors.foreground }]}>{r.fullLabel}</Text>
                  <View style={[styles.regionBtnCount, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.regionBtnCountText, { color: colors.mutedForeground }]}>{cnt}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isTablet = useIsTablet();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const scrollRef = useRef<ScrollView>(null);
  const sectionYRef = useRef<Record<string, number>>({});

  const { data: markers = [], isLoading } = useGetMarkers();
  const { data: stats } = useGetMarkerStats();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : insets.bottom;

  const getCount = (filter: FilterType) => {
    if (!stats) return 0;
    if (filter === "all") return stats.total;
    if (filter === "winery") return stats.wineries;
    if (filter === "restaurant") return stats.restaurants;
    if (filter === "farmstand") return stats.farmstands;
    return 0;
  };

  const sections = useMemo(() => {
    const filtered = activeFilter === "all"
      ? markers
      : markers.filter((m) => m.category === activeFilter);

    const byRegion: Record<RegionKey, Marker[]> = { north: [], central: [], south: [] };
    for (const m of filtered) {
      byRegion[getRegion(m.lat)].push(m);
    }

    return REGIONS
      .map((r) => ({
        key: r.key,
        title: r.fullLabel,
        data: byRegion[r.key].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((s) => s.data.length > 0);
  }, [markers, activeFilter]);

  const totalVisible = sections.reduce((sum, s) => sum + s.data.length, 0);

  const jumpToRegion = useCallback((regionKey: RegionKey) => {
    const y = sectionYRef.current[regionKey];
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y, animated: true });
    }
  }, []);

  const regionCounts: Record<RegionKey, number> = useMemo(() => {
    const counts: Record<RegionKey, number> = { north: 0, central: 0, south: 0 };
    for (const s of sections) {
      counts[s.key as RegionKey] = s.data.length;
    }
    return counts;
  }, [sections]);

  const listContent = isLoading ? (
    <View style={styles.center}>
      <ActivityIndicator color={colors.primary} size="large" />
      <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading journal…</Text>
    </View>
  ) : totalVisible === 0 ? (
    <View style={styles.center}>
      <Ionicons name="map-outline" size={40} color={colors.border} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No spots yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        Long press the map to add your first spot
      </Text>
    </View>
  ) : (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: bottomInset + 16 },
        isTablet && styles.listContentTablet,
      ]}
      showsVerticalScrollIndicator={false}
      testID="journal-list"
      keyboardShouldPersistTaps="handled"
    >
      {sections.map((section, sectionIdx) => (
        <View
          key={section.key}
          onLayout={(e) => {
            sectionYRef.current[section.key] = e.nativeEvent.layout.y;
          }}
        >
          <SectionHeader
            title={section.title}
            count={section.data.length}
            colors={colors}
          />
          {section.data.map((item, itemIdx) => (
            <React.Fragment key={item.id}>
              <SpotRow item={item} isTablet={isTablet} />
              {itemIdx < section.data.length - 1 && (
                <View style={{ height: isTablet ? 12 : 10 }} />
              )}
            </React.Fragment>
          ))}
          {sectionIdx < sections.length - 1 && <View style={{ height: 4 }} />}
        </View>
      ))}
    </ScrollView>
  );

  // ── Tablet: two-column layout ──────────────────────────────────────────────
  if (isTablet) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} testID="journal-screen">
        <View style={styles.tabletLayout}>
          <TabletSidebar
            activeFilter={activeFilter}
            onFilter={setActiveFilter}
            getCount={getCount}
            sections={sections}
            regionCounts={regionCounts}
            onJumpToRegion={jumpToRegion}
            colors={colors}
            topInset={topInset}
          />
          <View style={styles.tabletContent}>
            {listContent}
          </View>
        </View>
      </View>
    );
  }

  // ── Phone: single-column layout ───────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="journal-screen">
      <View style={[styles.header, { paddingTop: topInset + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Journal</Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
          The places worth knowing
        </Text>

        <View style={styles.filtersRow}>
          {FILTERS.map((f) => {
            const active = f.key === activeFilter;
            const cnt = getCount(f.key);
            return (
              <TouchableOpacity
                key={f.key}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: active ? colors.primary : colors.background,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveFilter(f.key)}
                testID={`filter-${f.key}`}
              >
                <Ionicons
                  name={f.icon}
                  size={14}
                  color={active ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text style={[styles.filterLabel, { color: active ? colors.primaryForeground : colors.foreground }]}>
                  {f.label}
                </Text>
                {cnt > 0 && (
                  <View style={[styles.filterCount, { backgroundColor: active ? "rgba(255,255,255,0.25)" : colors.muted }]}>
                    <Text style={[styles.filterCountText, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {cnt}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {!isLoading && totalVisible > 0 && (
          <View style={[styles.regionBar, { borderTopColor: colors.border }]}>
            {REGIONS.map((r) => {
              const cnt = regionCounts[r.key];
              if (cnt === 0) return null;
              return (
                <TouchableOpacity
                  key={r.key}
                  style={[styles.regionBtn, { borderColor: colors.border }]}
                  onPress={() => jumpToRegion(r.key)}
                  testID={`region-jump-${r.key}`}
                >
                  <Text style={[styles.regionBtnLabel, { color: colors.foreground }]}>{r.label}</Text>
                  <View style={[styles.regionBtnCount, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.regionBtnCountText, { color: colors.mutedForeground }]}>{cnt}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      {listContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Phone header ─────────────────────────────────────────────────────────────
  header: {
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 14,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filterLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  filterCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  regionBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    marginTop: 4,
  },
  regionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
  },
  regionBtnLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  regionBtnCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  regionBtnCountText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  // ── Tablet layout ────────────────────────────────────────────────────────────
  tabletLayout: {
    flex: 1,
    flexDirection: "row",
  },
  sidebar: {
    width: 260,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderRightWidth: 1,
  },
  sidebarSectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
  sidebarFilters: {
    gap: 2,
  },
  sidebarFilterBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  sidebarFilterLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  sidebarRegions: {
    gap: 2,
  },
  sidebarRegionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
  },
  sidebarRegionLabel: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  tabletContent: {
    flex: 1,
  },
  // ── Section headers ──────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  sectionCount: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  sectionCountText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  // ── List ─────────────────────────────────────────────────────────────────────
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  listContentTablet: {
    paddingHorizontal: 20,
  },
  // ── Spot rows ────────────────────────────────────────────────────────────────
  spotRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  spotRowTablet: {
    padding: 18,
    gap: 16,
    borderRadius: 16,
  },
  spotIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  spotIconTablet: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  spotInfo: {
    flex: 1,
    gap: 4,
  },
  spotName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 20,
  },
  spotNameTablet: {
    fontSize: 16,
    lineHeight: 22,
  },
  cityLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: -1,
    marginBottom: 1,
  },
  spotNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
  },
  spotNoteTablet: {
    fontSize: 14,
    lineHeight: 21,
  },
  inlineWebsiteLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  inlineWebsiteLinkText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  expandHint: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 4,
  },
  catBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexShrink: 0,
  },
  catBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  // ── Empty / loading ──────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 40,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
});
