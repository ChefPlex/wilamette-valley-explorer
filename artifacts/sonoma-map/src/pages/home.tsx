import { useState } from "react";
import { MapComponent } from "@/components/Map";
import { Sidebar } from "@/components/Sidebar";
import { SonomaChef } from "@/components/SonomaChef";
import { WelcomeOverlay } from "@/components/WelcomeOverlay";
import { MyList } from "@/components/MyList";
import { useMyList } from "@/hooks/useMyList";

export default function Home() {
  const [activeFilter, setActiveFilter] = useState<"all" | "winery" | "restaurant" | "farmstand">("all");

  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem("sonoma-welcomed"));
  const handleCloseWelcome = () => {
    localStorage.setItem("sonoma-welcomed", "1");
    setShowWelcome(false);
  };

  const [showMyList, setShowMyList] = useState(false);
  const { saved, toggle, remove, isSaved, clearAll } = useMyList();

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-background font-sans">
      <Sidebar activeFilter={activeFilter} setActiveFilter={setActiveFilter} />
      <div className="flex-1 relative h-full">
        <MapComponent
          activeFilter={activeFilter}
          onToggleSave={toggle}
          isSaved={isSaved}
        />
        <SonomaChef />

        {/* Bottom-left control stack */}
        <div className="absolute bottom-6 left-6 z-[999] flex flex-col items-center gap-2">
          {/* My List panel + trigger */}
          <MyList
            saved={saved}
            onRemove={remove}
            onClearAll={clearAll}
            open={showMyList}
            onToggleOpen={() => setShowMyList((v) => !v)}
          />
          {/* Help / ? button */}
          <button
            onClick={() => setShowWelcome(true)}
            className="h-9 w-9 rounded-full bg-card border border-border shadow-md hover:shadow-lg text-muted-foreground hover:text-foreground text-sm font-semibold transition-all flex items-center justify-center"
            title="How it works"
          >
            ?
          </button>
        </div>

        {/* Welcome overlay */}
        <WelcomeOverlay open={showWelcome} onClose={handleCloseWelcome} />
      </div>
    </div>
  );
}
