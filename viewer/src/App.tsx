import { Scene } from "./scene/Scene";
import { Overlay } from "./ui/Overlay";
import "./ui/panels.css";

export function App() {
  return (
    <div className="app">
      <div className="canvas-layer">
        <Scene />
      </div>
      <Overlay />
    </div>
  );
}
