import { Scene } from "./scene/Scene";
import { Overlay } from "./ui/Overlay";
import { useOfficeState } from "./state/officeState";
import { useInstructionLog } from "./lib/instructionLog";
import "./ui/panels.css";

export function App() {
  const office = useOfficeState();
  const { history: instructionHistory, send: sendInstruction } = useInstructionLog();

  return (
    <div className="app">
      <div className="canvas-layer">
        <Scene office={office} instructionHistory={instructionHistory} sendInstruction={sendInstruction} />
      </div>
      <Overlay office={office} />
    </div>
  );
}
