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

const baseColors = {
  bold: color('bold'),
  dim: color('dim'),
  italic: color('italic'),
  underline: color('underline'),
  strikethrough: color('strikethrough'),
  red: color('red'),
  green: color('green'),
  yellow: color('yellow'),
  cyan: color('cyan'),
  magenta: color('magenta'),
  white: color('white'),
  gray: color('gray'),
  blue: color('blue')
};

// Defensive Proxy: if any unknown formatting property is accessed,
// return a no-op identity function rather than throwing TypeError.
export const pc = new Proxy(baseColors, {
  get(target, prop) {
    if (typeof prop === 'string' && prop in target) {
      return target[prop];
    }
    return (text) => String(text);
  }
});

export default pc;
