import React, { useState, useCallback, useRef, useEffect } from "react";
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
  Share,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MapView, { Marker, LongPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { useIsTablet } from "@/hooks/useIsTablet";
import {
  useGetMarkers,
  useGetMarkerStats,
  useCreateMarker,
  useDeleteMarker,
  getGetMarkersQueryKey,
  getGetMarkerStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Marker as MarkerType } from "@workspace/api-client-react";

type Category = "winery" | "restaurant" | "farmstand" | "producer";
type MapFilter = "all" | Category;

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const CATEGORY_LABELS: Record<Category, string> = {
  winery: "Wineries",
  restaurant: "Dining",
  farmstand: "Farms",
  producer: "Artisan",
};

const CATEGORY_ICON_MAP: Record<Category, IoniconsName> = {
  winery: "wine",
  restaurant: "restaurant",
  farmstand: "leaf",
  producer: "storefront",
};

const MAP_FILTERS: { key: MapFilter; label: string; icon: IoniconsName }[] = [
  { key: "all", label: "All", icon: "map-outline" },
  { key: "winery", label: "Wineries", icon: "wine-outline" },
  { key: "restaurant", label: "Dining", icon: "restaurant-outline" },
  { key: "farmstand", label: "Farms", icon: "leaf-outline" },
  { key: "producer", label: "Artisan", icon: "storefront-outline" },
];

function getCategoryColor(category: Category, colors: ReturnType<typeof useColors>) {
  if (category === "winery") return colors.wineRed;
  if (category === "restaurant") return colors.accent;
  if (category === "producer") return colors.goldAccent;
  return colors.farmGreen;
}

function getCategoryIcon(category: Category): IoniconsName {
  return CATEGORY_ICON_MAP[category] ?? "location";
}

// ── My List (AsyncStorage) ────────────────────────────────────────────────────
const MY_LIST_KEY = "willamette-my-list-mobile";

interface SavedSpot {
  id: number;
  name: string;
  category: string;
}

function useMobileMyList() {
  const [saved, setSaved] = useState<Map<number, SavedSpot>>(new Map());

  useEffect(() => {
    AsyncStorage.getItem(MY_LIST_KEY).then((raw) => {
      if (!raw) return;
      try {
        const arr: SavedSpot[] = JSON.parse(raw);
        setSaved(new Map(arr.map((s) => [s.id, s])));
      } catch {}
    });
  }, []);

  const persist = (next: Map<number, SavedSpot>) => {
    AsyncStorage.setItem(MY_LIST_KEY, JSON.stringify([...next.values()]));
  };

  const toggle = useCallback((spot: SavedSpot) => {
    setSaved((prev) => {
      const next = new Map(prev);
      if (next.has(spot.id)) next.delete(spot.id);
      else next.set(spot.id, spot);
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: number) => {
    setSaved((prev) => {
      const next = new Map(prev);
      next.delete(id);
      persist(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSaved(new Map());
    AsyncStorage.removeItem(MY_LIST_KEY);
  }, []);

  const isSaved = useCallback((id: number) => saved.has(id), [saved]);

  return { saved, toggle, remove, clearAll, isSaved };
}

// ── Spot detail: phone modal ──────────────────────────────────────────────────
interface SpotSheetProps {
  spot: MarkerType | null;
  onClose: () => void;
  onToggleSave: (spot: SavedSpot) => void;
  isSaved: (id: number) => boolean;
  onDelete: (id: number) => void;
  isDeleting: boolean;
}

function buildShareMessage(spot: MarkerType) {
  const catLabel = spot.category === "winery" ? "Winery" : spot.category === "restaurant" ? "Dining" : spot.category === "producer" ? "Artisan" : "Farm Stand";
  const parts: string[] = [
    `${spot.name} — ${catLabel} in Willamette Valley`,
    "",
  ];
  if (spot.note) parts.push(spot.note, "");
  if (spot.website) parts.push(spot.website);
  parts.push("", "Shared via the Valley Chef app");
  return parts.join("\n");
}

function SpotDetailModal({ spot, onClose, onToggleSave, isSaved, onDelete, isDeleting }: SpotSheetProps) {
  const colors = useColors();
  if (!spot) return null;

  const catColor = getCategoryColor(spot.category as Category, colors);
  const catIcon = getCategoryIcon(spot.category as Category);
  const catLabel = spot.category === "winery" ? "Winery" : spot.category === "restaurant" ? "Dining" : spot.category === "producer" ? "Artisan" : "Farm";
  const saved = isSaved(spot.id);

  const handleShare = async () => {
    try {
      await Haptics.selectionAsync();
      await Share.share({ message: buildShareMessage(spot) });
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove spot",
      `Remove "${spot.name}" from the map?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDelete(spot.id),
        },
      ]
    );
  };

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
          <View style={styles.sheetHeaderActions}>
            <TouchableOpacity
              onPress={() => onToggleSave({ id: spot.id, name: spot.name, category: spot.category })}
              style={styles.closeBtn}
              testID="save-btn"
            >
              <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={saved ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleShare} style={styles.closeBtn} testID="share-btn">
              <Ionicons name="share-outline" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
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

        <TouchableOpacity
          style={[styles.deleteBtn, { borderColor: colors.border }]}
          onPress={handleDelete}
          disabled={isDeleting}
          testID="delete-btn"
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <Ionicons name="trash-outline" size={16} color={colors.destructive} />
          )}
          <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Remove spot</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ── Spot detail: tablet inline panel ─────────────────────────────────────────
function SpotDetailPanel({ spot, onClose, onToggleSave, isSaved, onDelete, isDeleting }: SpotSheetProps) {
  const colors = useColors();
  if (!spot) return null;

  const catColor = getCategoryColor(spot.category as Category, colors);
  const catIcon = getCategoryIcon(spot.category as Category);
  const catLabel = spot.category === "winery" ? "Winery" : spot.category === "restaurant" ? "Dining" : spot.category === "producer" ? "Artisan" : "Farm";
  const saved = isSaved(spot.id);

  const handleShare = async () => {
    try {
      await Haptics.selectionAsync();
      await Share.share({ message: buildShareMessage(spot) });
    } catch {}
  };

  const handleDelete = () => {
    Alert.alert(
      "Remove spot",
      `Remove "${spot.name}" from the map?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => onDelete(spot.id),
        },
      ]
    );
  };

  return (
    <View style={[styles.tabletPanel, { backgroundColor: colors.card, borderLeftColor: colors.border }]}>
      <View style={styles.sheetHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: catColor + "20" }]}>
          <Ionicons name={catIcon} size={14} color={catColor} />
          <Text style={[styles.categoryLabel, { color: catColor }]}>{catLabel}</Text>
        </View>
        <View style={styles.sheetHeaderActions}>
          <TouchableOpacity
            onPress={() => onToggleSave({ id: spot.id, name: spot.name, category: spot.category })}
            style={styles.closeBtn}
            testID="save-btn"
          >
            <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={22} color={saved ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleShare} style={styles.closeBtn} testID="share-btn">
            <Ionicons name="share-outline" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} testID="close-panel">
            <Ionicons name="close" size={22} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
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

      <TouchableOpacity
        style={[styles.deleteBtn, { borderColor: colors.border }]}
        onPress={handleDelete}
        disabled={isDeleting}
        testID="delete-btn"
      >
        {isDeleting ? (
          <ActivityIndicator size="small" color={colors.destructive} />
        ) : (
          <Ionicons name="trash-outline" size={16} color={colors.destructive} />
        )}
        <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>Remove spot</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Welcome splash modal ──────────────────────────────────────────────────────
const WELCOME_KEY = "willamette-welcome-seen-mobile";

const PIN_LEGEND = [
  {
    category: "winery" as Category,
    label: "Wineries",
    description: "Curated estates and tasting rooms",
  },
  {
    category: "restaurant" as Category,
    label: "Restaurants & Bars",
    description: "Chef-vetted tables worth the drive",
  },
  {
    category: "farmstand" as Category,
    label: "Farm Stands & Markets",
    description: "Farms, roadside stands, and markets behind the best tables",
  },
  {
    category: "producer" as Category,
    label: "Artisan Producers",
    description: "Makers of cider, spirits, cheese, and more",
  },
];

function WelcomeSplashModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { data: stats } = useGetMarkerStats();

  const total = stats?.total ?? "—";
  const wineries = stats?.wineries ?? "—";
  const restaurants = stats?.restaurants ?? "—";
  const farmstands = stats?.farmstands ?? "—";
  const producers = stats?.producers ?? "—";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.welcomeOverlay}>
        <View style={[styles.welcomeCard, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={[styles.welcomeHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.welcomeCloseBtn} testID="welcome-close">
              <Ionicons name="close" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
            <Text style={[styles.welcomeEyebrow, { color: colors.mutedForeground }]}>
              A CHEF'S GUIDE
            </Text>
            <Text style={[styles.welcomeTitle, { color: colors.foreground }]}>
              Willamette Valley
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.mutedForeground }]}>
              {total} personally curated spots — {wineries} wineries, {restaurants} restaurants, {farmstands} farm stands, and {producers} artisan producers (creameries, cideries, spirits, and more) — verified by a professional chef who actually goes to all of them.
            </Text>
          </View>

          {/* Pin legend */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeSectionLabel, { color: colors.mutedForeground }]}>MAP KEY</Text>
            {PIN_LEGEND.map(({ category, label, description }) => {
              const catColor = getCategoryColor(category, colors);
              const catIcon = getCategoryIcon(category);
              return (
                <View key={category} style={styles.welcomeLegendRow}>
                  <View style={[styles.welcomeLegendDot, { backgroundColor: catColor }]}>
                    <Ionicons name={catIcon} size={13} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.welcomeLegendLabel, { color: colors.foreground }]}>{label}</Text>
                    <Text style={[styles.welcomeLegendDesc, { color: colors.mutedForeground }]}>{description}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Tips */}
          <View style={[styles.welcomeTipsBox, { backgroundColor: colors.muted + "80" }]}>
            <Text style={[styles.welcomeTip, { color: colors.mutedForeground }]}>
              <Text style={[styles.welcomeTipBold, { color: colors.foreground }]}>Tap any pin</Text>
              {" "}to read the chef's notes and visit the website.
            </Text>
            <Text style={[styles.welcomeTip, { color: colors.mutedForeground }]}>
              <Text style={[styles.welcomeTipBold, { color: colors.foreground }]}>Ask the Chef</Text>
              {" "}— an AI that knows this map inside out.
            </Text>
            <Text style={[styles.welcomeTip, { color: colors.mutedForeground }]}>
              <Text style={[styles.welcomeTipBold, { color: colors.foreground }]}>Near Me</Text>
              {" "}to find spots closest to where you are right now.
            </Text>
            <Text style={[styles.welcomeTip, { color: colors.mutedForeground }]}>
              <Text style={[styles.welcomeTipBold, { color: colors.foreground }]}>Bookmark spots</Text>
              {" "}to build your personal list for the day.
            </Text>
          </View>

          {/* CTA */}
          <TouchableOpacity
            style={[styles.welcomeBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
            testID="welcome-start"
          >
            <Text style={[styles.welcomeBtnText, { color: colors.primaryForeground }]}>Start Exploring</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
          {(["winery", "restaurant", "farmstand", "producer"] as Category[]).map((cat) => {
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
  const deleteMarkerMutation = useDeleteMarker();

  const { saved: myListSaved, toggle: toggleSave, isSaved, remove: removeFromList, clearAll: clearMyList } = useMobileMyList();

  const mapRef = useRef<MapView>(null);
  const [locationLoading, setLocationLoading] = useState(false);

  const [selectedSpot, setSelectedSpot] = useState<MarkerType | null>(null);
  const [addCoord, setAddCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapFilter, setMapFilter] = useState<MapFilter>("all");
  const [showMyList, setShowMyList] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(WELCOME_KEY).then((v) => {
      if (!v) setShowWelcome(true);
    });
  }, []);

  const handleCloseWelcome = useCallback(() => {
    setShowWelcome(false);
    AsyncStorage.setItem(WELCOME_KEY, "1");
  }, []);

  const filteredMarkers = mapFilter === "all"
    ? markers
    : markers.filter((m) => m.category === mapFilter);

  const counts: Record<MapFilter, number> = {
    all: markers.length,
    winery: markers.filter((m) => m.category === "winery").length,
    restaurant: markers.filter((m) => m.category === "restaurant").length,
    farmstand: markers.filter((m) => m.category === "farmstand").length,
    producer: markers.filter((m) => m.category === "producer").length,
  };

  const handleMarkerPress = useCallback((marker: MarkerType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedSpot(marker);
  }, []);

  const handleLongPress = useCallback((e: LongPressEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setAddCoord(e.nativeEvent.coordinate);
  }, []);

  const handleDelete = useCallback((id: number) => {
    deleteMarkerMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMarkersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMarkerStatsQueryKey() });
          removeFromList(id);
          setSelectedSpot(null);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: () => {
          Alert.alert("Could not remove spot", "Something went wrong. Please try again.");
        },
      }
    );
  }, [deleteMarkerMutation, queryClient, removeFromList]);

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

  const handleNearMe = useCallback(async () => {
    try {
      setLocationLoading(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location access needed",
          "Enable location in Settings to find spots near you.",
          [{ text: "OK" }]
        );
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.06,
          longitudeDelta: 0.06,
        },
        800
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Location error", "Couldn't get your location. Please try again.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

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
            <Text style={[styles.webHeaderTitle, { color: colors.foreground }]}>Willamette Valley</Text>
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
        ref={mapRef}
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
        <Text style={[styles.headerPillText, { color: colors.foreground }]}>Valley</Text>
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

      {/* ? Help button — bottom right, above My List button */}
      <TouchableOpacity
        style={[
          styles.helpBtn,
          {
            bottom: bottomInset + (isTablet ? 120 : 160),
            right: 16,
            backgroundColor: colors.card,
            shadowColor: "#000",
          },
        ]}
        onPress={() => setShowWelcome(true)}
        testID="help-btn"
      >
        <Text style={[styles.helpBtnText, { color: colors.mutedForeground }]}>?</Text>
      </TouchableOpacity>

      {/* My List button — bottom right, floating above Near Me / GPS button */}
      <TouchableOpacity
        style={[
          styles.myListBtn,
          {
            bottom: bottomInset + (isTablet ? 72 : 112),
            backgroundColor: colors.card,
            shadowColor: "#000",
          },
        ]}
        onPress={() => setShowMyList(true)}
        testID="my-list-btn"
      >
        <Ionicons
          name={myListSaved.size > 0 ? "bookmark" : "bookmark-outline"}
          size={18}
          color={myListSaved.size > 0 ? colors.primary : colors.mutedForeground}
        />
        {myListSaved.size > 0 && (
          <View style={[styles.myListBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.myListBadgeText, { color: colors.primaryForeground }]}>
              {myListSaved.size}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* My List modal */}
      <Modal
        visible={showMyList}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowMyList(false)}
      >
        <View style={[styles.sheetContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="bookmark" size={18} color={colors.primary} />
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>My List</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              {myListSaved.size > 0 && (
                <TouchableOpacity
                  style={[styles.closeBtn, { marginRight: 4 }]}
                  onPress={() => { clearMyList(); }}
                  testID="clear-my-list"
                >
                  <Text style={{ color: colors.destructive, fontSize: 13 }}>Clear all</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowMyList(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
          </View>

          {myListSaved.size === 0 ? (
            <View style={styles.myListEmpty}>
              <Ionicons name="bookmark-outline" size={40} color={colors.border} />
              <Text style={[styles.myListEmptyTitle, { color: colors.foreground }]}>No saved spots yet</Text>
              <Text style={[styles.myListEmptyText, { color: colors.mutedForeground }]}>
                Tap the bookmark icon on any spot to save it here.
              </Text>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
              {[...myListSaved.values()].map((s) => {
                const catColor = getCategoryColor(s.category as Category, colors);
                const catIcon = getCategoryIcon(s.category as Category);
                const catLabel = s.category === "winery" ? "Winery" : s.category === "restaurant" ? "Dining" : s.category === "producer" ? "Artisan" : "Farm";
                return (
                  <View
                    key={s.id}
                    style={[styles.myListItem, { borderBottomColor: colors.border }]}
                  >
                    <View style={[styles.myListItemIcon, { backgroundColor: catColor + "20" }]}>
                      <Ionicons name={catIcon} size={16} color={catColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.myListItemName, { color: colors.foreground }]}>{s.name}</Text>
                      <Text style={[styles.myListItemCat, { color: catColor }]}>{catLabel}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => removeFromList(s.id)}
                      style={styles.closeBtn}
                      testID={`remove-saved-${s.id}`}
                    >
                      <Ionicons name="bookmark" size={20} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Near Me button — bottom right */}
      <TouchableOpacity
        style={[
          styles.nearMeBtn,
          {
            bottom: bottomInset + (isTablet ? 20 : 60),
            right: 16,
            backgroundColor: colors.card,
            shadowColor: "#000",
          },
        ]}
        onPress={handleNearMe}
        disabled={locationLoading}
        testID="near-me-btn"
      >
        {locationLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="locate" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>

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
            <SpotDetailPanel
              spot={selectedSpot}
              onClose={() => setSelectedSpot(null)}
              onToggleSave={toggleSave}
              isSaved={isSaved}
              onDelete={handleDelete}
              isDeleting={deleteMarkerMutation.isPending}
            />
          </View>
        ) : null
      ) : (
        <SpotDetailModal
          spot={selectedSpot}
          onClose={() => setSelectedSpot(null)}
          onToggleSave={toggleSave}
          isSaved={isSaved}
          onDelete={handleDelete}
          isDeleting={deleteMarkerMutation.isPending}
        />
      )}

      <AddSpotSheet
        coordinate={addCoord}
        onClose={() => setAddCoord(null)}
        onSave={handleSaveSpot}
        saving={createMarker.isPending}
      />

      <WelcomeSplashModal visible={showWelcome} onClose={handleCloseWelcome} />
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
  // ── Near Me button ───────────────────────────────────────────────────────────
  nearMeBtn: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  // ── Sheet header actions ─────────────────────────────────────────────────────
  sheetHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  // ── Delete button ─────────────────────────────────────────────────────────────
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: "center",
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
  // ── My List button (top-right, filter bar row) ────────────────────────────────
  myListBtn: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  myListBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  myListBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  // ── My List modal content ─────────────────────────────────────────────────────
  myListEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  myListEmptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
  },
  myListEmptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  myListItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  myListItemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  myListItemName: {
    fontSize: 15,
    fontWeight: "500",
  },
  myListItemCat: {
    fontSize: 12,
    marginTop: 2,
  },
  // ── ? Help button ─────────────────────────────────────────────────────────────
  helpBtn: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  helpBtnText: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  // ── Welcome splash modal ──────────────────────────────────────────────────────
  welcomeOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  welcomeCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  welcomeHeader: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  welcomeCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  welcomeTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  welcomeSection: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 4,
    gap: 12,
  },
  welcomeSectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  welcomeLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  welcomeLegendDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  welcomeLegendLabel: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 17,
  },
  welcomeLegendDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  welcomeTipsBox: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
  },
  welcomeTip: {
    fontSize: 12,
    lineHeight: 18,
  },
  welcomeTipBold: {
    fontWeight: "600",
  },
  welcomeBtn: {
    margin: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeBtnText: {
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
});
