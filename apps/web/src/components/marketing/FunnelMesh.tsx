"use client";

import { useEffect, useRef, type RefObject } from "react";

type Progress = RefObject<number>;
const REDUCED = "(prefers-reduced-motion: reduce)";
const LEVELS = [3.2, 1.92, .64, -.64, -1.92, -3.2];
const LEAD_Y = [3.85, 2.5, 1.2, -.08, -1.38, -4.05];
export const radiusAt = (y: number) => {
  const t = Math.max(0, Math.min(1, (y + 3.2) / 6.4));
  return .24 + 2.81 * t * t * (2 - t);
};

/** A real triangulated 3D surface. SVG remains underneath as the no-WebGL fallback. */
export default function FunnelMesh({ progress }: { progress: Progress }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const host = canvas.parentElement!;
    const reduced = window.matchMedia(REDUCED);
    let cancelled = false, started = false;
    let dispose = () => {};
    const start = async () => {
      if (started || cancelled) return;
      started = true;
      try {
        const THREE = await import("three");
        if (cancelled) return;
        const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
        if (!context) return;
        const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        renderer.setClearColor(0x000000, 0);
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(37, 650 / 560, .1, 80);
        camera.position.set(0, 6.2, 13);
        camera.lookAt(0, -.45, 0);
        const rig = new THREE.Group();
        rig.position.x = -.65;
        scene.add(rig);

        // Each quad is triangulated: both near and far faces make the mesh volumetric.
        const rows = 24, columns = 40;
        const vertices: number[] = [], indices: number[] = [];
        for (let row = 0; row <= rows; row++) {
          const y = 3.2 - row / rows * 6.4, radius = radiusAt(y);
          for (let column = 0; column <= columns; column++) {
            const angle = column / columns * Math.PI * 2;
            vertices.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            if (row < rows && column < columns) {
              const a = row * (columns + 1) + column, b = a + columns + 1;
              indices.push(a, b, a + 1, a + 1, b, b + 1);
            }
          }
        }
        const surface = new THREE.BufferGeometry();
        surface.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
        surface.setIndex(indices);
        surface.computeVertexNormals();
        const glassMaterial = new THREE.ShaderMaterial({
          vertexShader: `varying vec3 vNormal; varying vec3 vView; varying float vHeight;
            void main() { vec4 view = modelViewMatrix * vec4(position, 1.);
              vNormal = normalize(normalMatrix * normal); vView = -view.xyz;
              vHeight = (position.y + 3.2) / 6.4; gl_Position = projectionMatrix * view; }`,
          fragmentShader: `varying vec3 vNormal; varying vec3 vView; varying float vHeight;
            void main() { float rim = pow(1. - abs(dot(normalize(vNormal), normalize(vView))), 2.);
              vec3 color = mix(vec3(.42,.32,.85), vec3(.16,.8,.95), vHeight);
              gl_FragColor = vec4(color + rim * .18, .07 + rim * .32); }`,
          transparent: true, side: THREE.DoubleSide, depthWrite: false,
        });
        const glass = new THREE.Mesh(surface, glassMaterial);
        rig.add(glass);
        const wireGeometry = new THREE.WireframeGeometry(surface);
        const wirePositions = wireGeometry.getAttribute("position");
        const colors = [];
        for (let i = 0; i < wirePositions.count; i++) {
          const front = .28 + .72 * Math.max(0, wirePositions.getZ(i) / Math.max(.2, radiusAt(wirePositions.getY(i))));
          colors.push(.09 * front, .7 * front, .95 * front);
        }
        wireGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        rig.add(new THREE.LineSegments(wireGeometry, new THREE.LineBasicMaterial({
          vertexColors: true, transparent: true, opacity: .085, blending: THREE.AdditiveBlending, depthWrite: false,
        })));

        const rings = LEVELS.map((y, i) => {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(radiusAt(y), i === 0 ? .018 : .012, 6, 128),
            new THREE.MeshBasicMaterial({ color: 0x47c9ef, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          ring.rotation.x = Math.PI / 2;
          ring.position.y = y;
          rig.add(ring);
          const glow = new THREE.Mesh(
            new THREE.TorusGeometry(radiusAt(y), .055, 8, 96),
            new THREE.MeshBasicMaterial({ color: i === 2 || i === 3 ? 0xa493ff : 0x67dfff, transparent: true, opacity: .065, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          glow.rotation.x = Math.PI / 2; glow.position.y = y; rig.add(glow);
          return ring;
        });
        // Thin internal rails show the depth through the transparent outer mesh.
        for (let i = 0; i < 8; i++) {
          const points = LEVELS.map(y => new THREE.Vector3(
            Math.cos(i * Math.PI / 4) * radiusAt(y) * .94,
            y,
            Math.sin(i * Math.PI / 4) * radiusAt(y) * .94,
          ));
          rig.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),
            new THREE.LineBasicMaterial({ color: 0x5dcbea, transparent: true, opacity: .09, blending: THREE.AdditiveBlending })));
        }
        const bandMeshes = Array.from({ length: 5 }, (_, i) => {
          const profile = Array.from({ length: 9 }, (_, row) => {
            const y = LEVELS[i + 1]! + row / 8 * 1.28;
            return new THREE.Vector2(radiusAt(y) * 1.002, y);
          });
          const mesh = new THREE.Mesh(
            new THREE.LatheGeometry(profile, 64),
            new THREE.MeshBasicMaterial({ color: i === 2 ? 0xa284ff : 0x18caec, transparent: true, opacity: .018, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
          );
          rig.add(mesh);
          return mesh;
        });

        const ledVertices: number[] = [], phases: number[] = [];
        for (let row = 0; row < 8; row++) {
          const y = 3.12 - row * .8, radius = radiusAt(y);
          for (let column = 0; column < 6; column++) {
            const angle = column / 6 * Math.PI * 2 + (row % 2) * .12;
            ledVertices.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
            phases.push(row * 1.7 + column * .9);
          }
        }
        const ledGeometry = new THREE.BufferGeometry();
        ledGeometry.setAttribute("position", new THREE.Float32BufferAttribute(ledVertices, 3));
        ledGeometry.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1));
        const ledMaterial = new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 }, dim: { value: 1 } },
          vertexShader: "attribute float phase; varying float vPhase; varying float vDepth; void main(){vPhase=phase; vec4 p=modelViewMatrix*vec4(position,1.); vDepth=clamp(12./-p.z,.6,1.6); gl_Position=projectionMatrix*p; gl_PointSize=14.*vDepth;}",
          fragmentShader: "uniform float time; uniform float dim; varying float vPhase; varying float vDepth; void main(){float r=length(gl_PointCoord-.5)*2.; float glow=exp(-r*r*5.); float core=1.-smoothstep(.03,.19,r); float pulse=.65+.35*sin(time*1.1+vPhase); gl_FragColor=vec4(vec3(.13,.82,1.)+core*.6,(glow*.55+core*.6)*pulse*dim*vDepth);}",
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        rig.add(new THREE.Points(ledGeometry, ledMaterial));

        // A translucent collection bucket beneath the curved funnel outlet.
        const bucket = new THREE.Group();
        bucket.position.y = -4.15;
        const bucketWall = new THREE.Mesh(
          new THREE.CylinderGeometry(.95, .73, .64, 64, 1, true),
          glassMaterial,
        );
        bucket.add(bucketWall);
        const bucketRimMaterial = new THREE.MeshBasicMaterial({ color: 0x76d9ef, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false });
        for (const [y, radius] of [[.32, .95], [-.32, .73]]) {
          const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, .018, 8, 96), bucketRimMaterial);
          rim.rotation.x = Math.PI / 2; rim.position.y = y!; bucket.add(rim);
        }
        const bucketPool = new THREE.Mesh(new THREE.CircleGeometry(.73, 64), new THREE.MeshBasicMaterial({
          color: 0x4ccbe9, transparent: true, opacity: .09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending,
        }));
        bucketPool.rotation.x = -Math.PI / 2; bucketPool.position.y = -.31; bucket.add(bucketPool);
        rig.add(bucket);

        const lead = new THREE.Group();
        const bead = new THREE.Mesh(new THREE.SphereGeometry(.066, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff0b8 }));
        lead.add(bead);
        const haloMaterial = new THREE.ShaderMaterial({
          uniforms: { time: { value: 0 } },
          vertexShader: "void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); gl_PointSize=64.;}",
          fragmentShader: "uniform float time; void main(){float r=length(gl_PointCoord-.5)*2.; float glow=exp(-r*r*5.); float ring=exp(-pow((r-.34)*20.,2.))*.22; gl_FragColor=vec4(1.,.56,.08,(glow*.6+ring)*(.88+.12*sin(time*2.)));}",
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        });
        lead.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]), haloMaterial));
        rig.add(lead);
        const trailGeometry = new THREE.BufferGeometry();
        const trailBuffer = new Float32Array(80 * 3);
        trailGeometry.setAttribute("position", new THREE.BufferAttribute(trailBuffer, 3));
        const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({
          color: 0xf4b858, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        rig.add(trail);
        const pathPoint = (p: number) => {
          const index = Math.min(4, Math.floor(p)), fraction = p - index;
          const y = THREE.MathUtils.lerp(LEAD_Y[index]!, LEAD_Y[index + 1]!, fraction);
          const radius = radiusAt(y);
          return new THREE.Vector3(Math.sin(p * 1.1) * radius * .19, y, radius * .5);
        };
        let frame = 0, inView = true, contextLost = false;
        const projected = new THREE.Vector3();
        const project = (point: import("three").Vector3) => {
          projected.copy(point);
          rig.localToWorld(projected);
          projected.project(camera);
          return { x: (projected.x + 1) * 325, y: (1 - projected.y) * 280 };
        };
        const draw = (now: number) => {
          frame = 0;
          if (cancelled || !inView || contextLost || document.hidden) return;
          const value = Math.max(0, Math.min(5, progress.current));
          const stage = Math.min(5, Math.floor(value + .002));
          const p = reduced.matches ? stage : value;
          const time = reduced.matches ? 0 : p * .6;
          // Bounded parallax reveals depth, driven only by document scroll.
          rig.rotation.set(.03, -.17 + (reduced.matches ? 0 : p * .035), -.035);
          rig.position.y = reduced.matches ? 0 : -p * .025;
          lead.position.copy(pathPoint(p));
          ledMaterial.uniforms["time"]!.value = time;
          ledMaterial.uniforms["dim"]!.value = stage >= 2 ? .25 : .7;
          haloMaterial.uniforms["time"]!.value = time;
          bucketRimMaterial.color.set(stage === 5 ? 0xffce78 : 0x76d9ef);
          bucketPool.material.color.set(stage === 5 ? 0xf5b858 : 0x4ccbe9);
          bucketPool.material.opacity = stage === 5 ? .28 : .09;
          rings.forEach((ring, i) => {
            const active = stage > 0 && (i === stage - 1 || i === stage);
            ring.material.color.set(active && stage === 3 ? 0xbd9bff : 0x51dcff);
            ring.material.opacity = active ? .9 : .48;
          });
          bandMeshes.forEach((band, i) => { band.material.opacity = stage === i + 1 ? .09 : stage > i + 1 ? .026 : .012; });
          for (let i = 0; i < 80; i++) {
            const point = pathPoint(p * i / 79);
            trailBuffer.set([point.x, point.y, point.z], i * 3);
          }
          trailGeometry.attributes["position"]!.needsUpdate = true;
          trail.visible = p > 0;
          renderer.render(scene, camera);
          host.dataset["meshReady"] = "true";
          canvas.dataset["renderProgress"] = String(p);
          canvas.dataset["renderFrame"] = String(now);
          {
            rig.updateWorldMatrix(true, false);
            const marker = project(lead.position);
            host.querySelector<SVGGElement>("[data-prospect]")?.style.setProperty("transform", "translate(" + marker.x + "px, " + marker.y + "px)");
            const y = Math.min(2.5, Math.max(-2.8, LEAD_Y[stage]!));
            const anchor = project(new THREE.Vector3(-radiusAt(y), y, 0));
            const attachment = host.querySelector<SVGCircleElement>("[data-attachment]");
            attachment?.setAttribute("cx", String(anchor.x));
            attachment?.setAttribute("cy", String(anchor.y));
            host.querySelectorAll<SVGGElement>("[data-band-label]").forEach((label, i) => {
              const bandY = (LEVELS[i]! + LEVELS[i + 1]!) / 2;
              const point = project(new THREE.Vector3(radiusAt(bandY), bandY, 0));
              label.setAttribute("transform", "translate(" + point.x + "," + point.y + ")");
            });
            const collector = project(new THREE.Vector3(0, -4.95, .9));
            const collectorLabel = host.querySelector<HTMLElement>("[data-collector-label]");
            collectorLabel?.style.setProperty("left", collector.x / 650 * 100 + "%");
            collectorLabel?.style.setProperty("top", collector.y / 560 * 100 + "%");
            host.dispatchEvent(new Event("funnelprojection", { bubbles: true }));
          }
        };
        const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
        const resize = () => {
          if (!host.clientWidth || !host.clientHeight) return;
          renderer.setSize(host.clientWidth, host.clientHeight, false);
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
          schedule();
        };
        const observer = new ResizeObserver(resize); observer.observe(host);
        const intersection = new IntersectionObserver(([entry]) => { inView = !!entry?.isIntersecting; if (inView) schedule(); });
        intersection.observe(host);
        const lost = (event: Event) => {
          event.preventDefault(); contextLost = true; delete host.dataset["meshReady"];
          cancelAnimationFrame(frame); frame = 0;
          host.closest("[data-stage]")?.dispatchEvent(new Event("funnelfallback"));
        };
        const restored = () => { contextLost = false; schedule(); };
        canvas.addEventListener("webglcontextlost", lost);
        canvas.addEventListener("webglcontextrestored", restored);
        window.addEventListener("scroll", schedule, { passive: true });
        host.closest("[data-stage]")?.addEventListener("journeyprogress", schedule);
        document.addEventListener("visibilitychange", schedule);
        reduced.addEventListener("change", schedule);
        resize();
        dispose = () => {
          cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect();
          window.removeEventListener("scroll", schedule); document.removeEventListener("visibilitychange", schedule);
          host.closest("[data-stage]")?.removeEventListener("journeyprogress", schedule);
          reduced.removeEventListener("change", schedule);
          canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("webglcontextrestored", restored);
          const geometries = new Set<import("three").BufferGeometry>();
          const materials = new Set<import("three").Material>();
          scene.traverse(object => {
            const mesh = object as import("three").Mesh;
            if (mesh.geometry) geometries.add(mesh.geometry);
            if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(material => materials.add(material));
          });
          geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
          renderer.dispose(); renderer.forceContextLoss(); delete host.dataset["meshReady"];
        };
      } catch {
        // A detailed SVG mesh remains fully usable if GPU initialization is unavailable.
        delete host.dataset["meshReady"];
      }
    };
    void start();
    return () => { cancelled = true; dispose(); };
  }, [progress]);
  return <canvas ref={canvasRef} data-funnel-mesh aria-hidden="true"/>;
}

/** Deterministic stars and orbital construction lines, with scroll-driven depth. */
export function Universe({ progress }: { progress: Progress }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!, context = canvas.getContext("2d");
    if (!context) return;
    const reduced = window.matchMedia(REDUCED);
    let seed = 817;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const stars = Array.from({ length: 80 }, () => ({ x: random() * 2 - 1, y: random() * 2 - 1, z: random(), size: .4 + random() * 1.1, phase: random() * 6.28 }));
    let width = 1, height = 1, frame = 0, visible = true;
    const draw = (now: number) => {
      frame = 0;
      if (!visible || document.hidden) return;
      const moving = !reduced.matches;
      {
        const time = moving ? progress.current * .012 : 0;
        const p = moving ? progress.current : 0;
        context.clearRect(0, 0, width, height);
        for (const star of stars) {
          const depth = .35 + ((star.z + time) % 1) * 1.4;
          const x = width * .65 + star.x * width * .65 / depth;
          const y = height * .5 + (star.y * height * .7 - p * 24) / depth;
          const size = star.size / depth;
          const alpha = (.35 + .3 * Math.sin(star.phase + time * 35)) / depth;
          context.fillStyle = "rgba(129,201,255," + Math.min(.8, alpha) + ")";
          context.beginPath(); context.arc(x, y, size, 0, Math.PI * 2); context.fill();
          if (star.size > 1.25) {
            context.fillStyle = "rgba(73,167,255," + alpha * .09 + ")";
            context.beginPath(); context.arc(x, y, size * 4, 0, Math.PI * 2); context.fill();
          }
        }
        // A sparse, projected orbital cage and two wireframe satellites.
        context.save();
        context.translate(width * .73, height * .49 - p * 3);
        context.rotate(-.16 + p * .009);
        context.strokeStyle = "rgba(97,166,214,.18)";
        context.lineWidth = .7;
        for (let i = 0; i < 3; i++) {
          context.beginPath();
          context.ellipse(0, 0, width * (.25 + i * .055), height * (.18 + i * .06), -.3 + i * .3, .2, Math.PI * 1.85);
          context.stroke();
        }
        context.restore();
        for (let i = 0; i < 2; i++) {
          const x = width * (i ? .9 : .47), y = height * (i ? .82 : .12) - p * (i ? 5 : -3), r = i ? 24 : 18;
          context.strokeStyle = i ? "rgba(161,132,236,.22)" : "rgba(100,190,232,.24)";
          context.beginPath();
          context.moveTo(x, y-r); context.lineTo(x+r, y); context.lineTo(x,y+r); context.lineTo(x-r,y); context.closePath();
          context.moveTo(x,y-r); context.lineTo(x+4,y+3); context.lineTo(x,y+r);
          context.moveTo(x-r,y); context.lineTo(x+4,y+3); context.lineTo(x+r,y);
          context.stroke();
        }
        canvas.dataset["universeFrame"] = String(Math.round(now));
      }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const resize = () => {
      width = canvas.clientWidth; height = canvas.clientHeight;
      const ratio = Math.min(devicePixelRatio, 1.5);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0); schedule();
    };
    const observer = new ResizeObserver(resize); observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = !!entry?.isIntersecting; if (visible) schedule(); });
    intersection.observe(canvas);
    window.addEventListener("scroll", schedule, { passive: true });
    canvas.closest("[data-stage]")?.addEventListener("journeyprogress", schedule);
    document.addEventListener("visibilitychange", schedule); reduced.addEventListener("change", schedule);
    resize();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); window.removeEventListener("scroll", schedule); canvas.closest("[data-stage]")?.removeEventListener("journeyprogress", schedule); document.removeEventListener("visibilitychange", schedule); reduced.removeEventListener("change", schedule); };
  }, [progress]);
  return <canvas ref={canvasRef} data-universe aria-hidden="true"/>;
}
