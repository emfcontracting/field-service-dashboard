// app/demo/fonts.js — the demo pages' one typeface (Archivo, with its width
// axis so headings can run expanded). Exposed as the --lp-font variable.
import { Archivo } from 'next/font/google';
// Colour tokens (light + dark) for every demo page ride along with the font,
// since each demo page imports this file.
import './demo-tokens.css';

export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--lp-font',
});
