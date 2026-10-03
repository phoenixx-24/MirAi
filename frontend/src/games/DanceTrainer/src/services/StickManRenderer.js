import { REST_POSE, STICK_MAN_CONNECTIONS } from '../utils/stickManPoses';

/**
 * StickManRenderer
 * Pure canvas rendering engine for the concert stage and AI stick-man dancer.
 * Decoupled from React state and animation timers.
 */
export class StickManRenderer {
  constructor() {
    // Generate static concert background lights (pin-lights)
    this.backgroundLights = Array.from({ length: 45 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.75, // in upper background
      radius: Math.random() * 1.5 + 0.8,
      alpha: Math.random() * 0.5 + 0.25,
      pulseSpeed: Math.random() * 0.02 + 0.01,
      phase: Math.random() * Math.PI * 2,
    }));
  }

  /**
   * Main render call
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} width - Canvas physical pixel width
   * @param {number} height - Canvas physical pixel height
   * @param {object} [pose=REST_POSE] - Current joint positions (normalized 0..1)
   * @param {number} [time=0] - Millisecond timestamp for subtle concert light breathing
   */
  render(ctx, width, height, pose = REST_POSE, time = 0) {
    if (!ctx || width <= 0 || height <= 0) return;

    // 1. Deep Concert Black Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, width, height);

    // 2. Small White Concert-Style Lights in Background
    this.drawBackgroundLights(ctx, width, height, time);

    // 3. Stage Floor Perspective Line
    this.drawStageFloor(ctx, width, height);

    // 4. Large Circular White Spotlight Centered on Stick Man
    this.drawSpotlight(ctx, width, height, pose);

    // 5. Connect Skeleton Bones with Lines
    this.drawBones(ctx, width, height, pose);

    // 6. Draw Visible Joint Points (Head, Shoulders, Elbows, Hands, Knees, Feet)
    this.drawJoints(ctx, width, height, pose);
  }

  /**
   * Draw small twinkling white concert-style background lights
   */
  drawBackgroundLights(ctx, width, height, time) {
    ctx.save();
    this.backgroundLights.forEach((light) => {
      const px = light.x * width;
      const py = light.y * height;
      const pulsatingAlpha = light.alpha + Math.sin(time * light.pulseSpeed + light.phase) * 0.15;
      const safeAlpha = Math.max(0.1, Math.min(0.9, pulsatingAlpha));

      ctx.fillStyle = `rgba(255, 255, 255, ${safeAlpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, light.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  /**
   * Draw subtle concert stage floor line and horizon
   */
  drawStageFloor(ctx, width, height) {
    const floorY = height * 0.88;
    ctx.save();

    // Subtle horizontal stage edge
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.25)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.15)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    ctx.lineTo(width, floorY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw large white circular spotlight centered on the stick man
   */
  drawSpotlight(ctx, width, height, pose) {
    const centerX = (pose.head?.x ?? 0.5) * width;
    const bodyCenterY = height * 0.52;
    const spotlightRadius = Math.min(width, height) * 0.44;

    ctx.save();

    // Overhead conical spotlight beam glow
    const beamGrad = ctx.createRadialGradient(
      centerX,
      height * 0.05,
      20,
      centerX,
      bodyCenterY,
      spotlightRadius * 1.3
    );
    beamGrad.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
    beamGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.08)');
    beamGrad.addColorStop(0.8, 'rgba(255, 255, 255, 0.02)');
    beamGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.arc(centerX, bodyCenterY, spotlightRadius * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Floor spotlight ellipse under feet
    const floorY = height * 0.88;
    const floorGrad = ctx.createRadialGradient(
      centerX,
      floorY,
      5,
      centerX,
      floorY,
      spotlightRadius * 0.85
    );
    floorGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
    floorGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.18)');
    floorGrad.addColorStop(0.7, 'rgba(255, 255, 255, 0.05)');
    floorGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(centerX, floorY, spotlightRadius * 0.8, spotlightRadius * 0.18, 0, 0, Math.PI * 2);
    ctx.fillStyle = floorGrad;
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /**
   * Draw connecting bones between joint points
   */
  drawBones(ctx, width, height, pose) {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Crisp white bone color with subtle soft glow
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = 'rgba(255, 255, 255, 0.85)';
    ctx.shadowBlur = 10;

    STICK_MAN_CONNECTIONS.forEach(([j1, j2]) => {
      const p1 = pose[j1];
      const p2 = pose[j2];
      if (!p1 || !p2) return;

      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    });

    ctx.restore();
  }

  /**
   * Draw visible joint points:
   * - Head
   * - Shoulders
   * - Elbows
   * - Hands
   * - Knees
   * - Feet
   */
  drawJoints(ctx, width, height, pose) {
    ctx.save();

    // 1. Head (prominent circular joint)
    if (pose.head) {
      const hx = pose.head.x * width;
      const hy = pose.head.y * height;
      const headRadius = Math.min(width, height) * 0.045;

      ctx.save();
      ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowBlur = 14;

      // Outer head ring
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, hy, headRadius, 0, Math.PI * 2);
      ctx.fill();

      // Subtle stylish visor / inner core
      ctx.fillStyle = '#0a0a0e';
      ctx.beginPath();
      ctx.arc(hx, hy, headRadius * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Visible Joint Markers List
    const jointList = [
      { key: 'leftShoulder', radius: 7, label: 'L Shoulder' },
      { key: 'rightShoulder', radius: 7, label: 'R Shoulder' },
      { key: 'leftElbow', radius: 6, label: 'L Elbow' },
      { key: 'rightElbow', radius: 6, label: 'R Elbow' },
      { key: 'leftHand', radius: 7, label: 'L Hand' },
      { key: 'rightHand', radius: 7, label: 'R Hand' },
      { key: 'leftKnee', radius: 6, label: 'L Knee' },
      { key: 'rightKnee', radius: 6, label: 'R Knee' },
      { key: 'leftFoot', radius: 7, label: 'L Foot' },
      { key: 'rightFoot', radius: 7, label: 'R Foot' },
    ];

    jointList.forEach(({ key, radius }) => {
      const pt = pose[key];
      if (!pt) return;

      const px = pt.x * width;
      const py = pt.y * height;

      // Glow halo
      ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
      ctx.shadowBlur = 12;

      // Solid white node
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py, radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner contrast center
      ctx.fillStyle = '#181824';
      ctx.beginPath();
      ctx.arc(px, py, radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }
}

export const stickManRenderer = new StickManRenderer();
export default stickManRenderer;
