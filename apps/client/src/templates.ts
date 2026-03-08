import { SHIP_OPTIONS, type ShipId } from "@shared/index";

export const shipMap = new Map(SHIP_OPTIONS.map((ship) => [ship.id, ship]));
export const shipLabel = (shipId: ShipId) => shipMap.get(shipId)?.label ?? shipId;

export const shipPreviewSvg = (shipId: ShipId) => {
  const ship = shipMap.get(shipId);
  if (!ship) {
    return "";
  }

  return `
    <svg viewBox="0 0 96 96" aria-hidden="true">
      <path d="M48 10 L18 54 L35 72 L48 62 L61 72 L78 54 Z" fill="${ship.dark}" />
      <path d="M48 14 L24 54 L39 67 L48 58 L57 67 L72 54 Z" fill="${ship.primary}" />
      <rect x="40" y="18" width="16" height="42" rx="6" fill="${ship.primary}" />
      <rect x="44" y="21" width="8" height="24" rx="4" fill="${ship.trim}" />
      <rect x="21" y="48" width="10" height="18" rx="4" fill="${ship.primary}" />
      <rect x="65" y="48" width="10" height="18" rx="4" fill="${ship.primary}" />
      <rect x="33" y="39" width="8" height="18" fill="${ship.trim}" />
      <rect x="55" y="39" width="8" height="18" fill="${ship.trim}" />
      <circle cx="26" cy="72" r="5" fill="${ship.glow}" />
      <circle cx="70" cy="72" r="5" fill="${ship.glow}" />
      <path d="M26 72 L21 88 L31 88 Z" fill="#ffd9ae" opacity="0.82" />
      <path d="M70 72 L65 88 L75 88 Z" fill="#ffd9ae" opacity="0.82" />
    </svg>
  `;
};

export const heroBannerSvg = () => `
  <svg viewBox="0 0 520 170" aria-hidden="true" role="presentation">
    <defs>
      <linearGradient id="hero-bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0d1e35" />
        <stop offset="100%" stop-color="#09111f" />
      </linearGradient>
      <radialGradient id="hero-core" cx="50%" cy="38%" r="62%">
        <stop offset="0%" stop-color="#57b8ff" stop-opacity="0.7" />
        <stop offset="55%" stop-color="#17355d" stop-opacity="0.36" />
        <stop offset="100%" stop-color="#17355d" stop-opacity="0" />
      </radialGradient>
      <linearGradient id="beam-blue" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#8ce8ff" stop-opacity="0" />
        <stop offset="100%" stop-color="#8ce8ff" stop-opacity="0.88" />
      </linearGradient>
      <linearGradient id="beam-red" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#ff8aa6" stop-opacity="0" />
        <stop offset="100%" stop-color="#ff8aa6" stop-opacity="0.9" />
      </linearGradient>
      <linearGradient id="beam-green" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stop-color="#7df5c0" stop-opacity="0" />
        <stop offset="100%" stop-color="#7df5c0" stop-opacity="0.88" />
      </linearGradient>
    </defs>
    <rect width="520" height="170" rx="28" fill="url(#hero-bg)" />
    <rect x="1" y="1" width="518" height="168" rx="27" fill="none" stroke="#5eaef0" stroke-opacity="0.2" />
    <ellipse cx="258" cy="58" rx="150" ry="70" fill="url(#hero-core)" />
    <circle cx="433" cy="44" r="23" fill="#173e66" opacity="0.66" />
    <circle cx="433" cy="44" r="11" fill="#7dd8ff" opacity="0.72" />
    <g fill="#d7efff" opacity="0.75">
      <circle cx="49" cy="34" r="1.8" />
      <circle cx="101" cy="54" r="1.4" />
      <circle cx="154" cy="25" r="1.5" />
      <circle cx="317" cy="26" r="1.3" />
      <circle cx="387" cy="66" r="1.6" />
      <circle cx="470" cy="28" r="1.7" />
      <circle cx="455" cy="95" r="1.4" />
      <circle cx="74" cy="102" r="1.4" />
    </g>
    <g opacity="0.92">
      <ellipse cx="260" cy="42" rx="54" ry="18" fill="#163455" />
      <path d="M230 58 Q260 20 290 58" fill="#19375f" stroke="#6dd3ff" stroke-opacity="0.45" />
      <circle cx="260" cy="49" r="12" fill="#ffdc6b" />
      <circle cx="260" cy="49" r="5" fill="#ff7b53" />
      <path d="M237 63 L221 86 L237 83 Z" fill="#57d9ff" opacity="0.85" />
      <path d="M283 63 L299 86 L283 83 Z" fill="#57d9ff" opacity="0.85" />
    </g>
    <g transform="translate(85 72) scale(1.1)">
      <path d="M0 18 L14 0 L28 18 L21 32 L7 32 Z" fill="#ff5b59" />
      <rect x="11" y="8" width="6" height="20" fill="#f0f6ff" />
      <circle cx="7" cy="14" r="4" fill="#49c9ff" />
      <circle cx="21" cy="14" r="4" fill="#49c9ff" />
    </g>
    <g transform="translate(405 68) scale(1.1)">
      <path d="M0 18 L14 0 L28 18 L21 32 L7 32 Z" fill="#7c57ff" />
      <rect x="11" y="8" width="6" height="20" fill="#f0f6ff" />
      <circle cx="7" cy="14" r="4" fill="#7affcb" />
      <circle cx="21" cy="14" r="4" fill="#7affcb" />
    </g>
    <rect x="183" y="84" width="4" height="40" rx="2" fill="url(#beam-blue)" />
    <rect x="258" y="76" width="4" height="52" rx="2" fill="url(#beam-red)" />
    <rect x="333" y="84" width="4" height="40" rx="2" fill="url(#beam-green)" />
    <g transform="translate(144 94)">
      <path d="M40 0 L12 40 L26 57 L40 48 L54 57 L68 40 Z" fill="#1d3d65" />
      <path d="M40 4 L18 40 L30 52 L40 44 L50 52 L62 40 Z" fill="#62b8ff" />
      <rect x="33" y="8" width="14" height="34" rx="6" fill="#62b8ff" />
      <rect x="37" y="11" width="6" height="18" rx="3" fill="#dcefff" />
      <circle cx="18" cy="56" r="4" fill="#ffae4d" />
      <circle cx="62" cy="56" r="4" fill="#ffae4d" />
    </g>
    <g transform="translate(219 82) scale(1.08)">
      <path d="M40 0 L12 40 L26 57 L40 48 L54 57 L68 40 Z" fill="#612039" />
      <path d="M40 4 L18 40 L30 52 L40 44 L50 52 L62 40 Z" fill="#ff6885" />
      <rect x="33" y="8" width="14" height="34" rx="6" fill="#ff6885" />
      <rect x="37" y="11" width="6" height="18" rx="3" fill="#ffe1e8" />
      <circle cx="18" cy="56" r="4" fill="#ffad52" />
      <circle cx="62" cy="56" r="4" fill="#ffad52" />
    </g>
    <g transform="translate(294 94)">
      <path d="M40 0 L12 40 L26 57 L40 48 L54 57 L68 40 Z" fill="#175241" />
      <path d="M40 4 L18 40 L30 52 L40 44 L50 52 L62 40 Z" fill="#56d6a0" />
      <rect x="33" y="8" width="14" height="34" rx="6" fill="#56d6a0" />
      <rect x="37" y="11" width="6" height="18" rx="3" fill="#e0fff2" />
      <circle cx="18" cy="56" r="4" fill="#ffbf61" />
      <circle cx="62" cy="56" r="4" fill="#ffbf61" />
    </g>
  </svg>
`;
