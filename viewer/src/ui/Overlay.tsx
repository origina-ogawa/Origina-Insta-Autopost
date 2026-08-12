import { TitlePanel } from "./TitlePanel";
import { StatusPanel } from "./StatusPanel";
import { ActivityPanel } from "./ActivityPanel";
import { LegendPanel } from "./LegendPanel";
import type { OfficeState } from "../state/officeState";

// 3Dシーンの上に重ねるHTMLオーバーレイ。4種のパネルで構成する。
export function Overlay({ office }: { office: OfficeState }) {
  return (
    <div className="overlay">
      <TitlePanel />
      <StatusPanel actors={office.actors} />
      <ActivityPanel events={office.recentEvents} />
      <LegendPanel />
    </div>
  );
}
