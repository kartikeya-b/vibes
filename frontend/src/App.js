import "@/index.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/Navbar";
import AnalyticsStudio from "@/pages/AnalyticsStudio";
import RaceDeepDive from "@/pages/RaceDeepDive";
import StoryExplorer from "@/pages/StoryExplorer";
import RivalryExplorer from "@/pages/RivalryExplorer";
import GOATEngine from "@/pages/GOATEngine";

function App() {
  return (
    <div className="App min-h-screen bg-void">
      {/* Noise texture overlay */}
      <div className="noise-overlay" />
      
      <BrowserRouter>
        <Navbar />
        <main>
          <Routes>
            <Route path="/" element={<AnalyticsStudio />} />
            <Route path="/race" element={<RaceDeepDive />} />
            <Route path="/story" element={<StoryExplorer />} />
            <Route path="/rivalry" element={<RivalryExplorer />} />
            <Route path="/goat" element={<GOATEngine />} />
          </Routes>
        </main>
        <Toaster position="bottom-right" theme="dark" />
      </BrowserRouter>
    </div>
  );
}

export default App;
