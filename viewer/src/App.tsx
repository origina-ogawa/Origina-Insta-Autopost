import { Scene } from "./scene/Scene";
import { Overlay } from "./ui/Overlay";
import { useOfficeState } from "./state/officeState";
import "./ui/panels.css";

export function App() {
  const office = useOfficeState();

  return (
    <div className="app">
      <div className="canvas-layer">
        <Scene office={office} />
      </div>
      <Overlay office={office} />
    </div>
  );
}
