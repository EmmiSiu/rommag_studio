"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import * as THREE from "three";

import type { SpatialPresetV1 } from "@/lib/spatial-presets";

const STEM_COLORS: Record<string, number> = {
  vocals: 0x67e8f9,
  drums: 0xf59e0b,
  bass: 0x34d399,
  other: 0xc084fc,
};

const POSITION_LIMIT = 2;

type SpatialSceneProps = {
  preset: SpatialPresetV1;
  activeStem: string;
  onActiveStemChange: (stemName: string) => void;
  onPositionChange: (stemName: string, position: { x: number; z: number }) => void;
};

function clampPosition(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(POSITION_LIMIT, Math.max(-POSITION_LIMIT, value));
}

function colorForStem(stemName: string): number {
  return STEM_COLORS[stemName] ?? 0x93c5fd;
}

export function SpatialScene({
  preset,
  activeStem,
  onActiveStemChange,
  onPositionChange,
}: SpatialSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const activeStemRef = useRef(activeStem);
  const presetRef = useRef(preset);
  const dragStemRef = useRef<string | null>(null);
  const onActiveStemChangeRef = useRef(onActiveStemChange);
  const onPositionChangeRef = useRef(onPositionChange);

  useEffect(() => {
    activeStemRef.current = activeStem;
  }, [activeStem]);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    onActiveStemChangeRef.current = onActiveStemChange;
  }, [onActiveStemChange]);

  useEffect(() => {
    onPositionChangeRef.current = onPositionChange;
  }, [onPositionChange]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070914);
    sceneRef.current = scene;
    const meshes = meshesRef.current;

    const camera = new THREE.OrthographicCamera(-2.6, 2.6, 2.6, -2.6, 0.1, 40);
    camera.position.set(0, 7, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    renderer.setClearColor(0x070914, 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.setAttribute("aria-hidden", "true");
    mount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const grid = new THREE.GridHelper(4.4, 8, 0x38bdf8, 0x1e293b);
    grid.position.y = -0.02;
    scene.add(grid);

    const listener = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.22, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
    );
    listener.rotation.x = -Math.PI / 2;
    listener.position.set(0, 0.02, 0);
    scene.add(listener);

    const frontLine = new THREE.Mesh(
      new THREE.BoxGeometry(3.8, 0.015, 0.025),
      new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.75 }),
    );
    frontLine.position.set(0, 0.01, -2);
    scene.add(frontLine);

    scene.add(new THREE.AmbientLight(0xffffff, 1.7));
    const point = new THREE.PointLight(0x93c5fd, 4, 10);
    point.position.set(0, 4, 0);
    scene.add(point);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const pointer = new THREE.Vector2();
    const raycaster = new THREE.Raycaster();
    const intersection = new THREE.Vector3();

    const syncPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
    };

    const worldFromPointer = (event: PointerEvent) => {
      syncPointer(event);
      const hit = raycaster.ray.intersectPlane(plane, intersection);
      if (!hit) return null;
      return { x: clampPosition(hit.x), z: clampPosition(hit.z) };
    };

    const handlePointerDown = (event: PointerEvent) => {
      syncPointer(event);
      const hits = raycaster.intersectObjects(Array.from(meshesRef.current.values()), false);
      const hitStem = typeof hits[0]?.object.userData.stemName === "string"
        ? hits[0].object.userData.stemName
        : null;
      if (!hitStem) return;
      event.preventDefault();
      renderer.domElement.setPointerCapture(event.pointerId);
      dragStemRef.current = hitStem;
      onActiveStemChangeRef.current(hitStem);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragStem = dragStemRef.current;
      if (!dragStem) return;
      const position = worldFromPointer(event);
      if (!position) return;
      event.preventDefault();
      onPositionChangeRef.current(dragStem, position);
    };

    const releasePointer = (event: PointerEvent) => {
      if (!dragStemRef.current) return;
      dragStemRef.current = null;
      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch {
        /* Pointer capture may already be released by the browser. */
      }
    };

    const resize = () => {
      const width = Math.max(1, mount.clientWidth);
      const height = Math.max(1, mount.clientHeight);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      const base = 2.65;
      if (aspect >= 1) {
        camera.left = -base * aspect;
        camera.right = base * aspect;
        camera.top = base;
        camera.bottom = -base;
      } else {
        camera.left = -base;
        camera.right = base;
        camera.top = base / aspect;
        camera.bottom = -base / aspect;
      }
      camera.updateProjectionMatrix();
      renderer.render(scene, camera);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerup", releasePointer);
    renderer.domElement.addEventListener("pointercancel", releasePointer);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();

    let frame = 0;
    let animationId = 0;
    const animate = () => {
      frame += 0.016;
      meshesRef.current.forEach((mesh, stemName) => {
        const scale = activeStemRef.current === stemName ? 1.2 + Math.sin(frame * 5) * 0.035 : 1;
        mesh.scale.setScalar(scale);
        mesh.rotation.y += 0.01;
      });
      renderer.render(scene, camera);
      animationId = window.requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(animationId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerup", releasePointer);
      renderer.domElement.removeEventListener("pointercancel", releasePointer);
      meshes.forEach((mesh) => {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else {
          mesh.material.dispose();
        }
      });
      meshes.clear();
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return;

    const stemNames = Object.keys(preset.stems);
    const currentMeshes = meshesRef.current;

    currentMeshes.forEach((mesh, stemName) => {
      if (stemNames.includes(stemName)) return;
      scene.remove(mesh);
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
      currentMeshes.delete(stemName);
    });

    stemNames.forEach((stemName) => {
      let mesh = currentMeshes.get(stemName);
      if (!mesh) {
        mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 32, 16),
          new THREE.MeshStandardMaterial({
            color: colorForStem(stemName),
            emissive: colorForStem(stemName),
            emissiveIntensity: 0.18,
            roughness: 0.4,
            metalness: 0.2,
          }),
        );
        mesh.userData.stemName = stemName;
        currentMeshes.set(stemName, mesh);
        scene.add(mesh);
      }

      const settings = preset.stems[stemName];
      mesh.position.set(settings.x, 0.16, settings.z);
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.opacity = settings.muted ? 0.35 : 1;
      material.transparent = settings.muted;
      material.emissiveIntensity = activeStem === stemName ? 0.45 : 0.18;
    });

    renderer.render(scene, camera);
  }, [activeStem, preset]);

  const moveActiveStem = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const settings = presetRef.current.stems[activeStemRef.current];
    if (!settings) return;
    event.preventDefault();
    const step = event.shiftKey ? 0.25 : 0.1;
    const next = {
      x: settings.x,
      z: settings.z,
    };
    if (event.key === "ArrowLeft") next.x -= step;
    if (event.key === "ArrowRight") next.x += step;
    if (event.key === "ArrowUp") next.z -= step;
    if (event.key === "ArrowDown") next.z += step;
    onPositionChangeRef.current(activeStemRef.current, {
      x: clampPosition(next.x),
      z: clampPosition(next.z),
    });
  };

  return (
    <div
      ref={mountRef}
      data-stage9-canvas
      tabIndex={0}
      role="application"
      aria-label={`Campo sonoro 3D. Stem activo: ${activeStem}. Usa flechas para moverlo.`}
      onKeyDown={moveActiveStem}
      className="h-[270px] w-full overflow-hidden rounded-lg outline-none ring-1 ring-white/10 transition focus:ring-2 focus:ring-cyan-300 sm:h-[340px]"
    />
  );
}
