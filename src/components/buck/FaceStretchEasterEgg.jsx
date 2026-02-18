// src/components/buck/FaceStretchEasterEgg.jsx
// Mario 64-style face stretching on Buck's face -- the original BuckTamagotchi code,
// now hidden as an easter egg (triggered by 5 rapid clicks on the sprite).

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { achievementTriggers } from '../../utils/achievementTriggers';

const GRID_SIZE = 20;
const SPRING_STIFFNESS = 0.12;
const DAMPING = 0.75;
const INFLUENCE_RADIUS = 0.35;
const PULL_STRENGTH = 1.0;

const CROP = { x: 0.2297, y: 0.1697, w: 0.5405, h: 0.5405 };
const LEFT_SOCKET = { x: 0.35, y: 0.40 };
const RIGHT_SOCKET = { x: 0.65, y: 0.40 };

function createMesh(cols, rows) {
  const vertices = [];
  for (let y = 0; y <= rows; y++) {
    for (let x = 0; x <= cols; x++) {
      vertices.push({
        restX: x / cols, restY: y / rows,
        x: x / cols, y: y / rows,
        vx: 0, vy: 0,
      });
    }
  }
  return vertices;
}

function expandTriangle(x0, y0, x1, y1, x2, y2, px) {
  const cx = (x0 + x1 + x2) / 3;
  const cy = (y0 + y1 + y2) / 3;
  const expand = (x, y) => {
    const dx = x - cx, dy = y - cy;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.001) return { x, y };
    return { x: x + (dx / len) * px, y: y + (dy / len) * px };
  };
  const p0 = expand(x0, y0), p1 = expand(x1, y1), p2 = expand(x2, y2);
  return [p0.x, p0.y, p1.x, p1.y, p2.x, p2.y];
}

function drawMesh(ctx, img, vertices, cols, rows, w, h) {
  ctx.clearRect(0, 0, w, h);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i0 = row * (cols + 1) + col;
      const i1 = i0 + 1;
      const i2 = (row + 1) * (cols + 1) + col;
      const i3 = i2 + 1;
      drawTriangle(ctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height, w, h, vertices[i0], vertices[i1], vertices[i2]);
      drawTriangle(ctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height, w, h, vertices[i1], vertices[i3], vertices[i2]);
    }
  }
}

function drawTriangle(ctx, img, imgW, imgH, w, h, v0, v1, v2) {
  const rawX0 = v0.x * w, rawY0 = v0.y * h;
  const rawX1 = v1.x * w, rawY1 = v1.y * h;
  const rawX2 = v2.x * w, rawY2 = v2.y * h;
  const [x0, y0, x1, y1, x2, y2] = expandTriangle(rawX0, rawY0, rawX1, rawY1, rawX2, rawY2, 0.75);

  const u0 = (CROP.x + v0.restX * CROP.w) * imgW;
  const t0 = (CROP.y + v0.restY * CROP.h) * imgH;
  const u1 = (CROP.x + v1.restX * CROP.w) * imgW;
  const t1 = (CROP.y + v1.restY * CROP.h) * imgH;
  const u2 = (CROP.x + v2.restX * CROP.w) * imgW;
  const t2 = (CROP.y + v2.restY * CROP.h) * imgH;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.closePath();
  ctx.clip();

  const denom = u0 * (t1 - t2) + u1 * (t2 - t0) + u2 * (t0 - t1);
  if (Math.abs(denom) < 0.001) { ctx.restore(); return; }

  const a = (x0 * (t1 - t2) + x1 * (t2 - t0) + x2 * (t0 - t1)) / denom;
  const b = (x0 * (u2 - u1) + x1 * (u0 - u2) + x2 * (u1 - u0)) / denom;
  const c = (x0 * (u1 * t2 - u2 * t1) + x1 * (u2 * t0 - u0 * t2) + x2 * (u0 * t1 - u1 * t0)) / denom;
  const d = (y0 * (t1 - t2) + y1 * (t2 - t0) + y2 * (t0 - t1)) / denom;
  const e = (y0 * (u2 - u1) + y1 * (u0 - u2) + y2 * (u1 - u0)) / denom;
  const f = (y0 * (u1 * t2 - u2 * t1) + y1 * (u2 * t0 - u0 * t2) + y2 * (u0 * t1 - u1 * t0)) / denom;

  ctx.setTransform(a, d, b, e, c, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function getMeshDisplacement(mesh, normX, normY) {
  let dispX = 0, dispY = 0, totalW = 0;
  for (const v of mesh) {
    const dx = v.restX - normX, dy = v.restY - normY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 0.25) {
      const weight = 1 - dist / 0.25;
      dispX += (v.x - v.restX) * weight;
      dispY += (v.y - v.restY) * weight;
      totalW += weight;
    }
  }
  return totalW > 0 ? { x: dispX / totalW, y: dispY / totalW } : { x: 0, y: 0 };
}

const SIZE = 280;

const FaceStretchEasterEgg = ({ onClose }) => {
  const canvasRef = useRef(null);
  const meshRef = useRef(createMesh(GRID_SIZE, GRID_SIZE));
  const imgRef = useRef(null);
  const grabRef = useRef(null);
  const animRef = useRef(null);
  const containerRef = useRef(null);
  const leftEyeRef = useRef(null);
  const rightEyeRef = useRef(null);
  const eyeRef = useRef({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  // Trigger achievement on first open
  useEffect(() => {
    try { achievementTriggers.onFaceStretchFound(); } catch (e) {}
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; setReady(true); };
    img.src = chrome.runtime.getURL('assets/buck/Buck.png');
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const angle = Math.atan2(dy, dx);
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxEye = 6;
      const scale = Math.min(dist / 80, 1);
      eyeRef.current = {
        x: Math.cos(angle) * maxEye * scale,
        y: Math.sin(angle) * maxEye * scale,
      };
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const mesh = meshRef.current;

    drawMesh(ctx, img, mesh, GRID_SIZE, GRID_SIZE, w, h);

    if (leftEyeRef.current && rightEyeRef.current) {
      const er = eyeRef.current;
      const trackScale = SIZE / 72;
      const trackX = er.x * 0.12 * trackScale;
      const trackY = er.y * 0.08 * trackScale;
      const leftDisp = getMeshDisplacement(mesh, LEFT_SOCKET.x, LEFT_SOCKET.y);
      const rightDisp = getMeshDisplacement(mesh, RIGHT_SOCKET.x, RIGHT_SOCKET.y);
      const meshToCSS = SIZE / 1.85;

      leftEyeRef.current.style.transform =
        `translate(${trackX + leftDisp.x * meshToCSS}px, ${trackY + leftDisp.y * meshToCSS}px)`;
      rightEyeRef.current.style.transform =
        `translate(${trackX + rightDisp.x * meshToCSS}px, ${trackY + rightDisp.y * meshToCSS}px)`;
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      const mesh = meshRef.current;
      for (const v of mesh) {
        if (grabRef.current && v._grabbed) continue;
        const dx = v.restX - v.x, dy = v.restY - v.y;
        v.vx += dx * SPRING_STIFFNESS;
        v.vy += dy * SPRING_STIFFNESS;
        v.vx *= DAMPING;
        v.vy *= DAMPING;
        v.x += v.vx;
        v.y += v.vy;
      }
      render();
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
    return () => { running = false; if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [ready, render]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (cx - rect.left) / rect.width, y: (cy - rect.top) / rect.height };
  };

  const handleDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    for (const v of meshRef.current) {
      const dx = v.x - pos.x, dy = v.y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < INFLUENCE_RADIUS) {
        v._grabbed = true;
        v._grabWeight = 1 - dist / INFLUENCE_RADIUS;
      }
    }
    grabRef.current = { startX: pos.x, startY: pos.y };
  };

  const handleMove = (e) => {
    if (!grabRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    const dx = (pos.x - grabRef.current.startX) * PULL_STRENGTH;
    const dy = (pos.y - grabRef.current.startY) * PULL_STRENGTH;
    for (const v of meshRef.current) {
      if (v._grabbed) {
        const ease = v._grabWeight ** 2 * (3 - 2 * v._grabWeight);
        v.x = v.restX + dx * ease;
        v.y = v.restY + dy * ease;
        v.vx = 0;
        v.vy = 0;
      }
    }
  };

  const handleUp = () => {
    if (!grabRef.current) return;
    grabRef.current = null;
    for (const v of meshRef.current) {
      if (v._grabbed) {
        v.vx = (v.x - v.restX) * 0.05;
        v.vy = (v.y - v.restY) * 0.05;
        v._grabbed = false;
        v._grabWeight = 0;
      }
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.85)',
      zIndex: 200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          color: 'var(--text-primary)',
          borderRadius: 8,
          padding: '4px 12px',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        Close
      </button>

      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: SIZE,
          height: SIZE,
        }}
      >
        <canvas
          ref={canvasRef}
          width={SIZE * 2}
          height={SIZE * 2}
          style={{
            width: '100%',
            height: '100%',
            cursor: 'grab',
            touchAction: 'none',
            borderRadius: '50%',
            display: 'block',
          }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          onTouchStart={handleDown}
          onTouchMove={handleMove}
          onTouchEnd={handleUp}
        />

        <div style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: '50%',
          pointerEvents: 'none',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            transform: 'scale(1.85) translateY(6%)',
            transformOrigin: 'center center',
          }}>
            <img
              ref={leftEyeRef}
              src={chrome.runtime.getURL('assets/buck/Buck_L_Eye.png')}
              alt=""
              style={{
                position: 'absolute',
                width: '200%',
                height: '200%',
                left: '0%',
                top: '-46%',
              }}
            />
            <img
              ref={rightEyeRef}
              src={chrome.runtime.getURL('assets/buck/Buck_R_Eye.png')}
              alt=""
              style={{
                position: 'absolute',
                width: '200%',
                height: '200%',
                left: '17%',
                top: '-46%',
              }}
            />
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
        Pull on Buck's face!
      </p>
    </div>
  );
};

export default FaceStretchEasterEgg;
