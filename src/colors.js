import util from 'node:util';

/**
 * Native terminal styling built on node:util.styleText.
 * Enforces strict gating for NO_COLOR, NODE_DISABLE_COLORS, non-TTY streams,
 * and provides safe fallback on Node < 20.12.0 where styleText is not available.
 */
const styleText = util.styleText;
const isColorSupported = Boolean(
  typeof styleText === 'function' &&
  process.stdout &&
  process.stdout.isTTY &&
  process.env.NO_COLOR === undefined &&
  process.env.NODE_DISABLE_COLORS !== '1'
);

function color(style) {
  return (text) => (isColorSupported ? styleText(style, String(text)) : String(text));
}

export const pc = {
  bold: color('bold'),
  dim: color('dim'),
  red: color('red'),
  green: color('green'),
  yellow: color('yellow'),
  cyan: color('cyan'),
  magenta: color('magenta'),
  white: color('white'),
  gray: color('gray'),
  blue: color('blue')
};

export default pc;
