import "@testing-library/jest-dom/vitest";

// jsdom não implementa `matchMedia`. Componentes que consultam breakpoints
// (por exemplo o drawer inline do Efetivo K9) precisam deste stub.
// Por padrão nenhuma media query casa, o que equivale ao viewport estreito —
// o mesmo fallback seguro usado na renderização de servidor.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    addEventListener: () => undefined,
    addListener: () => undefined,
    dispatchEvent: () => false,
    matches: false,
    media: query,
    onchange: null,
    removeEventListener: () => undefined,
    removeListener: () => undefined,
  })) as typeof window.matchMedia;
}
