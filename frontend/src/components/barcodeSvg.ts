import JsBarcode from 'jsbarcode'

/** Code 128 barcode for an item code, as SVG markup (used for both the preview and printing). */
export function barcodeSvg(code: string): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, code, { format: 'CODE128', displayValue: false, margin: 0, height: 60, width: 2 })
  svg.setAttribute('preserveAspectRatio', 'none')
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  return svg.outerHTML
}
