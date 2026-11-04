// app/demo/fonts.js — the demo pages' one typeface (Archivo, with its width
// axis so headings can run expanded). Exposed as the --lp-font variable.
import { Archivo } from 'next/font/google';

export const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],
  display: 'swap',
  variable: '--lp-font',
});
