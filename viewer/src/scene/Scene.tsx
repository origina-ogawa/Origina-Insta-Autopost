import { Canvas } from "@react-three/fiber";
import { Room } from "./Room";
import { Office } from "./Office";
import type { OfficeState } from "../state/officeState";

// アイソメトリック調のローポリ表現。俯瞰45度前後の固定カメラで、パースは弱め(FOVを絞って擬似アイソに寄せる)。
// カメラは固定で、ユーザーが回転させる操作は付けない。
const CAMERA_POSITION: [number, number, number] = [0, 15, 17.5];
const CAMERA_FOV = 24;

export function Scene({ office }: { office: OfficeState }) {
  return (
    <Canvas
      shadows
      camera={{ position: CAMERA_POSITION, fov: CAMERA_FOV }}
      onCreated={({ camera }) => camera.lookAt(0, 1, -1.5)}
    >
      <color attach="background" args={["#F2EDE4"]} />
      <hemisphereLight args={["#FFF3E0", "#9C8A6A", 0.9]} />
      <directionalLight
        position={[6, 10, 6]}
        intensity={0.9}
        color="#FFE6B8"
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <ambientLight intensity={0.35} />
      <Room />
      <Office actors={office.actors} batchCount={office.batchCount} />
    </Canvas>
  );
}
