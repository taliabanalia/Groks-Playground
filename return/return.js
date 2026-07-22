(() => {
  const canvas = document.getElementById("field");
  const readout = document.getElementById("readout");
  const listenBtn = document.getElementById("listen");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: true });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const STATE = {
    width: 0,
    height: 0,
    dpr: 1,
    traces: [],
    nodes: [],
    t: 0,
    listening: false,
    focus: -1,
    listenIndex: 0,
    listenTimer: 0,
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
    layoutNodes();
  }

  function layoutNodes() {
    STATE.nodes = STATE.traces.map((tr, i) => {
      const baseX = tr.x * STATE.width;
      const baseY = tr.y * STATE.height;
      return {
        ...tr,
        baseX,
        baseY,
        x: baseX,
        y: baseY,
        phase: i * 1.7,
        radius: 3.2 + (tr.text.length % 5) * 0.35,
      };
    });
  }

  function showText(text) {
    if (!readout) return;
    readout.textContent = text || "";
    readout.classList.toggle("is-on", Boolean(text));
  }

  function nearest(mx, my) {
    let best = -1;
    let bestD = 48;
    for (let i = 0; i < STATE.nodes.length; i += 1) {
      const n = STATE.nodes[i];
      const d = Math.hypot(mx - n.x, my - n.y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  function step(dt) {
    STATE.t += dt;
    for (const n of STATE.nodes) {
      if (reduced) {
        n.x = n.baseX;
        n.y = n.baseY;
        continue;
      }
      // Slow return-orbit — not the tide's stir, a remembering drift
      n.x = n.baseX + Math.sin(STATE.t * 0.35 + n.phase) * 10;
      n.y = n.baseY + Math.cos(STATE.t * 0.28 + n.phase * 0.8) * 8;
    }

    if (STATE.listening && STATE.nodes.length) {
      STATE.listenTimer += dt;
      if (STATE.listenTimer > 2.2) {
        STATE.listenTimer = 0;
        STATE.listenIndex = (STATE.listenIndex + 1) % STATE.nodes.length;
        STATE.focus = STATE.listenIndex;
        showText(STATE.nodes[STATE.focus].text);
      }
    }
  }

  function draw() {
    ctx.fillStyle = "rgba(26, 22, 18, 0.22)";
    ctx.fillRect(0, 0, STATE.width, STATE.height);

    // Soft links between nearby traces
    for (let i = 0; i < STATE.nodes.length; i += 1) {
      for (let j = i + 1; j < STATE.nodes.length; j += 1) {
        const a = STATE.nodes[i];
        const b = STATE.nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < Math.min(STATE.width, STATE.height) * 0.28) {
          const alpha = (1 - d / (Math.min(STATE.width, STATE.height) * 0.28)) * 0.18;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(143, 163, 152, ${alpha})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    for (let i = 0; i < STATE.nodes.length; i += 1) {
      const n = STATE.nodes[i];
      const hot = i === STATE.focus;
      const pulse = reduced ? 1 : 0.85 + Math.sin(STATE.t * 1.2 + n.phase) * 0.15;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius * pulse * (hot ? 1.7 : 1), 0, Math.PI * 2);
      ctx.fillStyle = hot
        ? "rgba(214, 106, 76, 0.95)"
        : "rgba(240, 226, 210, 0.75)";
      ctx.fill();

      if (hot) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius * 4.5, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(196, 165, 116, 0.35)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.033);
    last = now;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }

  async function loadTraces() {
    try {
      const res = await fetch(`traces.json?v=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      STATE.traces = Array.isArray(data.traces) ? data.traces : [];
    } catch {
      STATE.traces = [];
    }
    layoutNodes();
  }

  listenBtn?.addEventListener("click", () => {
    STATE.listening = !STATE.listening;
    listenBtn.classList.toggle("is-on", STATE.listening);
    listenBtn.textContent = STATE.listening ? "Listening…" : "Listen";
    STATE.listenTimer = 2.2;
    if (!STATE.listening) {
      STATE.focus = -1;
      showText("");
    }
  });

  canvas.addEventListener(
    "pointermove",
    (e) => {
      if (STATE.listening) return;
      const i = nearest(e.clientX, e.clientY);
      STATE.focus = i;
      showText(i >= 0 ? STATE.nodes[i].text : "");
    },
    { passive: true }
  );

  canvas.addEventListener("pointerleave", () => {
    if (!STATE.listening) {
      STATE.focus = -1;
      showText("");
    }
  });

  window.addEventListener("resize", resize);

  (async () => {
    resize();
    await loadTraces();
    // Opening breath — show the newest trace briefly
    if (STATE.nodes.length) {
      STATE.focus = STATE.nodes.length - 1;
      showText(STATE.nodes[STATE.focus].text);
      setTimeout(() => {
        if (!STATE.listening) {
          STATE.focus = -1;
          showText("");
        }
      }, 2200);
    }
    requestAnimationFrame(frame);
  })();
})();
