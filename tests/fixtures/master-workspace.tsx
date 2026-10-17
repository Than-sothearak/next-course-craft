import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Button } from "@/components/ui/button";
import { LearningPageEditor } from "@/app/courses/[courseId]/slides/edit/_components/learning-page-editor";
import { MasterEditor } from "@/app/courses/[courseId]/slides/edit/_components/master-editor";
import { institutionalGreenMaster, masterOverridesFor } from "@/lib/slides/master-schema";
import { slideThemePresets } from "@/lib/slides/themes";
import { slideSnapshotSchema } from "@/lib/slides/schema";
import { composeLearningPage } from "@/lib/slides/pages";
import { createLearningBlock } from "@/lib/slides/blocks";

const initial = composeLearningPage({ ...slideSnapshotSchema.parse({ title: "1. Principle of Bio-refinery", order: 2, objects: [], revision: 0 }), id: "reference" });
initial.composition!.layers = [
  { ...createLearningBlock("text"), kind: "text", name: "Concept text", heading: "1.1. Concept", body: "A bio-refinery integrates biomass conversion processes and equipment to produce fuels, power, heat, and value-added chemicals from biomass.\n\nArrange text, images, video and interactions independently in this content area.", placement: { x: 20, y: 40, width: 680, height: 500, rotation: 0, zIndex: 1 }, appearance: { color: "#172033", fontFamily: "serif", fontSize: 28, headingSize: 34 } },
  { ...createLearningBlock("shape"), kind: "shape", name: "Green circle", shape: "ellipse", placement: { x: 850, y: 340, width: 200, height: 200, rotation: 0, zIndex: 2 }, appearance: { backgroundColor: "#b4ca5f" } },
  { ...createLearningBlock("tabs"), name: "Explore", placement: { x: 750, y: 40, width: 480, height: 240, rotation: 0, zIndex: 3 } },
];
function App() {
  const [slide, setSlide] = useState(initial), [theme, setTheme] = useState(slideThemePresets.find((preset) => preset.id === "institutional-green")!.theme);
  const [masterOpen, setMasterOpen] = useState(false);
  return <div className="flex h-screen flex-col"><div className="flex shrink-0 gap-3 p-2"><Button onClick={() => setMasterOpen(true)}>Open master editor</Button><Button onClick={() => setSlide((current) => ({ ...current, order: current.order + 1 }))}>Reorder slide</Button><Button onClick={() => setTheme((current) => ({ ...current, master: institutionalGreenMaster }))}>Reset course master</Button></div><LearningPageEditor courseId="course" slide={{ ...slide, composition: slide.composition! }} theme={theme} viewport="desktop" advanced disabled={false} onUpdate={setSlide} onAdd={() => {}} onEditMaster={() => setMasterOpen(true)} />{masterOpen && <MasterEditor courseId="course" theme={theme} slide={slide} scope="course" disabled={false} onClose={() => setMasterOpen(false)} onApply={(master, scope) => { if (scope === "course") setTheme((current) => ({ ...current, master })); else setSlide((current) => ({ ...current, composition: { ...current.composition!, masterOverrides: masterOverridesFor(theme.master, master) } })); setMasterOpen(false); }} />}<output data-layer-state hidden>{JSON.stringify(slide.composition)}</output></div>;
}
createRoot(document.getElementById("root")!).render(<App />);
