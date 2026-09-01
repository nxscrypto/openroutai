'use client';

import { useEffect, useRef } from 'react';

/**
 * Hero canvas — the animated node-orbit visualization described in the README.
 * Composition (in draw order):
 *   1. Ambient drifting spheres
 *   2. 7 model nodes on elliptical orbits around center
 *   3. Quadratic-bezier edges from center to each node
 *   4. Glowing data packets traveling center -> node along each edge
 *   5. Model nodes (radial glow + solid core)
 *   6. Core sphere (radial gradient + halo + 3 stroked rings rotating)
 *
 * Honors prefers-reduced-motion by holding a static frame.
 */
export default function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const accent = '#d6f43a';
    const accentCore = '#f2ffc4';
    const accentHover = '#eaffa0';

    let raf = 0;
    let stopped = false;
    let W = 0, H = 0, DPR = 1;
    const start = performance.now();
    let lastT = start;

    // 7 nodes with slight per-node variation
    const nodes = Array.from({ length: 7 }, (_, i) => {
      const radius = 0.30 + (i % 3) * 0.055;
      const phase = (i / 7) * Math.PI * 2;
      const speed = 0.00016 + (i % 4) * 0.00007;
      return { radius, phase, speed, glowR: (5 + (i % 3)) * 3.4 };
    });

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      W = rect.width;
      H = rect.height;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // packet state: each edge has a traveling packet
    const packets = nodes.map(() => ({ t: Math.random(), speed: 0.0022 + Math.random() * 0.0032 }));

    function frame(now: number) {
      if (stopped) return;
      const dt = now - lastT;
      lastT = now;
      const t = now - start;
      if (!ctx) return;
      ctx.clearRect(0, 0, W, H);

      const cx = W * 0.62, cy = H * 0.46;
      const minSide = Math.min(W, H);

      // 1. Ambient drifting spheres
      const drift = (k: number) => Math.sin(t * 0.00018 + k) * 22;
      const ambient: Array<[number, number, number, string]> = [
        [W * 0.18, H * 0.30 + drift(1), minSide * 0.34, 'rgba(214,244,58,0.055)'],
        [W * 0.85, H * 0.18 + drift(2), minSide * 0.26, 'rgba(127,214,255,0.05)'],
        [W * 0.55, H * 0.86 + drift(3), minSide * 0.30, 'rgba(214,244,58,0.035)'],
      ];
      for (const [ax, ay, ar, color] of ambient) {
        const grad = ctx.createRadialGradient(ax, ay, 0, ax, ay, ar);
        grad.addColorStop(0, color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(ax, ay, ar, 0, Math.PI * 2);
        ctx.fill();
      }

      // compute node positions
      const positions = nodes.map((n) => {
        const angle = n.phase + t * n.speed;
        const rx = minSide * n.radius * 1.35;
        const ry = minSide * n.radius * 0.72;
        return { x: cx + Math.cos(angle) * rx, y: cy + Math.sin(angle) * ry, glowR: n.glowR };
      });

      // 3. Edges (center -> node)
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.055)';
      for (const p of positions) {
        const mx = (cx + p.x) / 2;
        const my = (cy + p.y) / 2 - minSide * 0.10;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.quadraticCurveTo(mx, my, p.x, p.y);
        ctx.stroke();
      }

      if (!reduce) {
        // 4. Data packets
        for (let i = 0; i < packets.length; i++) {
          packets[i].t += (dt / 1000) * packets[i].speed * 60;
          if (packets[i].t > 1) packets[i].t -= 1;
          const tt = packets[i].t;
          const p = positions[i];
          const mx = (cx + p.x) / 2;
          const my = (cy + p.y) / 2 - minSide * 0.10;
          const px = (1 - tt) * (1 - tt) * cx + 2 * (1 - tt) * tt * mx + tt * tt * p.x;
          const py = (1 - tt) * (1 - tt) * cy + 2 * (1 - tt) * tt * my + tt * tt * p.y;
          // glow halo
          const pg = ctx.createRadialGradient(px, py, 0, px, py, 16);
          pg.addColorStop(0, accent);
          pg.addColorStop(1, 'rgba(214,244,58,0)');
          ctx.fillStyle = pg;
          ctx.beginPath();
          ctx.arc(px, py, 16, 0, Math.PI * 2);
          ctx.fill();
          // bright core
          ctx.fillStyle = accentCore;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 5. Model nodes
      for (const p of positions) {
        const ng = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.glowR);
        ng.addColorStop(0, 'rgba(255,255,255,0.9)');
        ng.addColorStop(0.4, 'rgba(214,244,58,0.35)');
        ng.addColorStop(1, 'rgba(214,244,58,0)');
        ctx.fillStyle = ng;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.glowR, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = accentHover;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Core sphere
      const cr = minSide * 0.10;
      const cg = ctx.createRadialGradient(cx - cr * 0.15, cy - cr * 0.18, cr * 0.05, cx, cy, cr);
      cg.addColorStop(0, 'rgba(245,255,205,0.95)');
      cg.addColorStop(0.35, 'rgba(214,244,58,0.5)');
      cg.addColorStop(0.75, 'rgba(48,66,16,0.55)');
      cg.addColorStop(1, 'rgba(7,8,10,0.05)');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();

      // halo
      const hg = ctx.createRadialGradient(cx, cy, cr * 0.8, cx, cy, cr * 2.6);
      hg.addColorStop(0, 'rgba(214,244,58,0.14)');
      hg.addColorStop(1, 'rgba(214,244,58,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(cx, cy, cr * 2.6, 0, Math.PI * 2);
      ctx.fill();

      // 3 stroked rings rotating
      if (!reduce) {
        for (let k = 0; k < 3; k++) {
          const rot = t * 0.00022 + k * 1.05;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.scale(1.5 + k * 0.35, 0.42 + k * 0.14);
          ctx.strokeStyle = 'rgba(214,244,58,0.28)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(0, 0, cr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="w-full h-full block"
      style={{ opacity: 0.95 }}
    />
  );
}
