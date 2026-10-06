/**
 * Gerador minimalista e puro de matriz QR Code (sem dependências externas de npm).
 *
 * Suporta codificação Byte (UTF-8/ASCII) até a versão 6 (capacidade para até 134 bytes),
 * ideal para URLs de verificação documental e hashes de integridade.
 */

// Tabela de capacidades para nível de correção L (Low - 7%)
const QR_CAPACITIES_L = [
  { version: 1, size: 21, totalCodewords: 26, dataCodewords: 19, ecCodewords: 7, blocks: 1, alignPos: [] },
  { version: 2, size: 25, totalCodewords: 44, dataCodewords: 34, ecCodewords: 10, blocks: 1, alignPos: [6, 18] },
  { version: 3, size: 29, totalCodewords: 70, dataCodewords: 55, ecCodewords: 15, blocks: 1, alignPos: [6, 22] },
  { version: 4, size: 33, totalCodewords: 100, dataCodewords: 80, ecCodewords: 20, blocks: 1, alignPos: [6, 26] },
  { version: 5, size: 37, totalCodewords: 134, dataCodewords: 108, ecCodewords: 26, blocks: 1, alignPos: [6, 30] },
  { version: 6, size: 41, totalCodewords: 172, dataCodewords: 136, ecCodewords: 18, blocks: 2, alignPos: [6, 34] },
];

// GF(256) exponenciais e logaritmos
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d; // Polinômio irredutível 285
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0;
  return GF_EXP[GF_LOG[x] + GF_LOG[y]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], root);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[ecCount - 1 - j], factor);
    }
    remainder[ecCount - 1] = gfMul(gen[0], factor);
  }
  return remainder;
}

/**
 * Gera matriz booleana (true = módulo escuro, false = módulo claro)
 * para uma URL ou string qualquer.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const rawBytes = new TextEncoder().encode(text);
  const dataLen = rawBytes.length;

  // Seleciona a menor versão capaz de conter dataLen bytes
  const info = QR_CAPACITIES_L.find((c) => c.dataCodewords >= dataLen + 3);
  if (!info) {
    throw new Error(`Texto muito longo para QR Code leve (${dataLen} bytes). Máximo suportado: 133 bytes.`);
  }

  const { size, dataCodewords, ecCodewords, blocks, alignPos } = info;

  // Construção do fluxo de bits (Byte mode 0100 + comprimento 8 bits + dados + terminator)
  const bitStream: number[] = [];
  function pushBits(val: number, len: number) {
    for (let i = len - 1; i >= 0; i--) {
      bitStream.push((val >> i) & 1);
    }
  }

  pushBits(0b0100, 4); // Byte mode indicator
  pushBits(dataLen, 8); // Comprimento em bytes
  for (let i = 0; i < dataLen; i++) {
    pushBits(rawBytes[i], 8);
  }
  // Terminador
  const remainingBits = dataCodewords * 8 - bitStream.length;
  pushBits(0, Math.min(4, remainingBits));

  // Alinhamento em bytes
  while (bitStream.length % 8 !== 0) {
    bitStream.push(0);
  }

  // Preenchimento com bytes alternados 0xEC e 0x11
  const dataBytes = new Uint8Array(dataCodewords);
  let byteIdx = 0;
  for (let i = 0; i < bitStream.length; i += 8) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      byteVal = (byteVal << 1) | bitStream[i + b];
    }
    dataBytes[byteIdx++] = byteVal;
  }
  let padToggle = true;
  while (byteIdx < dataCodewords) {
    dataBytes[byteIdx++] = padToggle ? 0xec : 0x11;
    padToggle = !padToggle;
  }

  // Correção de erro Reed-Solomon por blocos
  const totalCodewords = info.totalCodewords;
  const finalCodewords = new Uint8Array(totalCodewords);

  if (blocks === 1) {
    const ecBytes = rsCompute(dataBytes, ecCodewords);
    finalCodewords.set(dataBytes, 0);
    finalCodewords.set(ecBytes, dataCodewords);
  } else {
    // Intercalação de 2 blocos (para versão 6)
    const blockDataLen = Math.floor(dataCodewords / blocks);
    const b1Data = dataBytes.subarray(0, blockDataLen);
    const b2Data = dataBytes.subarray(blockDataLen, dataCodewords);
    const b1Ec = rsCompute(b1Data, ecCodewords);
    const b2Ec = rsCompute(b2Data, ecCodewords);

    let idx = 0;
    for (let i = 0; i < blockDataLen; i++) {
      finalCodewords[idx++] = b1Data[i];
      finalCodewords[idx++] = b2Data[i];
    }
    for (let i = 0; i < ecCodewords; i++) {
      finalCodewords[idx++] = b1Ec[i];
      finalCodewords[idx++] = b2Ec[i];
    }
  }

  // Matriz de módulos e matriz de ocupação
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  function setModule(r: number, c: number, dark: boolean, isFunc = true) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = dark;
      if (isFunc) isFunction[r][c] = true;
    }
  }

  // 1. Finder patterns (3 cantos: topo-esquerdo, topo-direito, baixo-esquerdo)
  function placeFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
          const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
          const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          setModule(nr, nc, isBorder || isCenter);
        } else {
          // Separator (borda branca)
          setModule(nr, nc, false);
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 2. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0);
    setModule(i, 6, i % 2 === 0);
  }

  // 3. Dark module fixo
  setModule(size - 8, 8, true);

  // 4. Alignment patterns
  if (alignPos.length > 0) {
    for (const r of alignPos) {
      for (const c of alignPos) {
        // Evita sobrepor finders
        if (
          (r === 6 && c === 6) ||
          (r === 6 && c === size - 7) ||
          (r === size - 7 && c === 6)
        ) {
          continue;
        }
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const isBorder = Math.abs(dr) === 2 || Math.abs(dc) === 2;
            const isCenter = dr === 0 && dc === 0;
            setModule(r + dr, c + dc, isBorder || isCenter);
          }
        }
      }
    }
  }

  // 5. Reserva de áreas de formato
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setModule(8, i, false);
      setModule(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setModule(8, size - 1 - i, false);
    setModule(size - 1 - i, 8, false);
  }

  // 6. Colocação dos bits de dados (em zigue-zague com máscara 0: (row + col) % 2 === 0)
  let bitIndex = 0;
  const totalBits = totalCodewords * 8;
  let upwards = true;

  for (let c = size - 1; c > 0; c -= 2) {
    if (c === 6) c--; // Pula coluna de timing vertical
    for (let rStep = 0; rStep < size; rStep++) {
      const r = upwards ? size - 1 - rStep : rStep;
      for (let colStep = 0; colStep < 2; colStep++) {
        const col = c - colStep;
        if (!isFunction[r][col]) {
          let bit = false;
          if (bitIndex < totalBits) {
            const byte = finalCodewords[Math.floor(bitIndex / 8)];
            bit = ((byte >> (7 - (bitIndex % 8))) & 1) === 1;
            bitIndex++;
          }
          // Aplicação de máscara 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit !== mask;
        }
      }
    }
    upwards = !upwards;
  }

  // 7. Informação de formato (Nível L, Máscara 0 -> 0b01000 = 0x08 -> com BCH XOR 0x5412 = 0x77c4)
  const formatBits = 0x77c4; // Valor pré-calculado com BCH e máscara 0x5412
  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    // Posições ao redor do finder superior esquerdo
    if (i < 6) setModule(8, i, bit);
    else if (i === 6) setModule(8, 7, bit);
    else if (i === 7) setModule(8, 8, bit);
    else if (i === 8) setModule(7, 8, bit);
    else setModule(14 - i, 8, bit);

    // Posições divididas nos outros dois finders
    if (i < 8) setModule(size - 1 - i, 8, bit);
    else setModule(8, size - 15 + i, bit);
  }

  return matrix;
}
