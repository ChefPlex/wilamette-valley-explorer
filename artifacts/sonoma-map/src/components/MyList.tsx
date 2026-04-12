import { Bookmark, X, Trash2, Wine, Utensils, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SavedSpot } from "@/hooks/useMyList";

interface MyListProps {
  saved: Map<number, SavedSpot>;
  onRemove: (id: number) => void;
  onClearAll: () => void;
  open: boolean;
  onToggleOpen: () => void;
}

function CategoryIcon({ category }: { category: string }) {
  if (category === "winery") return <Wine className="w-3 h-3" />;
  if (category === "farmstand") return <Leaf className="w-3 h-3" />;
  return <Utensils className="w-3 h-3" />;
}

function categoryColor(category: string) {
  if (category === "winery") return "bg-primary text-white";
  if (category === "farmstand") return "bg-[#6f7d3c] text-white";
  return "bg-secondary text-secondary-foreground";
}

export function MyList({ saved, onRemove, onClearAll, open, onToggleOpen }: MyListProps) {
  const count = saved.size;
  const spots = [...saved.values()];

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={onToggleOpen}
        className="relative h-10 w-10 rounded-full bg-card border border-border shadow-md hover:shadow-lg text-muted-foreground hover:text-foreground transition-all flex items-center justify-center"
        title="My saved list"
      >
        <Bookmark className={`w-4 h-4 transition-colors ${count > 0 ? "fill-primary text-primary" : ""}`} />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute bottom-[52px] left-0 z-[1000] w-[280px] sm:w-[320px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
            <div className="flex items-center gap-2.5">
              <Bookmark className="w-4 h-4 text-primary fill-primary" />
              <span className="font-serif font-semibold text-foreground text-sm">My List</span>
              {count > 0 && (
                <span className="bg-muted text-muted-foreground text-[10px] font-medium px-2 py-0.5 rounded-full">
                  {count} {count === 1 ? "spot" : "spots"}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                  onClick={onClearAll}
                  title="Clear all"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onToggleOpen}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* List */}
          {count === 0 ? (
            <div className="py-10 px-4 text-center">
              <Bookmark className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No spots saved yet</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tap the bookmark icon on any pin to save spots for your visit.
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[320px]">
              <div className="py-1.5">
                {spots.map((spot) => (
                  <div
                    key={spot.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors group"
                  >
                    <div className={`${categoryColor(spot.category)} p-1.5 rounded-full flex-shrink-0`}>
                      <CategoryIcon category={spot.category} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate leading-tight">
                        {spot.name}
                      </p>
                      {spot.city && (
                        <p className="text-xs text-muted-foreground truncate">{spot.city}</p>
                      )}
                    </div>
                    <button
                      onClick={() => onRemove(spot.id)}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all flex-shrink-0"
                      title="Remove from list"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </>
  );
}
