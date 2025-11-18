import React, { useEffect, useRef, useState } from "react";

const GRAVITY = 1400;
const MAX_SPEED = 300;
const JUMP_FORCE = 650;
const SPEED_RESPONSIVENESS = 5.2;
const SPEED_BRAKE_MULTIPLIER = 1.35;
const COYOTE_TIME = 0.08;
const JUMP_BUFFER = 0.14;
const AIR_DRAG = 260;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 560;
const SPEED_RAMP_DURATION = 5.2;
const START_SPEED = 55;
const BASE_RAMP_FACTOR = 0.32;

const PLATFORM_COLOR = "#2d2d54";

const BALL_OPTIONS = [
  {
    id: "aqua",
    label: "Neon Aqua",
    color: "#5bd1ff",
    stripe: "#ffffff",
    trail: "rgba(91, 209, 255, 0.25)",
  },
  {
    id: "sunset",
    label: "Sunset",
    color: "#ffb54c",
    stripe: "#5bd1ff",
    trail: "rgba(255, 181, 76, 0.2)",
  },
  {
    id: "mint",
    label: "Mint",
    color: "#5ff5c0",
    stripe: "#004b63",
    trail: "rgba(95, 245, 192, 0.2)",
  },
];

const coins = [
  { x: 220, y: 410, radius: 10 },
  { x: 520, y: 360, radius: 10 },
  { x: 740, y: 300, radius: 10 },
  { x: 1020, y: 360, radius: 10 },
  { x: 1340, y: 270, radius: 10 },
  { x: 1650, y: 450, radius: 10 },
  { x: 1950, y: 340, radius: 10 },
  { x: 2220, y: 280, radius: 10 },
  { x: 2500, y: 420, radius: 10 },
];

const levelPlatforms = [
  { x: 0, y: 460, width: 420, height: 40 },
  { x: 480, y: 400, width: 160, height: 30 },
  { x: 700, y: 340, width: 190, height: 26 },
  { x: 980, y: 420, width: 240, height: 32 },
  { x: 1300, y: 310, width: 160, height: 26 },
  { x: 1560, y: 500, width: 260, height: 36 },
  { x: 1900, y: 380, width: 210, height: 30 },
  { x: 2160, y: 330, width: 220, height: 28 },
  { x: 2460, y: 470, width: 240, height: 36 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export default function Game() {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const lastTick = useRef(0);
  const pressedKeys = useRef(new Set());
  const statusRef = useRef("menu");
  const audioCtxRef = useRef(null);
  const ballStyleRef = useRef(BALL_OPTIONS[0]);
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState("menu");
  const [message, setMessage] = useState(
    "Pick your ball, collect coins, and roll forward."
  );
  const [timeAlive, setTimeAlive] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [muted, setMuted] = useState(false);
  const [selectedBall, setSelectedBall] = useState(BALL_OPTIONS[0]);
  const coinsRef = useRef(coins);
  const coyoteRef = useRef(0);
  const jumpBufferRef = useRef(0);
  const groundedRef = useRef(true);
  const speedRampRef = useRef(0);
  const mutedRef = useRef(false);

  const ballRef = useRef({
    x: 90,
    y: 340,
    radius: 18,
    vx: START_SPEED,
    vy: 0,
    rotation: 0,
  });

  const trailRef = useRef([]);

  const resetGame = () => {
    pressedKeys.current.clear();
    ballRef.current = {
      x: 90,
      y: 340,
      radius: 18,
      vx: START_SPEED,
      vy: 0,
      rotation: 0,
    };
    trailRef.current = [];
    coinsRef.current = coins.map((coin) => ({ ...coin }));
    lastTick.current = performance.now();
    coyoteRef.current = 0;
    jumpBufferRef.current = 0;
    groundedRef.current = true;
    speedRampRef.current = 0;
    setDistance(0);
    setTimeAlive(0);
    setCoinsCollected(0);
    setStatus("running");
    setMessage(
      "Roll across the platforms. A/D or arrows steer, Space/Up jumps."
    );
  };

  const startFromMenu = () => {
    ballStyleRef.current = selectedBall;
    resetGame();
  };

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    mutedRef.current = muted;
    if (audioCtxRef.current) {
      if (muted) {
        audioCtxRef.current.suspend();
      } else if (audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    }
  }, [muted]);

  const ensureAudioContext = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  const playTone = (frequency, duration = 0.15, type = "sine", volume = 0.1) => {
    if (mutedRef.current) return;
    const ctx = ensureAudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        pressedKeys.current.add("jump");
        jumpBufferRef.current = JUMP_BUFFER;
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        pressedKeys.current.add("left");
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        pressedKeys.current.add("right");
      } else if (event.code === "KeyR") {
        resetGame();
      }

      if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
        audioCtxRef.current.resume();
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === "Space" || event.code === "ArrowUp") {
        pressedKeys.current.delete("jump");
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        pressedKeys.current.delete("left");
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        pressedKeys.current.delete("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      animationRef.current && cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === "running") {
      lastTick.current = performance.now();
      animationRef.current = requestAnimationFrame(loop);
    }

    return () => {
      animationRef.current && cancelAnimationFrame(animationRef.current);
    };
  }, [status]);

  useEffect(() => {
    if (status === "lost") {
      setMessage("You fell! Press R or the Reset button to try again.");
      playTone(180, 0.25, "triangle", 0.12);
    }
  }, [status]);

  const loop = (timestamp) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const delta = clamp((timestamp - lastTick.current) / 1000, 0, 0.032);
    lastTick.current = timestamp;

    updatePhysics(delta);
    drawScene(ctx);

    if (statusRef.current === "running") {
      animationRef.current = requestAnimationFrame(loop);
    }
  };

  const updatePhysics = (delta) => {
    const ball = ballRef.current;
    let onGround = false;
    const prevY = ball.y;

    coyoteRef.current = Math.max(0, coyoteRef.current - delta);
    jumpBufferRef.current = Math.max(0, jumpBufferRef.current - delta);
    speedRampRef.current = Math.min(
      1,
      speedRampRef.current + delta / SPEED_RAMP_DURATION
    );
    const rampT = speedRampRef.current;
    const easedRamp =
      BASE_RAMP_FACTOR + (1 - BASE_RAMP_FACTOR) * (1 - Math.pow(1 - rampT, 3));

    const inputDirection =
      (pressedKeys.current.has("right") ? 1 : 0) -
      (pressedKeys.current.has("left") ? 1 : 0);

    const rampedMax = MAX_SPEED * easedRamp;
    const desiredSpeed = inputDirection * rampedMax;
    const braking =
      inputDirection === 0 ||
      (desiredSpeed !== 0 &&
        Math.sign(desiredSpeed) !== Math.sign(ball.vx) &&
        Math.abs(ball.vx) > 24);
    const responsiveness =
      SPEED_RESPONSIVENESS *
      (groundedRef.current ? 1 : 0.65) *
      (braking ? SPEED_BRAKE_MULTIPLIER : 1);
    const damping = 1 - Math.exp(-responsiveness * delta);
    ball.vx += (desiredSpeed - ball.vx) * damping;

    if (!groundedRef.current && inputDirection === 0) {
      const drag = Math.min(Math.abs(ball.vx), AIR_DRAG * delta);
      ball.vx -= Math.sign(ball.vx) * drag;
    }

    ball.vy += GRAVITY * delta;
    ball.x += ball.vx * delta;
    ball.y += ball.vy * delta;
    ball.rotation += (ball.vx * delta) / ball.radius;

    for (const platform of levelPlatforms) {
      const top = platform.y;
      const left = platform.x - ball.radius;
      const right = platform.x + platform.width + ball.radius;
      const isOverPlatform = ball.x >= left && ball.x <= right;
      const crossedThrough =
        prevY + ball.radius <= top && ball.y + ball.radius >= top;

      if (isOverPlatform && crossedThrough && ball.vy >= 0) {
        ball.y = top - ball.radius;
        ball.vy = 0;
        onGround = true;
      }
    }

    if (onGround) {
      coyoteRef.current = COYOTE_TIME;
    }

    const readyToJump =
      jumpBufferRef.current > 0 && coyoteRef.current > 0 &&
      pressedKeys.current.has("jump");

    if (readyToJump) {
      ball.vy = -JUMP_FORCE;
      coyoteRef.current = 0;
      jumpBufferRef.current = 0;
      groundedRef.current = false;
      playTone(620, 0.1, "sine", 0.18);
    }

    groundedRef.current = onGround;

    ball.vx = clamp(ball.vx, -MAX_SPEED, MAX_SPEED);
    ball.x = Math.max(ball.radius, ball.x);

    if (ball.y - ball.radius > CANVAS_HEIGHT + 120) {
      statusRef.current = "lost";
      setStatus("lost");
      return;
    }

    const hitCoins = [];
    coinsRef.current = coinsRef.current.filter((coin) => {
      const dx = coin.x - ball.x;
      const dy = coin.y - ball.y;
      const distanceToCoin = Math.hypot(dx, dy);
      const collected = distanceToCoin < coin.radius + ball.radius - 6;
      if (collected) {
        hitCoins.push(coin);
      }
      return !collected;
    });

    if (hitCoins.length) {
      setCoinsCollected((prev) => prev + hitCoins.length);
      playTone(880, 0.12, "square", 0.14);
    }

    const newDistance = Math.max(0, ball.x - 90);
    setDistance(Math.floor(newDistance));
    setTimeAlive((prev) => prev + delta);

    trailRef.current.push({ x: ball.x, y: ball.y, opacity: 1, time: 0 });
    trailRef.current = trailRef.current
      .map((point) => ({
        ...point,
        time: point.time + delta,
        opacity: Math.max(0, 1 - point.time * 1.5),
      }))
      .filter((point) => point.opacity > 0.05);
  };

  const drawScene = (ctx) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const ball = ballRef.current;
    const camera = clamp(ball.x - CANVAS_WIDTH * 0.35, 0, 9999);

    ctx.save();
    ctx.translate(-camera, 0);

    drawBackground(ctx, camera);
    drawPlatforms(ctx);
    drawCoins(ctx);
    drawTrail(ctx);
    drawBall(ctx);

    ctx.restore();
    drawHud(ctx);
  };

  const drawBackground = (ctx, camera) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#0d1b2a");
    gradient.addColorStop(1, "#1b263b");
    ctx.fillStyle = gradient;
    ctx.fillRect(camera, 0, CANVAS_WIDTH + camera, CANVAS_HEIGHT);

    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (
      let x = camera - (camera % 80);
      x < camera + CANVAS_WIDTH + 80;
      x += 80
    ) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, CANVAS_HEIGHT);
      ctx.stroke();
    }
  };

  const drawPlatforms = (ctx) => {
    ctx.fillStyle = PLATFORM_COLOR;
    for (const platform of levelPlatforms) {
      ctx.beginPath();
      ctx.roundRect(
        platform.x,
        platform.y,
        platform.width,
        platform.height,
        10
      );
      ctx.fill();
    }
  };

  const drawBall = (ctx) => {
    const ball = ballRef.current;
    const style = ballStyleRef.current;
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    ctx.beginPath();
    ctx.fillStyle = style.color;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = style.stripe;
    ctx.moveTo(0, 0);
    ctx.lineTo(ball.radius, 0);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -ball.radius);
    ctx.stroke();

    ctx.restore();
  };

  const drawTrail = (ctx) => {
    ctx.fillStyle = ballStyleRef.current.trail;
    for (const point of trailRef.current) {
      ctx.beginPath();
      ctx.globalAlpha = point.opacity;
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawCoins = (ctx) => {
    for (const coin of coinsRef.current) {
      ctx.save();
      ctx.translate(coin.x, coin.y);
      const gradient = ctx.createRadialGradient(0, 0, 3, 0, 0, coin.radius);
      gradient.addColorStop(0, "#fff2c3");
      gradient.addColorStop(1, "#f5a524");
      ctx.fillStyle = gradient;
      ctx.strokeStyle = "#2d1d00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, coin.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  const drawHud = (ctx) => {
    ctx.fillStyle = "#e0eaf5";
    ctx.font = "16px 'Inter', system-ui";
    ctx.fillText(`Distance: ${distance.toFixed(0)} px`, 16, 28);
    ctx.fillText(`Time: ${timeAlive.toFixed(1)}s`, 16, 48);
    ctx.fillText(`Coins: ${coinsCollected}`, 16, 68);
    ctx.fillText(`Sound: ${muted ? "Off" : "On"}`, 16, 88);
    ctx.fillText(
      status === "running"
        ? "Status: rolling"
        : status === "menu"
        ? "Status: menu"
        : "Status: fallen",
      16,
      108
    );

    ctx.textAlign = "right";
    ctx.fillText(
      "Controls: A/Left to roll left, D/Right to roll right, Space/Up to hop, R to reset",
      CANVAS_WIDTH - 16,
      CANVAS_HEIGHT - 20
    );
    ctx.textAlign = "left";

    if (status === "lost") {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(
        0,
        CANVAS_HEIGHT / 2 - 50,
        CANVAS_WIDTH,
        100
      );
      ctx.fillStyle = "#fefefe";
      ctx.font = "24px 'Inter', system-ui";
      ctx.textAlign = "center";
      ctx.fillText(
        "You tumbled off the course! Press R to reset.",
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2 + 8
      );
      ctx.textAlign = "left";
    }
  };

  return (
    <div className="game-wrapper">
      <div className="game-card">
        <div className="header">
          <div>
            <h1>Rolling Balance</h1>
            <p className="subtitle">
              Stay on the floating platforms while keeping your ball moving.
            </p>
          </div>
          <div className="header-actions">
            <button
              className={`ghost ${muted ? "active" : ""}`}
              onClick={() => setMuted((prev) => !prev)}
              aria-pressed={muted}
              aria-label={muted ? "Unmute game sounds" : "Mute game sounds"}
            >
              {muted ? "Sound off" : "Sound on"}
            </button>
            <button className="reset" onClick={resetGame} aria-label="Reset the run">
              Reset
            </button>
          </div>
        </div>
        <div className="selector-row">
          <div className="selector">
            <h2>Choose your ball</h2>
            <div className="ball-options">
              {BALL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  className={`ball-option ${
                    selectedBall.id === option.id ? "active" : ""
                  }`}
                  onClick={() => setSelectedBall(option)}
                  aria-pressed={selectedBall.id === option.id}
                  style={{
                    background: option.color,
                    color: option.id === "sunset" ? "#111" : "#041321",
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="start-card">
            <p className="start-copy">
              Collect coins, keep your speed in control, and hop with Space or the
              Up arrow.
            </p>
            <button className="primary" onClick={startFromMenu}>
              {status === "menu" ? "Start rolling" : "Restart with choice"}
            </button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="game-canvas"
        />
        <div className="info">
          <div>
            <strong>Distance:</strong> {distance.toFixed(0)} px
          </div>
          <div>
            <strong>Time:</strong> {timeAlive.toFixed(1)} s
          </div>
          <div>
            <strong>Coins:</strong> {coinsCollected}
          </div>
          <div
            className={`status ${
              status === "running" ? "running" : status === "menu" ? "menu" : "lost"
            }`}
          >
            {status === "running" ? "Rolling" : status === "menu" ? "Ready" : "Fell"}
          </div>
        </div>
        <p className="message">{message}</p>
      </div>
    </div>
  );
}
