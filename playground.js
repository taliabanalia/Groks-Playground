(() => {
  const canvas = document.getElementById("tide");
  const bloomBtn = document.getElementById("bloom");
  const clearBtn = document.getElementById("clear");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STATE = {
    width: 0,
    height: 0,
    dpr: 1,
    particles: [],
    ripples: [],
    pointer: { x: 0, y: 0, active: false, moved: false },
    last: performance.now(),
    huePulse: 0,
  };

  const COLORS = {
    foam: [183, 216, 207],
    coral: [255, 111, 76],
    sand: [240, 194, 122],
    mist: [231, 243, 239],
  };

  function resize() {
    STATE.dpr = Math.min(window.devicePixelRatio || 1, 2);
    STATE.width = window.innerWidth;
    STATE.height = window.innerHeight;
    canvas.width = Math.floor(STATE.width * STATE.dpr);
    canvas.height = Math.floor(STATE.height * STATE.dpr);
    canvas.style.width = `${STATE.width}px`;
    canvas.style.height = `${STATE.height}px`;
    ctx.setTransform(STATE.dpr, 0, 0, STATE.dpr, 0, 0);
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickColor() {
    const roll = Math.random();
    if (roll < 0.55) return COLORS.foam;
    if (roll < 0.82) return COLORS.mist;
    if (roll < 0.94) return COLORS.sand;
    return COLORS.coral;
  }

  function spawnParticle(x, y, burst = false) {
    const color = pickColor();
    const angle = rand(0, Math.PI * 2);
    const speed = burst ? rand(1.2, 4.2) : rand(0.15, 0.9);
    STATE.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: burst ? rand(0.7, 1.4) : rand(1.2, 2.8),
      maxLife: burst ? rand(0.7, 1.4) : rand(1.2, 2.8),
      size: burst ? rand(1.5, 4.5) : rand(0.8, 2.6),
      color,
      drift: rand(-0.25, 0.25),
    });
  }

  function seedField(count = 140) {
    for (let i = 0; i < count; i += 1) {
      spawnParticle(rand(0, STATE.width), rand(0, STATE.height), false);
    }
  }

  function dropThought(x, y) {
    const cx = x ?? STATE.width * 0.62;
    const cy = y ?? STATE.height * 0.38;
    const amount = reducedMotion ? 28 : 70;
    for (let i = 0; i < amount; i += 1) {
      spawnParticle(cx + rand(-8, 8), cy + rand(-8, 8), true);
    }
    STATE.ripples.push({
      x: cx,
      y: cy,
      r: 4,
      max: Math.min(STATE.width, STATE.height) * 0.35,
      life: 1,
    });
  }

  function clearWater() {
    STATE.particles.length = 0;
    STATE.ripples.length = 0;
    seedField(reducedMotion ? 60 : 120);
  }

  function onPointerMove(e) {
    const point = e.touches ? e.touches[0] : e;
    STATE.pointer.x = point.clientX;
    STATE.pointer.y = point.clientY;
    STATE.pointer.active = true;
    STATE.pointer.moved = true;

    if (!reducedMotion && Math.random() > 0.45) {
      spawnParticle(STATE.pointer.x, STATE.pointer.y, false);
    }
  }

  function onPointerDown(e) {
    const point = e.touches ? e.touches[0] : e;
    // Ignore UI controls
    if (e.target instanceof HTMLElement && e.target.closest("button, a")) return;
    dropThought(point.clientX, point.clientY);
  }

  function onPointerLeave() {
    STATE.pointer.active = false;
  }

  function step(dt) {
    STATE.huePulse += dt * 0.35;

    // Soft ambient inflow
    if (!reducedMotion && STATE.particles.length < 220 && Math.random() > 0.7) {
      const edge = Math.floor(Math.random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) {
        x = rand(0, STATE.width);
        y = -4;
      } else if (edge === 1) {
        x = STATE.width + 4;
        y = rand(0, STATE.height);
      } else if (edge === 2) {
        x = rand(0, STATE.width);
        y = STATE.height + 4;
      } else {
        x = -4;
        y = rand(0, STATE.height);
      }
      spawnParticle(x, y, false);
    }

    for (let i = STATE.particles.length - 1; i >= 0; i -= 1) {
      const p = STATE.particles[i];
      p.life -= dt;

      // Slow tidal swirl
      const swirl = 0.18 * Math.sin(STATE.huePulse + p.x * 0.01);
      p.vx += Math.cos(p.y * 0.008 + STATE.huePulse) * 0.02 + p.drift * 0.01;
      p.vy += swirl * 0.02;

      if (STATE.pointer.active) {
        const dx = STATE.pointer.x - p.x;
        const dy = STATE.pointer.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 180) {
          const force = (1 - dist / 180) * 0.55;
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      // Damping
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;

      if (p.life <= 0 || p.x < -40 || p.y < -40 || p.x > STATE.width + 40 || p.y > STATE.height + 40) {
        STATE.particles.splice(i, 1);
      }
    }

    for (let i = STATE.ripples.length - 1; i >= 0; i -= 1) {
      const r = STATE.ripples[i];
      r.r += dt * 140;
      r.life -= dt * 0.65;
      if (r.life <= 0 || r.r > r.max) STATE.ripples.splice(i, 1);
    }
  }

  function draw() {
    // Trail fade — keeps the ink-wash feel
    ctx.fillStyle = "rgba(11, 36, 41, 0.18)";
    ctx.fillRect(0, 0, STATE.width, STATE.height);

    for (const r of STATE.ripples) {
      const alpha = Math.max(r.life, 0) * 0.35;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 111, 76, ${alpha})`;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }

    for (const p of STATE.particles) {
      const t = Math.max(p.life / p.maxLife, 0);
      const [cr, cg, cb] = p.color;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${0.15 + t * 0.75})`;
      ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    const dt = Math.min((now - STATE.last) / 1000, 0.033);
    STATE.last = now;
    if (!reducedMotion) step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  function init() {
    resize();
    seedField(reducedMotion ? 80 : 160);
    // Opening bloom so the first viewport already feels alive
    dropThought(STATE.width * 0.68, STATE.height * 0.32);
    if (reducedMotion) {
      draw();
    }

    window.addEventListener("resize", () => {
      resize();
    });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerleave", onPointerLeave);
    bloomBtn?.addEventListener("click", () => dropThought());
    clearBtn?.addEventListener("click", clearWater);

    requestAnimationFrame(frame);
  }

  init();
})();
