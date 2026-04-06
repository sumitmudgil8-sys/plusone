import sharp from 'sharp';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function createIconSVG(size) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const cornerR = s * 0.22;

  // --- "+1" wordmark geometry ---
  // The unit is centered slightly left overall to balance optical weight

  // "+" symbol: centered at (cx - s*0.12, cy)
  const plusCX = cx - s * 0.115;
  const plusCY = cy;
  const barW  = s * 0.082;   // bar thickness
  const armL  = s * 0.195;   // half arm length

  // "1" symbol: centered at (cx + s*0.195, cy)
  const oneCX = cx + s * 0.2;
  const oneCY = cy;
  const stemW = s * 0.075;   // stem width
  const stemH = s * 0.215;   // stem half-height
  const baseW = s * 0.148;   // bottom base half-width
  const baseH = s * 0.038;   // base height
  const diagLen = s * 0.095; // diagonal top serif length

  // Plus path
  const plusPath = `
    M ${plusCX - barW/2} ${plusCY - armL}
    L ${plusCX + barW/2} ${plusCY - armL}
    L ${plusCX + barW/2} ${plusCY - barW/2}
    L ${plusCX + armL}   ${plusCY - barW/2}
    L ${plusCX + armL}   ${plusCY + barW/2}
    L ${plusCX + barW/2} ${plusCY + barW/2}
    L ${plusCX + barW/2} ${plusCY + armL}
    L ${plusCX - barW/2} ${plusCY + armL}
    L ${plusCX - barW/2} ${plusCY + barW/2}
    L ${plusCX - armL}   ${plusCY + barW/2}
    L ${plusCX - armL}   ${plusCY - barW/2}
    L ${plusCX - barW/2} ${plusCY - barW/2}
    Z
  `;

  // "1" path: stem + base serif + angled top-left stroke
  // Outer outline: top-left serif → stem → base
  const stemTop = oneCY - stemH;
  const stemBot = oneCY + stemH;
  const onePath = `
    M ${oneCX - stemW * 0.5 - diagLen} ${stemTop + diagLen * 0.7}
    L ${oneCX - stemW * 0.5}           ${stemTop}
    L ${oneCX + stemW * 0.5}           ${stemTop}
    L ${oneCX + stemW * 0.5}           ${stemBot - baseH}
    L ${oneCX + baseW}                 ${stemBot - baseH}
    L ${oneCX + baseW}                 ${stemBot}
    L ${oneCX - baseW}                 ${stemBot}
    L ${oneCX - baseW}                 ${stemBot - baseH}
    L ${oneCX - stemW * 0.5}           ${stemBot - baseH}
    L ${oneCX - stemW * 0.5}           ${stemTop + diagLen * 0.7}
    Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bgGrad" x1="10%" y1="0%" x2="90%" y2="100%">
      <stop offset="0%"   style="stop-color:#1A1628"/>
      <stop offset="45%"  style="stop-color:#0E0C1A"/>
      <stop offset="100%" style="stop-color:#080810"/>
    </linearGradient>

    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   style="stop-color:#F8EAB0"/>
      <stop offset="25%"  style="stop-color:#EDD078"/>
      <stop offset="60%"  style="stop-color:#C9A84C"/>
      <stop offset="100%" style="stop-color:#9A7428"/>
    </linearGradient>

    <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="60%" y2="100%">
      <stop offset="0%"   style="stop-color:#FDF0C0"/>
      <stop offset="40%"  style="stop-color:#E8C96E"/>
      <stop offset="100%" style="stop-color:#B08830"/>
    </linearGradient>

    <!-- Soft glow on shapes -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${s * 0.016}" result="blur"/>
      <feBlend in="SourceGraphic" in2="blur" mode="screen"/>
    </filter>

    <!-- Stronger ambient glow layer -->
    <filter id="ambientGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${s * 0.045}" result="blur"/>
      <feColorMatrix in="blur" type="matrix"
        values="1 0.8 0 0 0  0.8 0.6 0 0 0  0 0 0 0 0  0 0 0 0.55 0" result="colored"/>
      <feBlend in="SourceGraphic" in2="colored" mode="screen"/>
    </filter>

    <clipPath id="roundedSquare">
      <rect width="${s}" height="${s}" rx="${cornerR}" ry="${cornerR}"/>
    </clipPath>

    <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
      <stop offset="20%" style="stop-color:#000000;stop-opacity:0"/>
      <stop offset="100%" style="stop-color:#000000;stop-opacity:0.55"/>
    </radialGradient>

    <radialGradient id="centerShine" cx="38%" cy="35%" r="55%">
      <stop offset="0%"   style="stop-color:#2E2450;stop-opacity:0.7"/>
      <stop offset="100%" style="stop-color:#080810;stop-opacity:0"/>
    </radialGradient>
  </defs>

  <g clip-path="url(#roundedSquare)">
    <!-- Background -->
    <rect width="${s}" height="${s}" fill="url(#bgGrad)"/>
    <rect width="${s}" height="${s}" fill="url(#centerShine)"/>

    <!-- Ambient gold glow blobs (behind the shapes) -->
    <ellipse cx="${plusCX}" cy="${plusCY}" rx="${s*0.25}" ry="${s*0.25}"
      fill="#C9A84C" opacity="0.07" filter="url(#ambientGlow)"/>
    <ellipse cx="${oneCX}" cy="${oneCY}" rx="${s*0.16}" ry="${s*0.22}"
      fill="#C9A84C" opacity="0.06" filter="url(#ambientGlow)"/>

    <!-- Drop shadow for "+" -->
    <path d="${plusPath}" fill="#000" opacity="0.45"
      transform="translate(${s*0.01},${s*0.013})"/>

    <!-- Main "+" with gold gradient + glow -->
    <path d="${plusPath}" fill="url(#goldGrad)" filter="url(#glow)"/>

    <!-- "+" top-edge shimmer -->
    <path d="${plusPath}" fill="none" stroke="#FFF8E0"
      stroke-width="${s*0.006}" stroke-linejoin="round" opacity="0.15"/>

    <!-- Drop shadow for "1" -->
    <path d="${onePath}" fill="#000" opacity="0.45"
      transform="translate(${s*0.01},${s*0.013})"/>

    <!-- Main "1" with gold gradient + glow -->
    <path d="${onePath}" fill="url(#goldGrad2)" filter="url(#glow)"/>

    <!-- "1" top-edge shimmer -->
    <path d="${onePath}" fill="none" stroke="#FFF8E0"
      stroke-width="${s*0.006}" stroke-linejoin="round" opacity="0.15"/>

    <!-- Thin gold divider line under the "+1" -->
    <line
      x1="${cx - s*0.32}" y1="${cy + s*0.285}"
      x2="${cx + s*0.32}" y2="${cy + s*0.285}"
      stroke="url(#goldGrad)" stroke-width="${s*0.004}" opacity="0.5"/>

    <!-- Vignette -->
    <rect width="${s}" height="${s}" fill="url(#vignetteGrad)"/>

    <!-- Sparkle accents -->
    <circle cx="${s*0.14}" cy="${s*0.15}" r="${s*0.013}" fill="#EDD078" opacity="0.45"/>
    <circle cx="${s*0.19}" cy="${s*0.09}" r="${s*0.006}" fill="#FDF0C0" opacity="0.55"/>
    <circle cx="${s*0.10}" cy="${s*0.22}" r="${s*0.005}" fill="#FDF0C0" opacity="0.40"/>

    <circle cx="${s*0.87}" cy="${s*0.84}" r="${s*0.009}" fill="#EDD078" opacity="0.35"/>
    <circle cx="${s*0.91}" cy="${s*0.90}" r="${s*0.005}" fill="#FDF0C0" opacity="0.40"/>
    <circle cx="${s*0.83}" cy="${s*0.91}" r="${s*0.004}" fill="#FDF0C0" opacity="0.30"/>
  </g>
</svg>`;
}

async function generateIcon(size, outputPath) {
  const svgBuffer = Buffer.from(createIconSVG(size));
  await sharp(svgBuffer)
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(outputPath);
  console.log(`Generated: ${outputPath} (${size}x${size})`);
}

const iconsDir = join(__dirname, '../public/icons');

await Promise.all([
  generateIcon(192, join(iconsDir, 'icon-192.png')),
  generateIcon(512, join(iconsDir, 'icon-512.png')),
  generateIcon(180, join(iconsDir, 'apple-touch-icon.png')),
  generateIcon(152, join(iconsDir, 'apple-touch-icon-152.png')),
  generateIcon(167, join(iconsDir, 'apple-touch-icon-167.png')),
  generateIcon(32,  join(iconsDir, 'favicon-32.png')),
]);

console.log('All icons generated successfully!');
