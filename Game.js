import React, { useEffect, useRef, useState } from "react";

const GRAVITY = 1400;
const ACCELERATION = 900;
const JUMP_FORCE = 640;
const GROUND_DRAG = 8;
const CANVAS_WIDTH = 960;
const CANVAS_HEIGHT = 560;

const PLATFORM_COLOR = "#2d2d54";
const BALL_COLOR = "#5bd1ff";
const TRAIL_COLOR = "rgba(91, 209, 255, 0.25)";

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
  const [distance, setDistance] = useState(0);
  const [status, setStatus] = useState("running");
  const [message, setMessage] = useState(
    "Keep rolling! Use A/D or the arrow keys to steer and Space to jump."
  );
  const [timeAlive, setTimeAlive] = useState(0);

  const ballRef = useRef({
    x: 90,
    y: 340,
    radius: 18,
    vx: 110,
    vy: 0,
    rotation: 0,
  });

  const trailRef = useRef([]);

  const resetGame = () => {
    ballRef.current = {
      x: 90,
      y: 340,
      radius: 18,
      vx: 110,
      vy: 0,
      rotation: 0,
    };
    trailRef.current = [];
    setDistance(0);
    setTimeAlive(0);
    setStatus("running");
    setMessage(
      "Keep rolling! Use A/D or the arrow keys to steer and Space to jump."
    );
    lastTick.current = performance.now();
    animationRef.current && cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code === "Space") {
        pressedKeys.current.add("Space");
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        pressedKeys.current.add("left");
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        pressedKeys.current.add("right");
      } else if (event.code === "KeyR") {
        resetGame();
      }
    };

    const handleKeyUp = (event) => {
      if (event.code === "Space") {
        pressedKeys.current.delete("Space");
      } else if (event.code === "ArrowLeft" || event.code === "KeyA") {
        pressedKeys.current.delete("left");
      } else if (event.code === "ArrowRight" || event.code === "KeyD") {
        pressedKeys.current.delete("right");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    lastTick.current = performance.now();
    animationRef.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      animationRef.current && cancelAnimationFrame(animationRef.current);
    };
  }, []);

  useEffect(() => {
    if (status === "lost") {
      setMessage("You fell! Press R or the Reset button to try again.");
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

    if (status === "running") {
      animationRef.current = requestAnimationFrame(loop);
    }
  };

  const updatePhysics = (delta) => {
    const ball = ballRef.current;
    let onGround = false;
    const prevY = ball.y;

    if (pressedKeys.current.has("left")) {
      ball.vx -= ACCELERATION * delta;
    }
    if (pressedKeys.current.has("right")) {
      ball.vx += ACCELERATION * delta;
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

      if (isOverPlatform && crossedThrough) {
        ball.y = top - ball.radius;
        ball.vy = 0;
        onGround = true;
      }
    }

    if (onGround) {
      const drag = Math.min(
        Math.abs(ball.vx),
        GROUND_DRAG * delta * 80
      );
      ball.vx -= Math.sign(ball.vx) * drag;
      if (pressedKeys.current.has("Space")) {
        ball.vy = -JUMP_FORCE;
      }
    }

    ball.vx = clamp(ball.vx, -400, 800);
    ball.x = Math.max(ball.radius, ball.x);

    if (ball.y - ball.radius > CANVAS_HEIGHT + 120) {
      setStatus("lost");
      return;
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
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    ctx.beginPath();
    ctx.fillStyle = BALL_COLOR;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
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
    ctx.fillStyle = TRAIL_COLOR;
    for (const point of trailRef.current) {
      ctx.beginPath();
      ctx.globalAlpha = point.opacity;
      ctx.arc(point.x, point.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  const drawHud = (ctx) => {
    ctx.fillStyle = "#e0eaf5";
    ctx.font = "16px 'Inter', system-ui";
    ctx.fillText(`Distance: ${distance.toFixed(0)} px`, 16, 28);
    ctx.fillText(`Time: ${timeAlive.toFixed(1)}s`, 16, 48);
    ctx.fillText(
      status === "running" ? "Status: rolling" : "Status: fallen",
      16,
      68
    );

    ctx.textAlign = "right";
    ctx.fillText(
      "Controls: A/Left to roll left, D/Right to roll right, Space to hop, R to reset",
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
          <button className="reset" onClick={resetGame} aria-label="Reset the run">
            Reset
          </button>
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
          <div className={`status ${status === "running" ? "running" : "lost"}`}>
            {status === "running" ? "Rolling" : "Fell"}
          </div>
        </div>
        <p className="message">{message}</p>
      </div>
    </div>
  );
}
