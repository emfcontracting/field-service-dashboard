// app/components/NTEPhotoUpload.js
// ─────────────────────────────────────────────────────────────────────────────
// Photo attachment for NTE Increase Requests.
// Required when the tech is ON SITE (is_on_site = true) — the photo proves
// site presence on the PDF that goes to CBRE. Location proof itself is
// handled outside the app (dedicated timestamp/GPS camera app), so this
// component performs NO EXIF/geo processing: it just takes the file the
// tech's photo app produced, downscales it for sane PDF embedding, and
// uploads it to the public 'nte-photos' Supabase Storage bucket.
//
// Props:
//   supabase   (required) — Supabase client from the caller
//   woNumber   (required) — used to namespace the storage path
//   photoUrl              — current public URL (controlled)
//   onChange(url, uploadedAtIso) — fires after upload / on remove (null, null)
//   required              — renders the "required" hint styling
//   language              — 'en' | 'es'
// ─────────────────────────────────────────────────────────────────────────────
'use client';

import { useRef, useState } from 'react';

const MAX_EDGE = 1600;      // px — plenty for print, keeps uploads small
const JPEG_QUALITY = 0.85;

async function downscaleImage(file) {
  // Best effort: if the browser can't decode (e.g. exotic HEIC), upload as-is.
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close?.();
      return { blob: file, contentType: file.type || 'image/jpeg', ext: 'jpg' };
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob) return { blob: file, contentType: file.type || 'image/jpeg', ext: 'jpg' };
    return { blob, contentType: 'image/jpeg', ext: 'jpg' };
  } catch {
    return { blob: file, contentType: file.type || 'image/jpeg', ext: 'jpg' };
  }
}

export default function NTEPhotoUpload({
  supabase,
  woNumber,
  photoUrl,
  onChange,
  required = false,
  language = 'en'
}) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const t = (en, es) => (language === 'es' ? es : en);

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    // allow re-selecting the same file later
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const { blob, contentType, ext } = await downscaleImage(file);
      const safeWo = (woNumber || 'unknown').replace(/[^A-Za-z0-9_-]/g, '');
      const path = `${safeWo}/${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('nte-photos')
        .upload(path, blob, { contentType, upsert: false });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('nte-photos').getPublicUrl(path);
      const publicUrl = data?.publicUrl;
      if (!publicUrl) throw new Error('Could not resolve public URL');

      onChange && onChange(publicUrl, new Date().toISOString());
    } catch (err) {
      console.error('NTE photo upload failed:', err);
      setError(
        t(
          'Upload failed: ' + (err.message || 'unknown error'),
          'Error al subir: ' + (err.message || 'error desconocido')
        )
      );
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setError(null);
    onChange && onChange(null, null);
  }

  return (
    <div>
      {photoUrl ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={t('NTE site photo', 'Foto del sitio NTE')}
            className="max-h-56 w-full rounded-lg border border-gray-600 object-contain bg-black/30"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-green-400">
              ✓ {t('Photo attached', 'Foto adjunta')}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="text-xs text-red-400 underline"
            >
              {t('Remove photo', 'Quitar foto')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current && inputRef.current.click()}
          className={`w-full rounded-lg border-2 border-dashed p-4 text-center text-sm font-semibold transition ${
            required
              ? 'border-red-500 bg-red-900/30 text-red-200'
              : 'border-gray-500 bg-gray-700/40 text-gray-300'
          } ${uploading ? 'opacity-60' : ''}`}
        >
          {uploading
            ? t('Uploading photo…', 'Subiendo foto…')
            : (
              <>
                📷 {t('Attach site photo', 'Adjuntar foto del sitio')}
                {required && (
                  <span className="block text-xs font-normal">
                    {t(
                      'Required — you selected ON SITE. Use the photo app so date/time and location are stamped on the image.',
                      'Requerido — seleccionó EN SITIO. Use la app de fotos para que fecha/hora y ubicación queden en la imagen.'
                    )}
                  </span>
                )}
              </>
            )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
