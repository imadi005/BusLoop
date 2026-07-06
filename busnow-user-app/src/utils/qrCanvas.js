const QR_VERSION = 3;
const QR_SIZE = QR_VERSION * 4 + 17;
const DATA_CODEWORDS = 55;
const ECC_CODEWORDS = 15;
const MASK_PATTERN = 0;

const textBytes = (text) => {
  if (typeof TextEncoder !== 'undefined') return Array.from(new TextEncoder().encode(text));
  return Array.from(String(text)).map((char) => char.charCodeAt(0) & 0xff);
};

const gfMul = (x, y) => {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
};

const gfPow = (power) => {
  let result = 1;
  for (let i = 0; i < power; i++) result = gfMul(result, 0x02);
  return result;
};

const rsGenerator = (degree) => {
  let result = [1];
  for (let i = 0; i < degree; i++) {
    const next = Array(result.length + 1).fill(0);
    result.forEach((coefficient, index) => {
      next[index] ^= coefficient;
      next[index + 1] ^= gfMul(coefficient, gfPow(i));
    });
    result = next;
  }
  return result;
};

const rsRemainder = (data, degree) => {
  const generator = rsGenerator(degree);
  const result = [...data, ...Array(degree).fill(0)];

  data.forEach((_, index) => {
    const factor = result[index];
    if (!factor) return;
    generator.forEach((coefficient, offset) => {
      result[index + offset] ^= gfMul(coefficient, factor);
    });
  });

  return result.slice(data.length);
};

class BitBuffer {
  constructor() {
    this.bits = [];
  }

  append(value, length) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }

  toBytes() {
    const result = [];
    for (let i = 0; i < this.bits.length; i += 8) {
      let value = 0;
      for (let j = 0; j < 8; j++) value = (value << 1) | (this.bits[i + j] || 0);
      result.push(value);
    }
    return result;
  }
}

const createDataCodewords = (text) => {
  const bytes = textBytes(text);
  if (bytes.length > 50) throw new Error('QR text is too long for ticket renderer.');

  const buffer = new BitBuffer();
  buffer.append(0b0100, 4);
  buffer.append(bytes.length, 8);
  bytes.forEach((byte) => buffer.append(byte, 8));

  const capacityBits = DATA_CODEWORDS * 8;
  buffer.append(0, Math.min(4, capacityBits - buffer.bits.length));
  while (buffer.bits.length % 8) buffer.append(0, 1);

  const data = buffer.toBytes();
  for (let pad = 0xec; data.length < DATA_CODEWORDS; pad ^= 0xfd) data.push(pad);
  return data;
};

const emptyMatrix = () => ({
  modules: Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false)),
  reserved: Array.from({ length: QR_SIZE }, () => Array(QR_SIZE).fill(false)),
});

const setModule = (matrix, x, y, dark, reserve = true) => {
  if (x < 0 || y < 0 || x >= QR_SIZE || y >= QR_SIZE) return;
  matrix.modules[y][x] = Boolean(dark);
  if (reserve) matrix.reserved[y][x] = true;
};

const drawFinder = (matrix, x, y) => {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(matrix, xx, yy, distance === 3 || distance <= 1);
    }
  }
};

const drawAlignment = (matrix, x, y) => {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(matrix, x + dx, y + dy, distance === 2 || distance === 0);
    }
  }
};

const drawFunctionPatterns = (matrix) => {
  drawFinder(matrix, 3, 3);
  drawFinder(matrix, QR_SIZE - 4, 3);
  drawFinder(matrix, 3, QR_SIZE - 4);
  drawAlignment(matrix, 22, 22);

  for (let i = 0; i < QR_SIZE; i++) {
    if (!matrix.reserved[6][i]) setModule(matrix, i, 6, i % 2 === 0);
    if (!matrix.reserved[i][6]) setModule(matrix, 6, i, i % 2 === 0);
  }

  setModule(matrix, 8, QR_SIZE - 8, true);

  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setModule(matrix, 8, i, false);
      setModule(matrix, i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setModule(matrix, QR_SIZE - 1 - i, 8, false);
    setModule(matrix, 8, QR_SIZE - 1 - i, false);
  }
};

const shouldMask = (x, y) => (x + y) % 2 === 0;

const drawCodewords = (matrix, codewords) => {
  const bits = [];
  codewords.forEach((byte) => {
    for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
  });

  let bitIndex = 0;
  let upward = true;
  for (let right = QR_SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right--;
    for (let vert = 0; vert < QR_SIZE; vert++) {
      const y = upward ? QR_SIZE - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        if (matrix.reserved[y][x]) continue;
        const bit = bitIndex < bits.length ? bits[bitIndex++] === 1 : false;
        setModule(matrix, x, y, bit !== shouldMask(x, y), false);
      }
    }
    upward = !upward;
  }
};

const formatBits = () => {
  const eclLow = 1;
  const data = (eclLow << 3) | MASK_PATTERN;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
};

const drawFormatBits = (matrix) => {
  const bits = formatBits();
  const bit = (i) => ((bits >>> i) & 1) !== 0;

  for (let i = 0; i <= 5; i++) setModule(matrix, 8, i, bit(i));
  setModule(matrix, 8, 7, bit(6));
  setModule(matrix, 8, 8, bit(7));
  setModule(matrix, 7, 8, bit(8));
  for (let i = 9; i < 15; i++) setModule(matrix, 14 - i, 8, bit(i));

  for (let i = 0; i < 8; i++) setModule(matrix, QR_SIZE - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) setModule(matrix, 8, QR_SIZE - 15 + i, bit(i));
  setModule(matrix, 8, QR_SIZE - 8, true);
};

export function createTicketQRMatrix(text) {
  const data = createDataCodewords(String(text || ''));
  const matrix = emptyMatrix();
  drawFunctionPatterns(matrix);
  drawCodewords(matrix, [...data, ...rsRemainder(data, ECC_CODEWORDS)]);
  drawFormatBits(matrix);
  return matrix.modules;
}

export function drawTicketQR(canvas, text, options = {}) {
  if (!canvas || !text) return false;
  const modules = createTicketQRMatrix(text);
  const ctx = canvas.getContext('2d');
  const size = options.size || canvas.width || 180;
  const quiet = options.quiet ?? 4;
  const moduleSize = Math.floor(size / (QR_SIZE + quiet * 2));
  const qrPixels = moduleSize * (QR_SIZE + quiet * 2);
  const offset = Math.floor((size - qrPixels) / 2);

  canvas.width = size;
  canvas.height = size;
  ctx.fillStyle = options.light || '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = options.dark || '#111827';

  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (!dark) return;
      ctx.fillRect(
        offset + (x + quiet) * moduleSize,
        offset + (y + quiet) * moduleSize,
        moduleSize,
        moduleSize
      );
    });
  });
  return true;
}
