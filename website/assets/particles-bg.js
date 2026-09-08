/* ============================================================
   FrameLab 宣传页 · 瓦肯三角粒子交互背景
   来源：用户提供的 WYHlogo/index.html 粒子脚本，封装为页面底层背景。
   - Canvas 固定全屏、置于内容层之下（z-index 0），不拦截任何点击
   - 鼠标/触摸在窗口上划动即扰动粒子（涡流 + 外推 + 噪声 + 弹性回归）
   - prefers-reduced-motion：仅绘制静态一帧，不做动画
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('bgParticles');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 可调参数 ================= */
  var IMG_URL       = 'assets/WYHlogo.jpg';
  var GAP           = 4;            // 采样间隔（像素；移动端自动放大降低粒子数）
  var PARTICLE_SIZE = 3;
  var MOUSE_RADIUS  = 240;
  var REPEL_FORCE   = 0.18;
  var SWIRL_FORCE   = 1.35;
  var TURBULENCE    = 0.85;
  var JITTER        = 0.5;
  var NOISE_SCALE   = 0.02;
  var NOISE_SPEED   = 0.0026;
  var SPEED_BOOST   = 0.08;
  var EASE          = 0.11;
  var FRICTION      = 0.55;
  var THRESHOLD     = 128;          // 亮度阈值：<128 视为暗色笔画
  var COLOR_MODE    = 'origin';     // 保留明暗层次映射到可见区间
  var ORIGIN_MIN    = 55;
  var ORIGIN_MAX    = 150;      // 背景氛围化：整体压浅，衬托内容
  var LOGO_CX       = 0.32;     // logo 中心在屏宽的横向位置（0.5=居中，<0.5 靠左）
  var GLITCH        = 0.10;
  /* ========================================== */

  var off = document.createElement('canvas');
  var offCtx = off.getContext('2d', { willReadFrequently: true });

  var particles = [];
  var mouse = { x: -9999, y: -9999 };
  var mouseBoost = 1;
  var W = 0, H = 0, imgW = 0, imgH = 0;
  var running = false;

  function Particle(ox, oy, color) {
    this.ox = ox; this.oy = oy;
    this.x = W / 2 + (Math.random() - 0.5) * W;
    this.y = H / 2 + (Math.random() - 0.5) * H;
    this.vx = 0; this.vy = 0;
    this.size = PARTICLE_SIZE * (0.6 + Math.random() * 0.6);
    this.color = color;
    this.phase = Math.random() * Math.PI * 2;
  }

  Particle.prototype.update = function (t) {
    var dx = this.x - mouse.x, dy = this.y - mouse.y;
    var dist = Math.hypot(dx, dy);
    if (dist < MOUSE_RADIUS && dist > 0.01) {
      var f = 1 - dist / MOUSE_RADIUS;
      var g = Math.pow(f, 1.4) * mouseBoost;
      var ux = dx / dist, uy = dy / dist;
      this.vx += ux * g * REPEL_FORCE;
      this.vy += uy * g * REPEL_FORCE;
      this.vx += -uy * g * SWIRL_FORCE;
      this.vy +=  ux * g * SWIRL_FORCE;
      var ang = (Math.sin(this.ox * NOISE_SCALE + t * NOISE_SPEED) +
                 Math.cos(this.oy * NOISE_SCALE - t * NOISE_SPEED * 0.8)) * Math.PI;
      this.vx += Math.cos(ang) * g * TURBULENCE;
      this.vy += Math.sin(ang) * g * TURBULENCE;
      this.vx += (Math.random() - 0.5) * g * JITTER * 2;
      this.vy += (Math.random() - 0.5) * g * JITTER * 2;
    }
    this.vx += (this.ox - this.x) * EASE;
    this.vy += (this.oy - this.y) * EASE;
    this.vx *= FRICTION;
    this.vy *= FRICTION;
    this.x += this.vx + Math.cos(t * 0.001 + this.phase) * GLITCH;
    this.y += this.vy + Math.sin(t * 0.001 + this.phase) * GLITCH;
  };

  Particle.prototype.draw = function () {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
  };

  function pickColor(r, g, b) {
    var lum = Math.min(0.299 * r + 0.587 * g + 0.114 * b, THRESHOLD);
    var v = Math.round(ORIGIN_MIN + (lum / THRESHOLD) * (ORIGIN_MAX - ORIGIN_MIN));
    return 'rgb(' + v + ',' + v + ',' + v + ')';
  }

  function gapFor() {
    // 移动端/窄屏放大采样间隔，控制粒子数量保证流畅
    return W < 768 ? Math.max(GAP + 2, Math.round(GAP * 1.5)) : GAP;
  }

  function buildParticles() {
    off.width = imgW; off.height = imgH;
    offCtx.clearRect(0, 0, imgW, imgH);
    offCtx.drawImage(img, 0, 0);
    var data;
    try {
      data = offCtx.getImageData(0, 0, imgW, imgH).data;
    } catch (e) {
      return; // 跨域等异常时静默降级为纯渐变背景
    }
    particles = [];
    var scale = Math.min(W / imgW, H / imgH) * 0.85;
    var dispW = imgW * scale, dispH = imgH * scale;
    var offX = W * LOGO_CX - dispW / 2, offY = (H - dispH) / 2;
    var gap = Math.max(1, Math.round(gapFor() / scale));
    for (var y = 0; y < imgH; y += gap) {
      for (var x = 0; x < imgW; x += gap) {
        var i = (y * imgW + x) * 4;
        var r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;
        var brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        if (brightness > THRESHOLD) continue;
        particles.push(new Particle(offX + x * scale, offY + y * scale, pickColor(r, g, b)));
      }
    }
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    if (imgW) {
      buildParticles();
      if (reduced) drawStatic(); // 减动效：重采样后重绘静态帧
    }
  }

  /* ---------- 鼠标 & 触摸（窗口级监听，不依赖 canvas 命中） ---------- */
  window.addEventListener('mousemove', function (e) {
    var speed = mouse.x < -1000 ? 0 : Math.hypot(e.clientX - mouse.x, e.clientY - mouse.y);
    mouseBoost = Math.min(2.8, 0.9 + speed * SPEED_BOOST);
    mouse.x = e.clientX; mouse.y = e.clientY;
  }, { passive: true });
  document.addEventListener('mouseleave', function () {
    mouse.x = -9999; mouse.y = -9999; mouseBoost = 1;
  });
  window.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!t) return;
    var speed = mouse.x < -1000 ? 0 : Math.hypot(t.clientX - mouse.x, t.clientY - mouse.y);
    mouseBoost = Math.min(2.8, 0.9 + speed * SPEED_BOOST);
    mouse.x = t.clientX; mouse.y = t.clientY;
  }, { passive: true });
  window.addEventListener('touchend', function () { mouse.x = -9999; mouse.y = -9999; });

  /* ---------- 主循环 ---------- */
  var last = 0;
  function loop(t) {
    ctx.clearRect(0, 0, W, H);
    mouseBoost += (1 - mouseBoost) * 0.12;
    for (var i = 0; i < particles.length; i++) {
      particles[i].update(t);
      particles[i].draw();
    }
    requestAnimationFrame(loop);
  }

  function drawStatic() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < particles.length; i++) particles[i].draw();
  }

  window.addEventListener('resize', resize);

  var img = new Image();
  img.onload = function () {
    imgW = img.width; imgH = img.height;
    resize();
    if (reduced) {
      drawStatic(); // 减动效：仅静态一帧
    } else if (!running) {
      running = true;
      requestAnimationFrame(loop);
    }
  };
  img.onerror = function () { /* 图片缺失时静默保留纯渐变背景 */ };
  img.src = IMG_URL;
})();
