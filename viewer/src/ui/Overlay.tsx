import { TitlePanel } from "./TitlePanel";
import { StatusPanel } from "./StatusPanel";
import { ActivityPanel } from "./ActivityPanel";
import type { OfficeState } from "../state/officeState";

// 3Dシーンの上に重ねるHTMLオーバーレイ。左上にタイトル、右端に社員ステータス+
// アクティビティログをまとめた縦長サイドパネルを配置する(凡例パネルは廃止)。
export function Overlay({ office }: { office: OfficeState }) {
  return (
    <div className="overlay">
      <TitlePanel />
      <aside className="sidebar">
        <StatusPanel actors={office.actors} />
        <ActivityPanel events={office.recentEvents} />
      </aside>
    </div>
  );
}
