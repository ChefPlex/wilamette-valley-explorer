import { Wine, Utensils, Leaf, Store, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGetMarkerStats } from "@workspace/api-client-react";

interface WelcomeOverlayProps {
  open: boolean;
  onClose: () => void;
}

const PIN_TYPES = [
  {
    icon: Wine,
    label: "Wineries",
    description: "Curated estates and tasting rooms",
    color: "bg-primary",
  },
  {
    icon: Utensils,
    label: "Restaurants & Bars",
    description: "Chef-vetted tables worth the drive",
    color: "bg-secondary",
  },
  {
    icon: Leaf,
    label: "Farm Stands & Markets",
    description: "Hazelnut orchards, berry farms, and markets behind the best tables",
    color: "bg-[#6f7d3c]",
  },
  {
    icon: Store,
    label: "Artisan Producers",
    description: "Makers of cider, truffle goods, cheese, and more",
    color: "bg-[#c06a2d]",
  },
];

export function WelcomeOverlay({ open, onClose }: WelcomeOverlayProps) {
  const { data: stats } = useGetMarkerStats();

  if (!open) return null;

  const total = stats?.total ?? "—";
  const wineries = stats?.wineries ?? "—";
  const restaurants = stats?.restaurants ?? "—";
  const farmstands = stats?.farmstands ?? "—";
  const producers = stats?.producers ?? "—";

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="relative px-6 pt-7 pb-5 border-b border-border">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1.5">
            A Chef's Guide
          </p>
          <h1 className="font-serif text-2xl font-bold text-foreground leading-tight">
            Willamette Valley
          </h1>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {total} personally curated spots — {wineries} wineries, {restaurants} restaurants, {farmstands} farm stands, and {producers} artisan producers (truffle dealers, hazelnut roasters, cheesemakers, cidermakers, and more) — verified by a professional chef who actually goes to all of them.
          </p>
        </div>

        {/* Pin legend */}
        <div className="px-6 py-5 space-y-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Map Key
          </p>
          {PIN_TYPES.map(({ icon: Icon, label, description, color }) => (
            <div key={label} className="flex items-center gap-3.5">
              <div className={`${color} text-white p-1.5 rounded-full shadow-sm flex-shrink-0`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <div className="px-6 pb-2">
          <div className="bg-muted/50 rounded-xl px-4 py-3 space-y-1.5">
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">Tap any pin</span> to read the chef's notes and visit the website.
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">Ask Valley Chef</span> (bottom right) — an AI that knows this map inside out.
            </p>
            <p className="text-xs text-muted-foreground leading-snug">
              <span className="font-medium text-foreground">Bookmark spots</span> to build your personal list for the day.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pt-4 pb-6">
          <Button onClick={onClose} className="w-full h-11 text-sm font-semibold rounded-xl">
            Start Exploring
          </Button>
        </div>
      </div>
    </div>
  );
}
