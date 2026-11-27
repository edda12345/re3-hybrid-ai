import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type RecycleKind3D =
  | "bottle"
  | "box"
  | "battery"
  | "jar"
  | "clothing"
  | "paper"
  | "can"
  | "ewaste"
  | "bag"
  | "general";

export interface RecycleModel3DProps {
  kind: RecycleKind3D;
  size?: number;
  glbUrl?: string;
  interactive?: boolean;
}

export function inferRecycleKind3D(text: string): RecycleKind3D {
  const lower = text.toLowerCase();

  if (
    /\bjeans\b|\bshirt\b|\bt-shirt\b|\bclothes\b|\bclothing\b|\bcloth\b|\bfabric\b|\btextile\b|\bjacket\b|\bhoodie\b|\bsweater\b|\bshorts\b|\bskirt\b|\bdress\b|\bshoe\b|\bshoes\b|\bsneaker\b|\bsock\b|\bsocks\b|\btowel\b/.test(
      lower
    )
  ) {
    return "clothing";
  }

  if (
    /\bbook\b|\bbooks\b|\bnotebook\b|\bmagazine\b|\bnewspaper\b|\bpaper\b|\bpapers\b|\bcardboard\b|\bcarton\b|\bflyer\b|\bbrochure\b/.test(
      lower
    )
  ) {
    return "paper";
  }

  if (/\bcan\b|\bcans\b|\btin\b|\btins\b|\bsoda\b|\baluminum\b|\baluminium\b|\bsteel\b/.test(lower)) {
    return "can";
  }

  if (
    /\bphone\b|\bsmartphone\b|\blaptop\b|\btablet\b|\bcharger\b|\bcable\b|\bwire\b|\belectronic\b|\belectronics\b|\be-waste\b|\bewaste\b|\bbulb\b|\bled\b|\bmouse\b|\bkeyboard\b|\bearbuds\b|\bheadphones\b/.test(
      lower
    )
  ) {
    return "ewaste";
  }

  if (/\bbattery\b|\bbatteries\b|\bswollen\b|\blithium\b|\bhazardous\b|\bchemical\b/.test(lower)) {
    return "battery";
  }

  if (/\bbag\b|\bbags\b|\btote\b|\bpouch\b|\bwrapper\b|\bwrappers\b|\bsachet\b|\bplastic bag\b/.test(lower)) {
    return "bag";
  }

  if (/\bbox\b|\bboxes\b|\bparcel\b|\bpackage\b/.test(lower)) {
    return "box";
  }

  if (/\bjar\b|\bjars\b|\bglass\b|\bmug\b|\bcup\b|\bceramic\b/.test(lower)) {
    return "jar";
  }

  if (/\bbottle\b|\bbottles\b|\bshampoo\b|\bdetergent\b|\bjug\b|\bflask\b/.test(lower)) {
    return "bottle";
  }

  return "general";
}

function buildProceduralMesh(kind: RecycleKind3D): THREE.Group {
  const group = new THREE.Group();

  if (kind === "bottle") {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x34d399,
      roughness: 0.25,
      metalness: 0.1,
    });
    const capMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.4,
      metalness: 0.05,
    });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.56, 1.35, 24), bodyMat);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 0.42, 24), bodyMat);
    neck.position.y = 0.88;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.24, 24), capMat);
    cap.position.y = 1.18;
    group.add(body, neck, cap);
  } else if (kind === "box") {
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.65,
      metalness: 0.05,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.4,
      metalness: 0.1,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.95, 1.15), boxMat);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.16, 1.18), trimMat);
    band.position.y = 0.15;
    group.add(box, band);
  } else if (kind === "battery") {
    const cellMat = new THREE.MeshStandardMaterial({
      color: 0xf87171,
      roughness: 0.35,
      metalness: 0.25,
    });
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.2,
      metalness: 0.8,
    });
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 1.35, 24), cellMat);
    cell.rotation.z = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.22, 20), tipMat);
    tip.rotation.z = Math.PI / 2;
    tip.position.x = 0.78;
    group.add(cell, tip);
  } else if (kind === "clothing") {
    const denimMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      roughness: 0.82,
      metalness: 0.04,
    });
    const cuffMat = new THREE.MeshStandardMaterial({
      color: 0x93c5fd,
      roughness: 0.85,
      metalness: 0.04,
    });
    const seamMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.6,
      metalness: 0.1,
    });
    const baseFold = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 1.05), denimMat);
    baseFold.position.y = -0.22;
    const topFold = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.34, 0.96), denimMat);
    topFold.position.set(0.04, 0.12, 0.02);
    const cuff = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.99), cuffMat);
    cuff.position.set(0.04, 0.28, 0.02);
    const stitch = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.04, 0.06), seamMat);
    stitch.position.set(0, -0.22, 0.52);
    group.add(baseFold, topFold, cuff, stitch);
  } else if (kind === "paper") {
    const pageMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.75,
      metalness: 0.02,
    });
    const coverMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.55,
      metalness: 0.08,
    });
    const spineMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      roughness: 0.5,
      metalness: 0.1,
    });
    const pages = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.56, 1.55), pageMat);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.58), coverMat);
    cover.position.y = 0.31;
    const bottomCover = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.08, 1.58), coverMat);
    bottomCover.position.y = -0.31;
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 1.59), spineMat);
    spine.position.x = -0.62;
    group.add(pages, cover, bottomCover, spine);
  } else if (kind === "can") {
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.22,
      metalness: 0.85,
    });
    const stripeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.35,
      metalness: 0.4,
    });
    const canBody = new THREE.Mesh(new THREE.CylinderGeometry(0.54, 0.54, 1.32, 28), metalMat);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.555, 0.555, 0.32, 28), stripeMat);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 12, 28), metalMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.66;
    group.add(canBody, band, rim);
  } else if (kind === "ewaste") {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.35,
      metalness: 0.6,
    });
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.2,
      metalness: 0.3,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.4,
      metalness: 0.5,
    });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.65, 0.16), bodyMat);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.38, 0.04), screenMat);
    screen.position.z = 0.08;
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.2), accentMat);
    port.position.set(0, -0.86, 0);
    group.add(chassis, screen, port);
  } else if (kind === "bag") {
    const bagMat = new THREE.MeshStandardMaterial({
      color: 0xa7f3d0,
      roughness: 0.55,
      metalness: 0.05,
    });
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x059669,
      roughness: 0.5,
      metalness: 0.1,
    });
    const pouch = new THREE.Mesh(new THREE.BoxGeometry(1.25, 1.25, 0.45), bagMat);
    const handleLeft = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 10, 20, Math.PI), handleMat);
    handleLeft.position.set(-0.28, 0.62, 0);
    const handleRight = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 10, 20, Math.PI), handleMat);
    handleRight.position.set(0.28, 0.62, 0);
    group.add(pouch, handleLeft, handleRight);
  } else if (kind === "general") {
    const cubeMat = new THREE.MeshStandardMaterial({
      color: 0x2dd4bf,
      roughness: 0.4,
      metalness: 0.2,
    });
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      roughness: 0.35,
      metalness: 0.3,
    });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), cubeMat);
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 12, 24), ringMat);
    loop.position.z = 0.6;
    group.add(cube, loop);
  } else {
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x6ee7b7,
      roughness: 0.18,
      metalness: 0.15,
    });
    const lidMat = new THREE.MeshStandardMaterial({
      color: 0xfde68a,
      roughness: 0.35,
      metalness: 0.45,
    });
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.58, 1.25, 24), glassMat);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.24, 24), lidMat);
    lid.position.y = 0.74;
    group.add(jar, lid);
  }

  group.rotation.x = 0.28;
  return group;
}

export const RecycleModel3D: React.FC<RecycleModel3DProps> = ({
  kind,
  size = 56,
  glbUrl,
  interactive = true,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 0.4, 3.3);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 1.25);
    const keyLight = new THREE.DirectionalLight(0xa7f3d0, 2.1);
    keyLight.position.set(2.5, 3.5, 3);
    const rimLight = new THREE.DirectionalLight(0xfef08a, 1.1);
    rimLight.position.set(-2.5, -1.5, 2);
    scene.add(ambient, keyLight, rimLight);

    const activeObject = buildProceduralMesh(kind);
    scene.add(activeObject);

    let loadedExternal: THREE.Object3D | null = null;
    if (glbUrl) {
      const loader = new GLTFLoader();
      loader.load(
        glbUrl,
        (gltf) => {
          scene.remove(activeObject);
          loadedExternal = gltf.scene;
          const box = new THREE.Box3().setFromObject(loadedExternal);
          const maxDim =
            Math.max(
              box.getSize(new THREE.Vector3()).x,
              box.getSize(new THREE.Vector3()).y,
              box.getSize(new THREE.Vector3()).z
            ) || 1;
          loadedExternal.scale.setScalar(1.65 / maxDim);
          scene.add(loadedExternal);
        },
        undefined,
        () => {
          // Keep procedural 3D model if .glb isn't placed yet
        }
      );
    }

    let isDragging = false;
    let prevX = 0;
    let prevY = 0;
    let dragVelX = 0;
    let dragVelY = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (!interactive) return;
      isDragging = true;
      prevX = e.clientX;
      prevY = e.clientY;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging || !interactive) return;
      const dx = e.clientX - prevX;
      const dy = e.clientY - prevY;
      prevX = e.clientX;
      prevY = e.clientY;
      dragVelY = dx * 0.015;
      dragVelX = dy * 0.015;
      const target = loadedExternal || activeObject;
      target.rotation.y += dragVelY;
      target.rotation.x += dragVelX;
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const target = loadedExternal || activeObject;
      if (!isDragging) {
        target.rotation.y += 0.014 + dragVelY;
        target.rotation.x += dragVelX;
        dragVelY *= 0.92;
        dragVelX *= 0.92;
      }
      target.position.y = Math.sin(performance.now() * 0.0025) * 0.06;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      domEl.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.dispose();
    };
  }, [kind, size, glbUrl, interactive]);

  return (
    <div
      ref={mountRef}
      style={{
        width: size,
        height: size,
        cursor: interactive ? "grab" : "default",
        flexShrink: 0,
      }}
      title={interactive ? "Drag to spin 3D item" : undefined}
    />
  );
};

export default RecycleModel3D;