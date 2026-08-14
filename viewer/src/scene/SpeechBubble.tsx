import { useEffect, useMemo } from "react";
import { Billboard, Text } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE } from "../theme";
import { computeBubbleSize, MIN_BUBBLE_HEIGHT } from "../lib/bubbleSize";

const DEFAULT_BG = "#ffffff";
const CORNER_RADIUS = 0.08; // 角丸の半径(吹き出しが小さい場合は幅・高さに応じて縮める)
const TAIL_WIDTH = 0.14; // しっぽの付け根の幅
const TAIL_HEIGHT = 0.16; // しっぽの高さ(下辺からどれだけ突き出すか)

// 角丸長方形+下向きのしっぽを持つ吹き出し形状を組み立てる。
// しっぽは下辺中央から下(アバターの頭側)に向けて突き出す。
function buildBubbleShape(width: number, height: number): THREE.Shape {
  const w = width / 2;
  const h = height / 2;
  const r = Math.min(CORNER_RADIUS, w * 0.3, h * 0.3);
  const tailHalf = Math.min(TAIL_WIDTH / 2, w * 0.3);

  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -h);
  shape.lineTo(-tailHalf, -h);
  shape.lineTo(0, -h - TAIL_HEIGHT);
  shape.lineTo(tailHalf, -h);
  shape.lineTo(w - r, -h);
  shape.quadraticCurveTo(w, -h, w, -h + r);
  shape.lineTo(w, h - r);
  shape.quadraticCurveTo(w, h, w - r, h);
  shape.lineTo(-w + r, h);
  shape.quadraticCurveTo(-w, h, -w, h - r);
  shape.lineTo(-w, -h + r);
  shape.quadraticCurveTo(-w, -h, -w + r, -h);
  return shape;
}

// 社員アバターの頭上に表示する吹き出し。テキストの文字幅に応じて板のサイズを変える。
// bgを変えることで、実際のイベントメッセージと演出用の小ネタ(面白いセリフ)を視覚的に区別できる。
export function SpeechBubble({ text, bg = DEFAULT_BG }: { text: string; bg?: string }) {
  const { width, height, maxTextWidth } = computeBubbleSize(text);
  const geometry = useMemo(() => new THREE.ShapeGeometry(buildBubbleShape(width, height)), [width, height]);

  // geometryをmeshのgeometry propへ命令的に渡しているため、R3Fは差し替え時・アンマウント時に
  // 自動でdisposeしない(宣言的なJSX子要素<shapeGeometry />ならR3Fが面倒を見るが、useMemoで
  // 生成したインスタンスを渡す今の書き方では自前でdisposeする必要がある)。吹き出しは実メッセージ
  // ・面白いセリフ(6〜9秒おき)のたびに頻繁にマウント/アンマウントされるため、放置するとGPU/CPU
  // バッファがリークし続ける。
  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  return (
    <Billboard position={[0, 2.05 + (height - MIN_BUBBLE_HEIGHT) / 2, 0]}>
      <mesh geometry={geometry}>
        <meshStandardMaterial color={bg} roughness={1} metalness={0} side={THREE.DoubleSide} />
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
