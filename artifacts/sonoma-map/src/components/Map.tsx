import { useState, useCallback } from "react";
import type { SavedSpot } from "@/hooks/useMyList";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { 
  useGetMarkers, 
  useCreateMarker, 
  useDeleteMarker, 
  getGetMarkersQueryKey, 
  getGetMarkerStatsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2, MapPin, Wine, Utensils, Leaf, ExternalLink, Bookmark, Store } from "lucide-react";
import { format } from "date-fns";

// Fix Leaflet default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Create custom icons
const createCustomIcon = (type: "winery" | "restaurant" | "farmstand" | "producer" | string) => {
  const bgColor = type === "winery" ? "bg-primary" 
    : type === "farmstand" ? "bg-[#6f7d3c]"
    : type === "producer" ? "bg-[#c06a2d]"
    : "bg-secondary";
  const iconSvg = type === "winery"
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>`
    : type === "farmstand"
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`
    : type === "producer"
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>`;
    
  return new L.DivIcon({
    html: `<div class="${bgColor} text-white p-2 rounded-full shadow-md border-2 border-white flex items-center justify-center transition-transform hover:scale-110">${iconSvg}</div>`,
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });
};

const defaultIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

interface MapEventsProps {
  onMapClick: (latlng: L.LatLng) => void;
}

function MapEventsComponent({ onMapClick }: MapEventsProps) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng);
    },
  });
  return null;
}

interface MapComponentProps {
  activeFilter: string;
  onToggleSave: (spot: SavedSpot) => void;
  isSaved: (id: number) => boolean;
}

export function MapComponent({ activeFilter, onToggleSave, isSaved }: MapComponentProps) {
  const queryClient = useQueryClient();
  const { data: markers = [], isLoading } = useGetMarkers({
    query: { queryKey: getGetMarkersQueryKey() }
  });
  
  const createMarker = useCreateMarker();
  const deleteMarker = useDeleteMarker();
  
  const [draftMarker, setDraftMarker] = useState<L.LatLng | null>(null);
  const [formData, setFormData] = useState({ name: "", note: "", category: "winery" as "winery" | "restaurant" | "farmstand" | "producer" });
  
  const handleMapClick = useCallback((latlng: L.LatLng) => {
    setDraftMarker(latlng);
    setFormData({ name: "", note: "", category: "winery" });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftMarker || !formData.name) return;
    
    createMarker.mutate({
      data: {
        name: formData.name,
        note: formData.note,
        category: formData.category,
        lat: draftMarker.lat,
        lng: draftMarker.lng,
      }
    }, {
      onSuccess: () => {
        setDraftMarker(null);
        queryClient.invalidateQueries({ queryKey: getGetMarkersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMarkerStatsQueryKey() });
      }
    });
  };

  const handleDelete = (id: number) => {
    deleteMarker.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMarkersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMarkerStatsQueryKey() });
      }
    });
  };

  const filteredMarkers = markers.filter(marker => {
    if (activeFilter === "all") return true;
    return marker.category === activeFilter;
  });

  return (
    <MapContainer 
      center={[45.1, -123.0]} 
      zoom={9} 
      className="w-full h-full z-0"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      />
      <MapEventsComponent onMapClick={handleMapClick} />
      
      {filteredMarkers.map(marker => (
        <Marker 
          key={marker.id} 
          position={[marker.lat, marker.lng]}
          icon={createCustomIcon(marker.category as "winery" | "restaurant")}
        >
          <Popup className="custom-popup min-w-[240px]">
            <div className="p-1">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground uppercase tracking-wider">
                  {marker.category === "winery" ? <Wine className="w-3 h-3" /> 
                  : marker.category === "farmstand" ? <Leaf className="w-3 h-3" />
                  : marker.category === "producer" ? <Store className="w-3 h-3" />
                  : <Utensils className="w-3 h-3" />}
                  {marker.category}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {format(new Date(marker.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-foreground mb-1 leading-tight">{marker.name}</h3>
              {marker.note && (
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{marker.note}</p>
              )}
              {marker.website && (
                <a
                  href={marker.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mb-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3 h-3" />
                  Visit website
                </a>
              )}
              <div className="pt-3 mt-1 border-t border-border flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-8 px-2 gap-1.5 ${isSaved(marker.id) ? "text-primary hover:text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSave({
                      id: marker.id,
                      name: marker.name,
                      category: marker.category,
                      city: (marker as any).city ?? null,
                    });
                  }}
                  title={isSaved(marker.id) ? "Remove from My List" : "Save to My List"}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved(marker.id) ? "fill-primary" : ""}`} />
                  {isSaved(marker.id) ? "Saved" : "Save"}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(marker.id);
                  }}
                  disabled={deleteMarker.isPending}
                >
                  {deleteMarker.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
                  Remove
                </Button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {draftMarker && (
        <Marker position={draftMarker} icon={defaultIcon}>
          <Popup 
            className="custom-popup min-w-[280px]"
            eventHandlers={{
              remove: () => setDraftMarker(null)
            }}
          >
            <form onSubmit={handleSubmit} className="p-1 space-y-4">
              <div className="mb-2">
                <h3 className="font-serif text-lg font-bold text-foreground">Mark this spot</h3>
                <p className="text-xs text-muted-foreground">Name it. Note what made it worth stopping.</p>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-foreground">Name</Label>
                  <Input 
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
                    placeholder="E.g. Scribe Winery"
                    className="h-9 bg-background focus-visible:ring-1"
                    autoFocus
                  />
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="note" className="text-xs font-medium text-foreground">Notes</Label>
                  <Textarea 
                    id="note"
                    value={formData.note}
                    onChange={(e) => setFormData(p => ({ ...p, note: e.target.value }))}
                    placeholder="What was memorable?"
                    className="min-h-[80px] resize-none bg-background focus-visible:ring-1"
                  />
                </div>

                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-medium text-foreground">Category</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, category: "winery" }))}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border text-xs font-medium transition-colors
                        ${formData.category === "winery" 
                          ? "bg-primary text-primary-foreground border-primary" 
                          : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                    >
                      <Wine className="w-4 h-4" />
                      Winery
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, category: "restaurant" }))}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border text-xs font-medium transition-colors
                        ${formData.category === "restaurant" 
                          ? "bg-secondary text-secondary-foreground border-secondary" 
                          : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                    >
                      <Utensils className="w-4 h-4" />
                      Dining
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, category: "farmstand" }))}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border text-xs font-medium transition-colors
                        ${formData.category === "farmstand" 
                          ? "bg-[#6f7d3c] text-white border-[#6f7d3c]" 
                          : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                    >
                      <Leaf className="w-4 h-4" />
                      Farm
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(p => ({ ...p, category: "producer" }))}
                      className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-md border text-xs font-medium transition-colors
                        ${formData.category === "producer" 
                          ? "bg-[#c06a2d] text-white border-[#c06a2d]" 
                          : "bg-background text-muted-foreground border-border hover:bg-muted"}`}
                    >
                      <Store className="w-4 h-4" />
                      Producer
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 flex gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  className="flex-1 h-9"
                  onClick={() => setDraftMarker(null)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="flex-1 h-9"
                  disabled={!formData.name || createMarker.isPending}
                >
                  {createMarker.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save Spot
                </Button>
              </div>
            </form>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
