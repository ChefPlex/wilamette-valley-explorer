import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
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

function SpotRow({ item }: { item: Marker }) {
  const colors = useColors();
  const catColor = getCategoryColor(item.category, colors);
  const catBg = getCategoryBg(item.category, colors);
  const catLabel = getCategoryLabel(item.category);
  const catIcon = getCategoryIcon(item.category);

  return (
    <View style={[styles.spotRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.spotIcon, { backgroundColor: catBg }]}>
        <Ionicons name={catIcon} size={18} color={catColor} />
      </View>
      <View style={styles.spotInfo}>
        <Text style={[styles.spotName, { color: colors.foreground }]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.note ? (
          <Text style={[styles.spotNote, { color: colors.mutedForeground }]} numberOfLines={2}>
            {item.note}
          </Text>
        ) : null}
      </View>
      <View style={[styles.catBadge, { backgroundColor: catBg }]}>
        <Text style={[styles.catBadgeText, { color: catColor }]}>{catLabel}</Text>
      </View>
    </View>
  );
}

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const { data: markers = [], isLoading } = useGetMarkers();
  const { data: stats } = useGetMarkerStats();

  const filteredMarkers = markers
    .filter((m) => activeFilter === "all" || m.category === activeFilter)
    .sort((a, b) => a.name.localeCompare(b.name));

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="journal-screen">
      <View style={[styles.header, { paddingTop: topInset + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>Journal</Text>
        <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
          The places worth knowing
        </Text>

        <ScrollableFilters
          filters={FILTERS}
          activeFilter={activeFilter}
          onSelect={setActiveFilter}
          getCount={getCount}
          colors={colors}
        />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading journal…</Text>
        </View>
      ) : filteredMarkers.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={40} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No spots yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Long press the map to add your first spot
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredMarkers}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => <SpotRow item={item} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: bottomInset + 16 },
          ]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={filteredMarkers.length > 0}
          testID="journal-list"
        />
      )}
    </View>
  );
}

interface ScrollableFiltersProps {
  filters: { key: FilterType; label: string; icon: IoniconsName }[];
  activeFilter: FilterType;
  onSelect: (f: FilterType) => void;
  getCount: (f: FilterType) => number;
  colors: ReturnType<typeof useColors>;
}

function ScrollableFilters({ filters, activeFilter, onSelect, getCount, colors }: ScrollableFiltersProps) {
  return (
    <View style={styles.filtersRow}>
      {filters.map((f) => {
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
            onPress={() => onSelect(f.key)}
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  spotRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  spotIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
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
  spotNote: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
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
