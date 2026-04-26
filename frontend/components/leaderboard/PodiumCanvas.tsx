"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useRef } from "react";

type PodiumEntry = {
  name: string;
  avatar: string;
  flyers: number;
  color: string;
  height: number;
  rank: number;
  pos: number;
  profilePhotoUrl?: string | null;
};

declare global {
  interface Window {
    THREE?: any;
  }
}

const THREE_SRC = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
const medalConfigs: Record<number, { label: string; color: number }> = {
  1: { label: "1", color: 0xf5c842 },
  2: { label: "2", color: 0xcbd5e1 },
  3: { label: "3", color: 0xd97706 },
};

function loadThreeJs() {
  if (window.THREE) {
    return Promise.resolve(window.THREE);
  }

  return new Promise<any>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${THREE_SRC}"]`) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener("load", () => resolve(window.THREE), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Three.js")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = THREE_SRC;
    script.async = true;
    script.onload = () => resolve(window.THREE);
    script.onerror = () => reject(new Error("Failed to load Three.js"));
    document.head.appendChild(script);
  });
}

export default function PodiumCanvas({ podiumData }: { podiumData: PodiumEntry[] }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    let animId = 0;
    let cancelled = false;
    let renderer: any;
    let onResize: (() => void) | undefined;

    void loadThreeJs()
      .then((THREE) => {
        if (!THREE || cancelled) return;

        const width = el.clientWidth;
        const height = el.clientHeight || 360;
        const aspect = width / height;
        const scene = new THREE.Scene();
        const fov = aspect < 1 ? 52 : aspect < 1.3 ? 46 : 42;
        const camZ = aspect < 1 ? 9.5 : aspect < 1.3 ? 9.2 : 9;
        const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
        camera.position.set(0, 3.2, camZ);
        camera.lookAt(0, 0.5, 0);

        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.outputEncoding = THREE.sRGBEncoding;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        el.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0xfff8e0, 0.7);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xfff4c2, 1.4);
        keyLight.position.set(5, 10, 6);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.set(1024, 1024);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0xffeaa0, 0.4);
        fillLight.position.set(-5, 3, -4);
        scene.add(fillLight);

        const floorGeo = new THREE.PlaneGeometry(14, 8);
        const floorMat = new THREE.MeshLambertMaterial({
          color: 0xfdf8e8,
          transparent: true,
          opacity: 0,
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -0.01;
        floor.receiveShadow = true;
        scene.add(floor);

        const starGeo = new THREE.BufferGeometry();
        const starCount = 120;
        const starPos = new Float32Array(starCount * 3);
        for (let index = 0; index < starCount * 3; index += 1) {
          starPos[index] = (Math.random() - 0.5) * 20;
        }
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({
          color: 0xf5c842,
          size: 0.06,
          transparent: true,
          opacity: 0.5,
        });
        scene.add(new THREE.Points(starGeo, starMat));

        const avatarGroups: Array<{ group: any; height: number; index: number }> = [];
        const crownMeshes: any[] = [];
        const confettiColors = [0xf5c842, 0xff6b6b, 0x4ecdc4, 0xa8e6cf, 0xffd93d];

        podiumData.forEach((podiumEntry, index) => {
          const podiumColor = new THREE.Color(podiumEntry.color);
          const podiumWidth = 1.5;
          const podiumDepth = 1.5;

          const pedestal = new THREE.Mesh(
            new THREE.BoxGeometry(podiumWidth, podiumEntry.height, podiumDepth),
            new THREE.MeshLambertMaterial({ color: podiumColor })
          );
          pedestal.position.set(podiumEntry.pos, podiumEntry.height / 2, 0);
          pedestal.castShadow = true;
          pedestal.receiveShadow = true;
          scene.add(pedestal);

          const cap = new THREE.Mesh(
            new THREE.BoxGeometry(podiumWidth + 0.08, 0.07, podiumDepth + 0.08),
            new THREE.MeshLambertMaterial({ color: podiumColor.clone().multiplyScalar(1.15) })
          );
          cap.position.set(podiumEntry.pos, podiumEntry.height + 0.035, 0);
          scene.add(cap);

          const avatarGroup = new THREE.Group();
          avatarGroup.position.set(podiumEntry.pos, podiumEntry.height + 0.54, 0);

          const sphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.42, 40, 40),
            new THREE.MeshStandardMaterial({
              color: podiumColor.clone().multiplyScalar(0.94),
              roughness: 0.38,
              metalness: 0.12,
              emissive: podiumColor.clone().multiplyScalar(0.08),
            })
          );
          sphere.castShadow = true;
          avatarGroup.add(sphere);

          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(0.45, 0.03, 10, 48),
            new THREE.MeshLambertMaterial({
              color: 0xfff3cf,
            })
          );
          halo.rotation.x = Math.PI / 2;
          halo.position.z = 0.03;
          avatarGroup.add(halo);

          scene.add(avatarGroup);
          avatarGroups.push({ group: avatarGroup, height: podiumEntry.height, index });

          if (podiumEntry.profilePhotoUrl) {
            void applyPhotoBadge(THREE, podiumEntry.profilePhotoUrl).then((photoBadge) => {
              if (!photoBadge || cancelled) {
                return;
              }
              photoBadge.position.set(0, 0, 0.3);
              avatarGroup.add(photoBadge);
            });
          } else {
            const sprite = createInitialSprite(THREE, podiumEntry.avatar);
            sprite.position.set(0, 0, 0.45);
            sprite.scale.set(0.34, 0.34, 1);
            avatarGroup.add(sprite);
          }

          const medal = createMedalMesh(
            THREE,
            medalConfigs[podiumEntry.rank]?.label ?? String(podiumEntry.rank),
            medalConfigs[podiumEntry.rank]?.color ?? podiumColor.getHex()
          );
          medal.position.set(podiumEntry.pos, podiumEntry.height + 1.12, 0.18);
          scene.add(medal);

          if (podiumEntry.rank === 1) {
            const crown = new THREE.Mesh(
              new THREE.ConeGeometry(0.18, 0.32, 5),
              new THREE.MeshLambertMaterial({ color: 0xf5c842 })
            );
            crown.position.set(podiumEntry.pos, podiumEntry.height + 1.38, 0);
            scene.add(crown);
            crownMeshes.push(crown);
          }

          const ribbon = new THREE.Mesh(
            new THREE.TorusGeometry(0.24, 0.04, 8, 32),
            new THREE.MeshLambertMaterial({ color: 0xffffff })
          );
          ribbon.position.set(podiumEntry.pos, podiumEntry.height / 2, podiumDepth / 2 + 0.01);
          ribbon.rotation.x = Math.PI / 2;
          scene.add(ribbon);
        });

        const confettiGroup = new THREE.Group();
        for (let index = 0; index < 40; index += 1) {
          const size = 0.06 + Math.random() * 0.08;
          const confetti = new THREE.Mesh(
            new THREE.BoxGeometry(size, size * 0.3, size * 0.1),
            new THREE.MeshLambertMaterial({
              color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
            })
          );
          confetti.position.set(
            (Math.random() - 0.5) * 7,
            0.5 + Math.random() * 4,
            (Math.random() - 0.5) * 3
          );
          confetti.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
          (confetti as any).speed = 0.005 + Math.random() * 0.01;
          (confetti as any).rotSpeed = (Math.random() - 0.5) * 0.04;
          confettiGroup.add(confetti);
        }
        scene.add(confettiGroup);

        let time = 0;
        const topRank = podiumData.find((entry) => entry.rank === 1);

        function animate() {
          if (cancelled) return;
          animId = requestAnimationFrame(animate);
          time += 0.016;

          avatarGroups.forEach(({ group, height: groupHeight, index }) => {
            group.position.y = groupHeight + 0.54 + Math.sin(time * 1.2 + index * 1.4) * 0.08;
            group.rotation.y += 0.008;
          });

          crownMeshes.forEach((crown) => {
            crown.position.y = (topRank?.height ?? 1.9) + 1.38 + Math.sin(time * 1.2) * 0.08;
            crown.rotation.y += 0.02;
          });

          confettiGroup.children.forEach((child: any) => {
            child.position.y -= child.speed;
            child.rotation.x += child.rotSpeed;
            child.rotation.z += child.rotSpeed * 0.7;
            if (child.position.y < -0.5) {
              child.position.y = 4.5;
            }
          });

          camera.position.x = Math.sin(time * 0.12) * 1.2;
          camera.lookAt(0, 1, 0);
          renderer.render(scene, camera);
        }

        animate();

        onResize = () => {
          const nextWidth = el.clientWidth;
          const nextHeight = el.clientHeight || 360;
          const nextAspect = nextWidth / nextHeight;
          camera.aspect = nextAspect;
          camera.fov = nextAspect < 1 ? 52 : nextAspect < 1.3 ? 46 : 42;
          camera.position.z = nextAspect < 1 ? 9.5 : nextAspect < 1.3 ? 9.2 : 9;
          camera.updateProjectionMatrix();
          renderer.setSize(nextWidth, nextHeight);
        };

        window.addEventListener("resize", onResize);
      })
      .catch(() => {
        if (!cancelled) {
          el.setAttribute("data-three-error", "true");
        }
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      if (onResize) {
        window.removeEventListener("resize", onResize);
      }
      if (renderer) {
        renderer.dispose();
        if (el.contains(renderer.domElement)) {
          el.removeChild(renderer.domElement);
        }
      }
    };
  }, [podiumData]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", minHeight: 360, borderRadius: 16 }} />;
}

async function applyPhotoBadge(THREE: any, url: string) {
  try {
    const texture = await createProfileTexture(THREE, url);
    const badgeGroup = new THREE.Group();

    const badge = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 48),
      new THREE.MeshLambertMaterial({
        map: texture,
      })
    );
    badge.castShadow = true;
    badgeGroup.add(badge);

    const frame = new THREE.Mesh(
      new THREE.TorusGeometry(0.29, 0.018, 12, 48),
      new THREE.MeshLambertMaterial({
        color: 0xfff6db,
      })
    );
    badgeGroup.add(frame);

    return badgeGroup;
  } catch {
    return null;
  }
}

function createProfileTexture(THREE: any, url: string) {
  return new Promise<any>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      const size = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height) || 256;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Canvas unavailable"));
        return;
      }

      const sourceX = ((image.naturalWidth || image.width) - size) / 2;
      const sourceY = ((image.naturalHeight || image.height) - size) / 2;

      context.clearRect(0, 0, 256, 256);
      context.save();
      context.beginPath();
      context.arc(128, 128, 120, 0, Math.PI * 2);
      context.closePath();
      context.clip();
      context.drawImage(image, sourceX, sourceY, size, size, 0, 0, 256, 256);
      context.restore();

      const texture = new THREE.CanvasTexture(canvas);
      texture.encoding = THREE.sRGBEncoding;
      texture.needsUpdate = true;
      resolve(texture);
    };
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
}

function createInitialSprite(THREE: any, initials: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Sprite();
  }

  context.fillStyle = "rgba(255,248,232,0.94)";
  context.beginPath();
  context.arc(64, 64, 56, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#1a1000";
  context.font = "700 42px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(initials, 64, 68);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  return new THREE.Sprite(material);
}

function createMedalMesh(THREE: any, label: string, color: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) {
    return new THREE.Group();
  }

  const gradient = context.createRadialGradient(96, 86, 18, 96, 96, 90);
  gradient.addColorStop(0, "#fff9db");
  gradient.addColorStop(0.45, `#${color.toString(16).padStart(6, "0")}`);
  gradient.addColorStop(1, "#5b3a03");

  context.fillStyle = gradient;
  context.beginPath();
  context.arc(96, 96, 74, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = "rgba(255,255,255,0.75)";
  context.lineWidth = 10;
  context.stroke();

  context.fillStyle = "#1f1200";
  context.font = "700 72px Georgia";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, 96, 104);

  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  const medal = new THREE.Mesh(
    new THREE.CircleGeometry(0.26, 40),
    new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      roughness: 0.25,
      metalness: 0.45,
      emissive: new THREE.Color(color).multiplyScalar(0.15),
    })
  );

  const ribbonLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.2, 0.02),
    new THREE.MeshLambertMaterial({ color: 0x7c3aed })
  );
  ribbonLeft.position.set(-0.08, -0.18, -0.01);

  const ribbonRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.2, 0.02),
    new THREE.MeshLambertMaterial({ color: 0xdc2626 })
  );
  ribbonRight.position.set(0.08, -0.18, -0.01);

  const group = new THREE.Group();
  group.add(medal);
  group.add(ribbonLeft);
  group.add(ribbonRight);
  return group;
}
