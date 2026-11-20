"use client";

import { useEffect, useRef } from "react";

type Point = [number, number];
type Polygon = Point[];

const LAND: Polygon[] = [
  // North America
  [[-168,70],[-150,72],[-135,68],[-128,58],[-124,50],[-128,42],[-123,32],[-115,29],[-108,23],[-100,19],[-92,16],[-86,19],[-83,25],[-80,30],[-75,36],[-68,45],[-60,52],[-58,60],[-75,68],[-95,73],[-120,75],[-145,73]],
  // Greenland
  [[-53,83],[-35,82],[-22,75],[-30,60],[-45,59],[-58,65],[-62,73]],
  // Central America
  [[-92,18],[-86,16],[-83,10],[-78,8],[-77,4],[-82,7],[-87,12]],
  // South America
  [[-81,12],[-70,10],[-62,8],[-50,2],[-45,-5],[-49,-15],[-54,-23],[-58,-34],[-66,-55],[-72,-52],[-75,-40],[-79,-20],[-81,-5]],
  // Europe
  [[-11,36],[-10,44],[-5,48],[2,51],[8,55],[14,55],[20,60],[29,60],[33,55],[28,49],[24,45],[18,40],[12,37],[4,36]],
  // Scandinavia
  [[5,58],[10,70],[20,71],[30,65],[25,58],[17,55]],
  // Africa
  [[-17,36],[-5,37],[10,36],[25,32],[34,30],[42,12],[50,10],[44,-12],[36,-22],[28,-34],[18,-35],[12,-28],[5,-20],[-1,-5],[-9,5],[-16,15]],
  // Asia
  [[30,40],[36,48],[45,52],[55,55],[65,58],[75,60],[90,60],[105,60],[120,55],[135,50],[145,45],[155,55],[165,60],[178,60],[180,48],[165,42],[150,38],[140,34],[130,30],[122,22],[115,18],[108,10],[102,5],[95,8],[88,20],[80,25],[72,22],[65,25],[58,28],[50,30],[44,34]],
  // Arabian peninsula / India
  [[35,30],[48,30],[56,24],[54,16],[48,12],[43,16],[39,22]],
  [[68,24],[78,30],[88,27],[92,20],[85,8],[78,6],[73,14]],
  // Japan
  [[130,34],[136,38],[141,44],[145,43],[143,35],[138,31]],
  // South East Asia
  [[96,18],[105,20],[111,15],[119,8],[117,0],[108,-5],[103,2]],
  // Indonesia
  [[95,5],[108,5],[118,-2],[130,-4],[140,-7],[132,-10],[120,-8],[110,-7],[101,-3]],
  // Australia
  [[113,-11],[130,-10],[143,-14],[153,-25],[150,-38],[137,-43],[120,-34],[114,-24]],
  // Madagascar
  [[48,-13],[51,-17],[50,-25],[46,-23]],
  // UK / Ireland
  [[-11,50],[-6,58],[-2,55],[-4,51]],
];

function inside(point: Point, polygon: Polygon) {
  const [x, y] = point;
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const crosses = (yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) hit = !hit;
  }
  return hit;
}

function landAt(lon: number, lat: number) {
  return LAND.some((polygon) => inside([lon, lat], polygon));
}

export default function DigitalGlobe() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: import("three").WebGLRenderer | undefined;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void import("three").then((THREE) => {
      if (disposed || !host) return;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#000000");
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0, 4.25);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
      renderer.setClearColor("#000000", 1);
      host.appendChild(renderer.domElement);

      const globe = new THREE.Group();
      scene.add(globe);

      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1, 64, 48),
        new THREE.MeshBasicMaterial({ color: "#050705" })
      );
      globe.add(sphere);

      const positions: number[] = [];
      const colors: number[] = [];
      const base = new THREE.Color("#d4ff00");
      for (let lat = -58; lat <= 82; lat += 3.4) {
        const rowOffset = (Math.round((lat + 90) / 3.4) % 2) * 1.7;
        for (let lon = -180 + rowOffset; lon < 180; lon += 3.4) {
          if (!landAt(lon, lat)) continue;
          const phi = THREE.MathUtils.degToRad(90 - lat);
          const theta = THREE.MathUtils.degToRad(lon + 180);
          const radius = 1.008;
          positions.push(
            -radius * Math.sin(phi) * Math.cos(theta),
            radius * Math.cos(phi),
            radius * Math.sin(phi) * Math.sin(theta)
          );
          const tint = base.clone().multiplyScalar(0.82 + ((Math.abs(Math.round(lon * 7 + lat * 11)) % 18) / 100));
          colors.push(tint.r, tint.g, tint.b);
        }
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      const dots = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          size: 0.026,
          sizeAttenuation: true,
          vertexColors: true,
          transparent: false,
          depthTest: true,
          depthWrite: true,
          toneMapped: false
        })
      );
      globe.add(dots);

      const resize = () => {
        if (!renderer || !host) return;
        const width = Math.max(1, host.clientWidth);
        const height = Math.max(1, host.clientHeight);
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      };
      observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const animate = () => {
        if (disposed || !renderer) return;
        globe.rotation.y += 0.0022;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(animate);
      };
      animate();

      cleanup = () => {
        window.cancelAnimationFrame(frame);
        observer?.disconnect();
        geometry.dispose();
        (dots.material as THREE.Material).dispose();
        sphere.geometry.dispose();
        (sphere.material as THREE.Material).dispose();
        renderer?.dispose();
        renderer?.domElement.remove();
      };
    }).catch((error) => {
      console.error("[Bmg Globe] Unable to initialize WebGL globe", error);
    });

    return () => {
      disposed = true;
      cleanup?.();
      observer?.disconnect();
    };
  }, []);

  return <div ref={hostRef} className="source-globe source-dot-globe source-globe-3d" role="img" aria-label="كرة أرضية ثلاثية الأبعاد من نقاط ليمونية تدور حول محورها" />;
}
