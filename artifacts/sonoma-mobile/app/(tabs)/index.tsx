import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  Linking,
  useWindowDimensions,
} from "react-native";
import MapView, { Marker, LongPressEvent } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useIsTablet } from "@/hooks/useIsTablet";
import {
  useGetMarkers,
  useCreateMarker,
  getGetMarkersQueryKey,
  getGetMarkerStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Marker as MarkerType } from "@workspace/api-client-react";

type Category = "winery" | "restaurant" | "farmstand";
type MapFilter = "all" | Category;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const CATEGORY_LABELS: Record<Category, string> = {
  winery: "Wineries",
  restaurant: "Dining",
  farmstand: "Farms",
};

const CATEGORY_ICON_MAP: Record<Category, IoniconsName> = {
  winery: "wine",
  restaurant: "restaurant",
  farmstand: "leaf",
};

const MAP_FILTERS: { key: MapFilter; label: string; icon: IoniconsName }[] = [
  { key: "all", label: "All", icon: "map-outline" },
  { key: "winery", label: "Wineries", icon: "wine-outline" },
  { key: "restaurant", label: "Dining", icon: "restaurant-outline" },
  { key: "farmstand", label: "Farms", icon: "leaf-outline" },
];

function getCategoryColor(category: Category, colors: ReturnType<typeof useColors>) {
  if (category === "winery") return colors.wineRed;
  if (category === "restaurant") return colors.accent;
  return colors.farmGreen;
}

function getCategoryIcon(category: Category): IoniconsName {
  return CATEGORY_ICON_MAP[category] ?? "location";
}

// ── Spot detail: phone modal ──────────────────────────────────────────────────
interface SpotSheetProps {
  spot: MarkerType | null;
  onClose: () => void;
}

function SpotDetailModal({ spot, onClose }: SpotSheetProps) {
  const colors = useColors();
  if (!spot) return null;

  const catColor = getCategoryColor(spot.category as Category, colors);
  const catIcon = getCategoryIcon(spot.category as Category);
  const catLabel = spot.category === "winery" ? "Winery" : spot.category === "restaurant" ? "Dining" : "Farm";

  return (
    <Modal
      visible={!!spot}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor + "20" }]}>
            <Ionicons name={catIcon} size={14} color={catColor} />
            <Text style={[styles.categoryLabel, { color: catColor }]}>{catLabel}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.spotName, { color: colors.foreground }]}>{spot.name}</Text>

        {spot.note ? (
          <Text style={[styles.spotNote, { color: colors.mutedForeground }]}>{spot.note}</Text>
        ) : null}

        {spot.website ? (
          <TouchableOpacity
            style={[styles.websiteBtn, { borderColor: colors.primary }]}
            onPress={() => Linking.openURL(spot.website!)}
            testID="website-link"
          >
            <Ionicons name="globe-outline" size={16} color={colors.primary} />
            <Text style={[styles.websiteBtnText, { color: colors.primary }]}>Visit Website</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

// ── Spot detail: tablet inline panel ─────────────────────────────────────────
function SpotDetailPanel({ spot, onClose }: SpotSheetProps) {
  const colors = useColors();
  if (!spot) return null;

  const catColor = getCategoryColor(spot.category as Category, colors);
  const catIcon = getCategoryIcon(spot.category as Category);
  const catLabel = spot.category === "winery" ? "Winery" : spot.category === "restaurant" ? "Dining" : "Farm";

  return (
    <View style={[styles.tabletPanel, { backgroundColor: colors.card, borderLeftColor: colors.border }]}>
      <View style={styles.sheetHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + "20" }]}>
          <Ionicons name={catIcon} size={14} color={catColor} />
          <Text style={[styles.categoryLabel, { color: catColor }]}>{catLabel}</Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="close-panel">
          <Ionicons name="close" size={22} color={colors.mutedForeground} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.spotName, { color: colors.foreground }]}>{spot.name}</Text>

      {spot.note ? (
        <ScrollView style={styles.panelNoteScroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.spotNote, { color: colors.mutedForeground }]}>{spot.note}</Text>
        </ScrollView>
      ) : null}

      {spot.website ? (
        <TouchableOpacity
          style={[styles.websiteBtn, { borderColor: colors.primary }]}
          onPress={() => Linking.openURL(spot.website!)}
          testID="website-link"
        >
          <Ionicons name="globe-outline" size={16} color={colors.primary} />
          <Text style={[styles.websiteBtnText, { color: colors.primary }]}>Visit Website</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Add-spot sheet ────────────────────────────────────────────────────────────
interface AddSpotSheetProps {
  coordinate: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onSave: (data: { name: string; note: string; category: Category }) => void;
  saving: boolean;
}

function AddSpotSheet({ coordinate, onClose, onSave, saving }: AddSpotSheetProps) {
  const colors = useColors();
  const isTablet = useIsTablet();
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<Category>("winery");

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter a name for this spot.");
      return;
    }
    onSave({ name: name.trim(), note: note.trim(), category });
  };

  if (!coordinate) return null;

  return (
    <Modal
      visible={!!coordinate}
      animationType="slide"
      presentationStyle={isTablet ? "formSheet" : "pageSheet"}
      onRequestClose={onClose}
    >
      <ScrollView
        style={[styles.sheetContainer, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={isTablet ? styles.sheetContentTablet : undefined}
      >
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
        <View style={styles.sheetHeader}>
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Mark This Spot</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Name</Text>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          placeholder="e.g. Scribe Winery"
          placeholderTextColor={colors.mutedForeground}
          value={name}
          onChangeText={setName}
          autoFocus
          testID="spot-name-input"
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
        <TextInput
          style={[styles.textInput, styles.textArea, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
          placeholder="What made it worth stopping?"
          placeholderTextColor={colors.mutedForeground}
          value={note}
          onChangeText={setNote}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
        <View style={styles.categoryRow}>
          {(["winery", "restaurant", "farmstand"] as Category[]).map((cat) => {
            const catColor = getCategoryColor(cat, colors);
            const selected = category === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: selected ? catColor : colors.card,
                    borderColor: selected ? catColor : colors.border,
                  },
                ]}
                onPress={() => setCategory(cat)}
                testID={`category-${cat}`}
              >
                <Ionicons
                  name={getCategoryIcon(cat)}
                  size={16}
                  color={selected ? colors.primaryForeground : catColor}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: selected ? colors.primaryForeground : colors.foreground },
                  ]}
                >
                  {CATEGORY_LABELS[cat]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: colors.primary, opacity: saving || !name.trim() ? 0.5 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving || !name.trim()}
          testID="save-spot-btn"
        >
          {saving ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={[styles.saveBtnText, { color: colors.primaryForeground }]}>Save Spot</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </Modal>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────
interface MapFilterBarProps {
  active: MapFilter;
  onSelect: (f: MapFilter) => void;
  counts: Record<MapFilter, number>;
  colors: ReturnType<typeof useColors>;
  isTablet: boolean;
}

function MapFilterBar({ active, onSelect, counts, colors, isTablet }: MapFilterBarProps) {
  const pills = MAP_FILTERS.map((f) => {
    const isActive = active === f.key;
    const cnt = counts[f.key];
    return (
      <TouchableOpacity
        key={f.key}
        style={[
          styles.filterPill,
          {
            backgroundColor: isActive ? colors.primary : colors.card,
            borderColor: isActive ? colors.primary : colors.border,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.12,
            shadowRadius: 6,
            elevation: 3,
          },
        ]}
        onPress={() => {
          Haptics.selectionAsync();
          onSelect(f.key);
        }}
        testID={`map-filter-${f.key}`}
      >
        <Ionicons
          name={f.icon}
          size={13}
          color={isActive ? colors.primaryForeground : colors.mutedForeground}
        />
        <Text style={[styles.filterPillText, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
          {f.label}
        </Text>
        {cnt > 0 && (
          <View style={[styles.filterPillCount, { backgroundColor: isActive ? "rgba(255,255,255,0.25)" : colors.muted }]}>
            <Text style={[styles.filterPillCountText, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
              {cnt}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  });

  if (isTablet) {
    return (
      <View style={styles.filterBarTablet}>
        {pills}
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterBarContent}
      style={styles.filterBarScroll}
    >
      {pills}
    </ScrollView>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isTablet = useIsTablet();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();

  const { data: markers = [], isLoading } = useGetMarkers();
  const createMarker = useCreateMarker();

  const [selectedSpot, setSelectedSpot] = useState<MarkerType | null>(null);
  const [addCoord, setAddCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");

  const filteredMarkers = mapFilter === "all"
    ? markers
    : markers.filter((m) => m.category === mapFilter);

  const counts: Record<MapFilter, number> = {
    all: markers.length,
    winery: markers.filter((m) => m.category === "winery").length,
    restaurant: markers.filter((m) => m.category === "restaurant").length,
    farmstand: markers.filter((m) => m.category === "farmstand").length,
  };

  const handleMarkerPress = useCallback((marker: MarkerType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSpot(marker);
  }, []);

  const handleLongPress = useCallback((e: LongPressEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAddCoord(e.nativeEvent.coordinate);
  }, []);

  const handleSaveSpot = useCallback(
    (data: { name: string; note: string; category: Category }) => {
      if (!addCoord) return;
      createMarker.mutate(
        {
          data: {
            name: data.name,
            note: data.note,
            category: data.category,
            lat: addCoord.latitude,
            lng: addCoord.longitude,
          },
        },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            queryClient.invalidateQueries({ queryKey: getGetMarkersQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetMarkerStatsQueryKey() });
            setAddCoord(null);
          },
          onError: () => {
            Alert.alert("Error", "Failed to save spot. Please try again.");
          },
        }
      );
    },
    [addCoord, createMarker, queryClient]
  );

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 84 : insets.bottom;

  // Tablet panel width
  const PANEL_WIDTH = Math.min(360, width * 0.35);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]} testID="map-screen">
        <View style={[styles.webHeader, { paddingTop: topInset + 12, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.webHeaderRow}>
            <Ionicons name="map" size={20} color={colors.primary} />
            <Text style={[styles.webHeaderTitle, { color: colors.foreground }]}>Sonoma Map</Text>
            <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.countBadgeText, { color: colors.primaryForeground }]}>
                {filteredMarkers.length}
              </Text>
            </View>
          </View>
          <View style={styles.webFilterRow}>
            {MAP_FILTERS.map((f) => {
              const isActive = mapFilter === f.key;
              const cnt = counts[f.key];
              return (
                <TouchableOpacity
                  key={f.key}
                  style={[
                    styles.filterPill,
                    {
                      backgroundColor: isActive ? colors.primary : colors.background,
                      borderColor: isActive ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setMapFilter(f.key)}
                  testID={`map-filter-${f.key}`}
                >
                  <Ionicons
                    name={f.icon}
                    size={13}
                    color={isActive ? colors.primaryForeground : colors.mutedForeground}
                  />
                  <Text style={[styles.filterPillText, { color: isActive ? colors.primaryForeground : colors.foreground }]}>
                    {f.label}
                  </Text>
                  {cnt > 0 && (
                    <View style={[styles.filterPillCount, { backgroundColor: isActive ? "rgba(255,255,255,0.25)" : colors.muted }]}>
                      <Text style={[styles.filterPillCountText, { color: isActive ? colors.primaryForeground : colors.mutedForeground }]}>
                        {cnt}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        <View style={styles.webFallback}>
          <Ionicons name="map-outline" size={48} color={colors.border} />
          <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>Interactive Map</Text>
          <Text style={[styles.webFallbackText, { color: colors.mutedForeground }]}>
            {filteredMarkers.length} spot{filteredMarkers.length !== 1 ? "s" : ""} visible
          </Text>
          <Text style={[styles.webFallbackSub, { color: colors.mutedForeground }]}>
            Scan the QR code in Expo Go on your iPhone to use the full map
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="map-screen">
      {/* Map fills the full screen */}
      <MapView
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: 38.5,
          longitude: -122.8,
          latitudeDelta: 0.4,
          longitudeDelta: 0.4,
        }}
        onLongPress={handleLongPress}
        showsUserLocation
        showsCompass={false}
        testID="map-view"
      >
        {filteredMarkers.map((marker) => {
          const cat = marker.category as Category;
          const catColor = getCategoryColor(cat, colors);
          const catIcon = getCategoryIcon(cat);
          return (
            <Marker
              key={marker.id}
              coordinate={{ latitude: marker.lat, longitude: marker.lng }}
              onPress={() => handleMarkerPress(marker)}
              testID={`marker-${marker.id}`}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View style={styles.markerContainer}>
                <View style={[styles.markerBubble, { backgroundColor: catColor }]}>
                  <Ionicons name={catIcon} size={14} color="#fff" />
                </View>
                <View style={[styles.markerTail, { borderTopColor: catColor }]} />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {isLoading && (
        <View style={[styles.loadingOverlay, { top: topInset + 8 }]}>
          <View style={[styles.loadingPill, { backgroundColor: colors.card }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading spots…</Text>
          </View>
        </View>
      )}

      {/* Header pill — left on phone, centered-left on tablet */}
      <View style={[styles.headerPill, { top: topInset + 8, backgroundColor: colors.card }]}>
        <Ionicons name="map" size={16} color={colors.primary} />
        <Text style={[styles.headerPillText, { color: colors.foreground }]}>Sonoma</Text>
        <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
          <Text style={[styles.countBadgeText, { color: colors.primaryForeground }]}>
            {filteredMarkers.length}
          </Text>
        </View>
      </View>

      {/* Filter bar */}
      <View style={[
        styles.filterBarWrapper,
        { top: topInset + 56 },
        isTablet && styles.filterBarWrapperTablet,
      ]}>
        <MapFilterBar
          active={mapFilter}
          onSelect={setMapFilter}
          counts={counts}
          colors={colors}
          isTablet={isTablet}
        />
      </View>

      {/* Hint — only on phone (tablet users are more exploratory) */}
      {!isTablet && (
        <View style={[styles.hintBanner, { bottom: bottomInset + 8 }]}>
          <View style={[styles.hintPill, { backgroundColor: colors.card + "E8" }]}>
            <Ionicons name="hand-right-outline" size={13} color={colors.mutedForeground} />
            <Text style={[styles.hintText, { color: colors.mutedForeground }]}>Long press to add a spot</Text>
          </View>
        </View>
      )}

      {/* Spot detail: inline panel on tablet, modal on phone */}
      {isTablet ? (
        selectedSpot ? (
          <View style={[styles.tabletPanelWrapper, { width: PANEL_WIDTH, top: topInset, bottom: bottomInset }]}>
            <SpotDetailPanel spot={selectedSpot} onClose={() => setSelectedSpot(null)} />
          </View>
        ) : null
      ) : (
        <SpotDetailModal
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
        />
      )}

      <AddSpotSheet
        coordinate={addCoord}
        onClose={() => setAddCoord(null)}
        onSave={handleSaveSpot}
        saving={createMarker.isPending}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // ── Web fallback ────────────────────────────────────────────────────────────
  webHeader: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  webHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  webHeaderTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    flex: 1,
  },
  webFilterRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 40,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    marginTop: 12,
  },
  webFallbackText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  webFallbackSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
  },
  // ── Loading ─────────────────────────────────────────────────────────────────
  loadingOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  loadingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  // ── Header pill ──────────────────────────────────────────────────────────────
  headerPill: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  headerPillText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  countBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  // ── Filter bar ──────────────────────────────────────────────────────────────
  filterBarWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterBarWrapperTablet: {
    alignItems: "center",
  },
  filterBarScroll: {
    flexGrow: 0,
  },
  filterBarContent: {
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  filterBarTablet: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
    paddingHorizontal: 20,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1.5,
  },
  filterPillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  filterPillCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  filterPillCountText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  // ── Hint ────────────────────────────────────────────────────────────────────
  hintBanner: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
  },
  hintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  // ── Map markers ──────────────────────────────────────────────────────────────
  markerContainer: {
    alignItems: "center",
  },
  markerBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  // ── Spot detail sheet (phone modal) ─────────────────────────────────────────
  sheetContainer: {
    flex: 1,
    padding: 20,
  },
  sheetContentTablet: {
    maxWidth: 560,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 32,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  categoryLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  spotName: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    marginBottom: 10,
    lineHeight: 28,
  },
  spotNote: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 23,
    marginBottom: 20,
  },
  websiteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    alignSelf: "flex-start",
  },
  websiteBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  // ── Add spot sheet ───────────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
    marginTop: 16,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    height: 100,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  categoryChipText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  saveBtn: {
    marginTop: 28,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  // ── Tablet inline panel ──────────────────────────────────────────────────────
  tabletPanelWrapper: {
    position: "absolute",
    right: 0,
    zIndex: 20,
  },
  tabletPanel: {
    flex: 1,
    padding: 24,
    borderLeftWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  panelNoteScroll: {
    flex: 1,
    marginBottom: 16,
  },
});
