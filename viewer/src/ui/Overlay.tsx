import { TitlePanel } from "./TitlePanel";
import { StatusPanel } from "./StatusPanel";
import { ActivityPanel } from "./ActivityPanel";
import { LegendPanel } from "./LegendPanel";

// 3Dシーンの上に重ねるHTMLオーバーレイ。4種のパネルで構成する。
export function Overlay() {
  return (
    <div className="overlay">
      <TitlePanel />
      <StatusPanel />
      <ActivityPanel />
      <LegendPanel />
    </div>
  );
}
