import type { SavedSpot } from "@/hooks/useMyList";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { useGetMarkers, getGetMarkersQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Wine, Utensils, Leaf, ExternalLink, Bookmark, Store } from "lucide-react";
import { format } from "date-fns";

// Fix Leaflet default icon issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Create custom icons
const createCustomIcon = (type: "winery" | "restaurant" | "farmstand" | "artisan" | string) => {
  const bgColor = type === "winery" ? "bg-primary" 
    : type === "farmstand" ? "bg-[#6f7d3c]"
    : type === "artisan" ? "bg-[#c06a2d]"
    : "bg-secondary";
  const iconSvg = type === "winery"
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M7 10h10"/><path d="M12 15v7"/><path d="M12 15a5 5 0 0 0 5-5c0-2-.5-4-2-8H9c-1.5 4-2 6-2 8a5 5 0 0 0 5 5Z"/></svg>`
    : type === "farmstand"
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>`
    : type === "artisan"
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

interface MapComponentProps {
  activeFilter: string;
  onToggleSave: (spot: SavedSpot) => void;
  isSaved: (id: number) => boolean;
}

export function MapComponent({ activeFilter, onToggleSave, isSaved }: MapComponentProps) {
  const { data: markers = [], isLoading } = useGetMarkers({
    query: { queryKey: getGetMarkersQueryKey() }
  });

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
      
      {filteredMarkers.map(marker => (
        <Marker 
          key={marker.id} 
          position={[marker.lat, marker.lng]}
          icon={createCustomIcon(marker.category as "winery" | "restaurant")}
        >
          <Popup className="custom-popup min-w-[240px]">
            <div className="p-1">
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground">
                  {marker.category === "winery" ? <Wine className="w-3 h-3" /> 
                  : marker.category === "farmstand" ? <Leaf className="w-3 h-3" />
                  : marker.category === "artisan" ? <Store className="w-3 h-3" />
                  : <Utensils className="w-3 h-3" />}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {format(new Date(marker.createdAt), 'MMM d, yyyy')}
                </span>
              </div>
              <h3 className="font-serif text-lg font-bold text-foreground mb-1 leading-tight">{marker.name}</h3>
              {marker.city && (
                <p className="text-xs text-muted-foreground italic mb-2">{marker.city}, OR</p>
              )}
              {marker.note && (
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{marker.note}</p>
              )}
              {marker.website && /^https?:\/\//i.test(marker.website) && (
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
                      city: marker.city ?? null,
                    });
                  }}
                  title={isSaved(marker.id) ? "Remove from My List" : "Save to My List"}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${isSaved(marker.id) ? "fill-primary" : ""}`} />
                  {isSaved(marker.id) ? "Saved" : "Save"}
                </Button>
              </div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
