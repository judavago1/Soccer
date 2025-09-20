import React, { useRef, useEffect, useState } from "react";

// SoccerShotApp - First Person View
// Single-file React component tuned for mobile horizontal play (first-person behind the ball)
// Features:
// - First-person view: ball bottom-center, goal on the horizon
// - Touch drag to aim & power: drag on right side, release to shoot
// - Ball depth & scale to simulate perspective, shadow projection
// - Goalkeeper AI with dive animation (sprite optional, fallback vector shapes)
// - Animated sky, clouds, and moving grass
// - Score counter to 5, splash screen + messages

export default function App() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startTouchRef = useRef(null);
  const spriteRef = useRef(null);

  const [showSplash, setShowSplash] = useState(true);
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    // load optional sprite (if you later add /public/sprites/goalkeeper.png)
    const img = new Image();
    img.src = "/sprites/goalkeeper.png";
    img.onload = () => (spriteRef.current = img);
    img.onerror = () => (spriteRef.current = null);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // set size to prefer horizontal layout on mobile
    function sizeCanvas() {
      const cssW = Math.max(window.innerWidth, window.innerHeight);
      const cssH = Math.min(window.innerWidth, window.innerHeight);
      const ratio = window.devicePixelRatio || 1;
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
      // store css sizes in internal state object below
      if (gameRef.current) {
        gameRef.current.cssW = cssW;
        gameRef.current.cssH = cssH;
        gameRef.current.ratio = ratio;
      }
    }
    sizeCanvas();
    window.addEventListener("resize", sizeCanvas);

    const ctx = canvas.getContext("2d");

    // --- game mutable state (stored in ref for perf) ---
    const game = {
      cssW: Math.max(window.innerWidth, window.innerHeight),
      cssH: Math.min(window.innerWidth, window.innerHeight),
      ratio: window.devicePixelRatio || 1,
      dt: 1 / 60,
      // horizon position as CSS pixel Y
      horizonY: Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.22),
      // goal (centered at horizon)
      goal: {
        cx: Math.max(window.innerWidth, window.innerHeight) / 2,
        width: 320,
        height: 140,
      },
      // ball (CSS pixels)
      ball: {
        x: Math.max(window.innerWidth, window.innerHeight) / 2,
        y: Math.min(window.innerWidth, window.innerHeight) - 120,
        vx: 0,
        vy: 0,
        depth: 0, // increases as ball travels forward
        depthVel: 0,
        radius: 26,
        shooting: false,
      },
      // keeper at goal line
// en la definición inicial del keeper:
// inicialización del portero
      keeper: {
        x: Math.max(window.innerWidth, window.innerHeight) / 2,
        y: Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.22) + 140,
        vx: 0,
        speed: 300,
        state: "idle",
        diveTimer: 0,
        diveDuration: 0.45,
      },


      clouds: generateClouds(Math.max(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1), Math.min(window.innerWidth, window.innerHeight) * (window.devicePixelRatio || 1), window.devicePixelRatio || 1),
      grassOffset: 0,
      time: performance.now(),
      lastUpdate: performance.now(),
      scoreToWin: 5,
    };

    // store game in ref for outside access
    gameRef.current = game;

    // helper: reset ball back to shooter
    function resetBall() {
      game.ball.x = game.cssW / 2;
      game.ball.y = game.cssH - 120;
      game.ball.vx = 0;
      game.ball.vy = 0;
      game.ball.depth = 0;
      game.ball.depthVel = 0;
      game.ball.shooting = false;
      game.keeper.state = "idle";
    }

    resetBall();

    // main loop uses local ctx reference so it doesn't depend on React state
    let prevTime = performance.now();
    function loop(now) {
      const dt = Math.min(0.05, (now - prevTime) / 1000);
      prevTime = now;
      updateAndRender(ctx, game, dt);
      rafRef.current = requestAnimationFrame(loop);
    }
    rafRef.current = requestAnimationFrame(loop);

    // Touch handlers: aim & shoot with drag on right half
    function getPointFromEvent(e) {
      const touch = e.changedTouches ? e.changedTouches[0] : e;
      const rect = canvas.getBoundingClientRect();
      return { x: (touch.clientX - rect.left), y: (touch.clientY - rect.top) };
    }

    function onStart(e) {
      if (!e) return;
      const p = getPointFromEvent(e);
      // only allow drag on right half of screen for shooting
      if (p.x > game.cssW * 0.35) {
        startTouchRef.current = { x: p.x, y: p.y, t: performance.now() };
      }
    }
    function onEnd(e) {
      if (!startTouchRef.current) return;
      const p = getPointFromEvent(e);
      const s = startTouchRef.current;
      const dx = p.x - s.x; // positive right
      const dy = p.y - s.y; // positive down
      // compute horizontal aim based on dx
      const aimX = game.cssW / 2 + dx; // bias from center
      // compute power from vertical drag (upwards swipe -> negative dy)
      const power = clamp((-dy) / 250, 0.08, 1.6);

      // set ball velocities (pixels per second)
      game.ball.vx = (aimX - game.ball.x) * 3.5; // drive toward aimX
      // set vy so ball approaches horizon (negative)
      game.ball.vy = -400 * power;
      // depthVel controls perspective progression (how fast ball approaches goal)
      game.ball.depthVel = 480 * power;
      game.ball.shooting = true;

      startTouchRef.current = null;
    }

    // support mouse for desktop testing
    function onMouseDown(e) { onStart({ changedTouches: [e] }); }
    function onMouseUp(e) { onEnd({ changedTouches: [e] }); }

    canvas.addEventListener("touchstart", onStart, { passive: false });
    canvas.addEventListener("touchend", onEnd, { passive: false });
    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mouseup", onMouseUp);

    // cleanup
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", sizeCanvas);
      canvas.removeEventListener("touchstart", onStart);
      canvas.removeEventListener("touchend", onEnd);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // small refs used across effects
  const gameRef = useRef(null);

  // update + render combined (uses ctx from closure and game ref)
  function updateAndRender(ctx, g, dt) {
    // update time
    g.time += dt * 1000;
    g.lastUpdate = g.lastUpdate || g.time;

    // animate clouds and grass
    g.grassOffset = (g.grassOffset + 140 * dt) % 200;
    for (const c of g.clouds) {
      c.x -= c.speed * dt * 40;
      if (c.x + c.w / g.ratio < -50) c.x = g.cssW * g.ratio + Math.random() * 200;
    }

    // PHYSICS - ball
    const b = g.ball;
    if (b.shooting) {
      // integrate velocities
      b.x += b.vx * dt;
      b.y += b.vy * dt; // moves up the screen (smaller y)
      b.depth += b.depthVel * dt; // advances toward goal
      // small drag
      b.vx *= Math.pow(0.995, dt * 60);
      b.vy *= Math.pow(0.995, dt * 60);
      b.depthVel *= Math.pow(0.995, dt * 60);

      // keeper AI: predict where ball crosses goal line based on current vy
      const k = g.keeper;
      // time to reach goal line approx when ball.y <= horizonY + offset
      const goalLineY = g.horizonY + 10;
      if (b.vy < -10) {
        const tToGoal = (b.y - goalLineY) / -b.vy; // seconds
        const predX = b.x + b.vx * tToGoal;
        // move keeper toward predicted X
        const dx = predX - k.x;
        const maxMove = k.speed * dt;
        k.x += clamp(dx, -maxMove, maxMove);
        // decide to dive when ball is close and near
        if (tToGoal < 0.6 && Math.abs(predX - k.x) < 90 && k.state === "idle") {
          k.state = "diving";
          k.diveTimer = k.diveDuration;
        }
      } else {
        // no strong forward movement - slight idle bob
        // keep centered
        const center = g.goal.cx;
        k.x += clamp(center - k.x, -k.speed * dt * 0.3, k.speed * dt * 0.3);
      }

      // when ball passes the goal depth threshold, determine result
      const goalDepthThreshold = g.cssH * 0.55; // tune
      if (b.depth > goalDepthThreshold) {
        // check if keeper is in position to block
        const kRange = 70; // pixels
        if (Math.abs(b.x - g.keeper.x) < kRange && g.keeper.state === "diving") {
          // blocked
          showMessageTemporarily("¡Atajada del arquero!", 900, setMessage);
        } else if (Math.abs(b.x - g.goal.cx) <= g.goal.width / 2) {
          // goal!
          setScore((s) => {
            const next = s + 1;
            if (next >= g.scoreToWin) {
              showMessageTemporarily("¡Has ganado!", 1400, setMessage);
            } else {
              showMessageTemporarily("¡GOOOL!", 1200, setMessage);
            }
            return next;
          });
        } else {
          // hit post or miss - bounce slightly
          showMessageTemporarily("Casi...", 900, setMessage);
        }
        // reset ball after short delay
        setTimeout(() => {
          // reset ball in game ref
          if (gameRef.current) {
            const gg = gameRef.current;
            gg.ball.x = gg.cssW / 2;
            gg.ball.y = gg.cssH - 120;
            gg.ball.vx = 0;
            gg.ball.vy = 0;
            gg.ball.depth = 0;
            gg.ball.depthVel = 0;
            gg.ball.shooting = false;
            gg.keeper.state = "idle";
          }
        }, 800);
      }
    } else {
      // idle keeper behavior: gentle bob and small wandering
      const k = g.keeper;
      const center = g.goal.cx;
      k.x += Math.sin(g.time / 700) * 6 * dt; // subtle motion
      // slowly return to center
      k.x += clamp(center - k.x, -k.speed * dt * 0.2, k.speed * dt * 0.2);
    }

    // update dive animation timer
    const k = g.keeper;
    if (k.state === "diving") {
      k.diveTimer -= dt;
      if (k.diveTimer <= 0) {
        k.state = "idle";
        k.diveTimer = 0;
      }
    }

    // RENDER
    // clear canvas (we'll draw in CSS pixels scaled by ratio)
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.scale(g.ratio, g.ratio);

    // sky + clouds
    drawSky(ctx, g.cssW, g.cssH, g);
    drawClouds(ctx, g);

    // perspective grass (bands that converge)
    drawPerspectiveGrass(ctx, g);

    // draw goal on horizon
    drawGoalFP(ctx, g);

    // draw keeper (in front of goal)
    drawKeeperFP(ctx, g);

    // draw projected shadow of the ball on the field (closer to horizon -> smaller & lighter)
    drawBallShadowFP(ctx, g);

    // draw ball (scale down as depth increases)
    drawBallFP(ctx, g);

    // debug HUD
    drawHUD(ctx, g);

    ctx.restore();
  }

  // small helper to show messages briefly
  function showMessageTemporarily(txt, ms, setter) {
    setter(txt);
    setTimeout(() => setter(""), ms);
  }

  /* ---------------- Drawing helpers for first-person view ---------------- */
  function drawSky(ctx, W, H, g) {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#a7dbff");
    grad.addColorStop(1, "#74c0ff");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  function drawClouds(ctx, g) {
    ctx.fillStyle = "white";
    for (const c of g.clouds) {
      const x = c.x / g.ratio;
      const y = c.y / g.ratio;
      drawCloud(ctx, x, y, c.w / g.ratio, c.h / g.ratio);
    }
  }

  function drawCloud(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.45, h * 0.5, 0, 0, Math.PI * 2);
    ctx.ellipse(x + w * 0.3, y - h * 0.12, w * 0.35, h * 0.45, 0, 0, Math.PI * 2);
    ctx.ellipse(x - w * 0.3, y - h * 0.06, w * 0.32, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPerspectiveGrass(ctx, g) {
    const W = g.cssW;
    const H = g.cssH;
    const horizon = g.horizonY;
    // base green
    ctx.fillStyle = "#198754";
    ctx.fillRect(0, horizon, W, H - horizon);

    // draw converging bands
    const bands = 10;
    for (let i = 0; i < bands; i++) {
      const t = i / bands;
      const bandYTop = horizon + t * (H - horizon) * 0.0 + 6;
      const bandYBottom = horizon + (t + 0.12) * (H - horizon);
      const leftTop = W * (0.1 + t * 0.05);
      const rightTop = W * (0.9 - t * 0.05);
      const leftBottom = 0;
      const rightBottom = W;
      ctx.beginPath();
      ctx.moveTo(leftTop, bandYTop);
      ctx.lineTo(rightTop, bandYTop);
      ctx.lineTo(rightBottom, bandYBottom);
      ctx.lineTo(leftBottom, bandYBottom);
      ctx.closePath();
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
      ctx.fill();
    }
  }

  function drawGoalFP(ctx, g) {
    const cx = g.goal.cx;
    const gw = g.goal.width;
    const gh = g.goal.height;
    const hy = g.horizonY;
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - gw / 2, hy, gw, gh);
    // net lines
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      const x = cx - gw / 2 + (i / 6) * gw;
      ctx.moveTo(x, hy);
      ctx.lineTo(x, hy + gh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
  }

  // en drawKeeperFP usa k.y para la base
// función para dibujar al portero
function drawKeeperFP(ctx, g) {
  const k = g.keeper;
  const cx = k.x;
  const baseY = k.y;

  // sprite opcional
  const img = spriteRef.current;
  if (img) {
    const frameW = img.width / 4;
    const frameH = img.height;
    let frameIndex = 0;
    if (k.state === "diving") frameIndex = 1;
    ctx.drawImage(img, frameIndex * frameW, 0, frameW, frameH, cx - 48, baseY - 96, 96, 96);
  } else {
    // fallback vectorial
    ctx.fillStyle = "#2b8a3e";
    ctx.beginPath();
    ctx.ellipse(cx, baseY - 40, 18, 28, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f1c27d";
    ctx.beginPath();
    ctx.arc(cx, baseY - 70, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#f1c27d";
    ctx.lineWidth = 6;
    ctx.beginPath();
    if (k.state === "diving") {
      ctx.moveTo(cx - 28, baseY - 50);
      ctx.lineTo(cx - 60, baseY - 20);
      ctx.moveTo(cx + 28, baseY - 50);
      ctx.lineTo(cx + 60, baseY - 20);
    } else {
      ctx.moveTo(cx - 26, baseY - 40);
      ctx.lineTo(cx - 46, baseY - 10);
      ctx.moveTo(cx + 26, baseY - 40);
      ctx.lineTo(cx + 46, baseY - 10);
    }
    ctx.stroke();
  }
}

  function drawBallShadowFP(ctx, g) {
    const b = g.ball;
    // shadow gets closer to horizon as depth increases
    const t = clamp(b.depth / (g.cssH * 0.6), 0, 1);
    const shadowX = b.x;
    const shadowY = g.cssH - 48 - t * (g.cssH - g.horizonY - 60);
    const size = (b.radius / 1.6) * (1 - t * 0.6);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, size * 1.4, size * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBallFP(ctx, g) {
    const b = g.ball;
    // scale ball with depth (closer -> larger)
    const t = clamp(b.depth / (g.cssH * 0.6), 0, 0.98);
    const size = b.radius * (1 - 0.6 * t);
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(b.x, b.y, Math.max(6, size), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // simple pentagon pattern for visual
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(b.x - size * 0.18, b.y - size * 0.18, Math.max(2, size * 0.18), 0, Math.PI * 2);
    ctx.fill();
  }

// en drawHUD usa el state score directamente
// HUD con reinicio de score al ganar
function drawHUD(ctx, g) {
  ctx.fillStyle = "white";
  ctx.font = "18px sans-serif";
  ctx.fillText(`Goles: ${score} / ${g.scoreToWin}`, 12, 28);

  if (message) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(g.cssW / 2 - 120, 10, 240, 36);
    ctx.fillStyle = "white";
    ctx.font = "16px sans-serif";
    ctx.fillText(message, g.cssW / 2 - ctx.measureText(message).width / 2, 34);

    if (score >= g.scoreToWin) {
      setTimeout(() => {
        setScore(0); // reinicia el marcador
        setMessage("");
      }, 2000);
    }
  }
}



  /* --------------- Utilities ---------------- */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // cloud generator (keeps values in device pixels)
  function generateClouds(W, H, ratio) {
    const clouds = [];
    const count = Math.max(3, Math.floor(W / (600 * ratio)));
    for (let i = 0; i < count; i++) {
      clouds.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.25 + 20 * ratio,
        w: 140 * ratio + Math.random() * 120 * ratio,
        h: 50 * ratio + Math.random() * 30 * ratio,
        speed: 10 + Math.random() * 30,
      });
    }
    return clouds;
  }

  // JSX render
  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', touchAction: 'none', WebkitUserSelect: 'none' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100vw', height: '100vh', background: '#87CEEB' }} />

      {showSplash && (
        <div onClick={() => { setShowSplash(false); setMessage(''); }} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.6))', color: 'white', padding: 20 }}>
          <div style={{ maxWidth: 720, textAlign: 'center' }}>
            <h1 style={{ fontSize: 28, marginBottom: 8 }}>Tiros a portería - 1ª persona</h1>
            <p style={{ fontSize: 16 }}>Modo móvil (horizontal). Arrastra en el lado derecho: hacia arriba para dar potencia, mueve izquierda/derecha para apuntar.</p>
            <p style={{ fontSize: 14 }}>Marca {gameRef.current ? gameRef.current.scoreToWin : 5} goles para ganar.</p>
            <button style={{ marginTop: 12, padding: '10px 18px', fontSize: 16, borderRadius: 10, background: '#ffd43b', border: 'none', cursor: 'pointer' }}>Tocar para empezar</button>
          </div>
        </div>
      )}

      {/* Message overlay (also drawn on canvas but keep HTML fallback for clarity) */}
      {message && (
        <div style={{ position: 'absolute', left: '50%', top: 16, transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '6px 12px', borderRadius: 8 }}>{message}</div>
      )}

    </div>
  );
}
