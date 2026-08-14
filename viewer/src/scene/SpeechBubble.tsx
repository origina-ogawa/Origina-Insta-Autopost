import { Billboard, Text } from "@react-three/drei";
import { PALETTE } from "../theme";
import { computeBubbleSize } from "../lib/bubbleSize";

const DEFAULT_BG = "#ffffff";

// 社員アバターの頭上に表示する吹き出し。テキストの文字数に応じて板のサイズを変える。
// bgを変えることで、実際のイベントメッセージと演出用の小ネタ(面白いセリフ)を視覚的に区別できる。
export function SpeechBubble({ text, bg = DEFAULT_BG }: { text: string; bg?: string }) {
  const { width, height, maxTextWidth } = computeBubbleSize(text);
  return (
    <Billboard position={[0, 2.05, 0]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={bg} roughness={1} metalness={0} />
      </mesh>
      <Text
        position={[0, 0, 0.01]}
        fontSize={0.15}
        color={PALETTE.ink}
        anchorX="center"
        anchorY="middle"
        maxWidth={maxTextWidth}
      >
        {text}
      </Text>
    </Billboard>
  );
}
