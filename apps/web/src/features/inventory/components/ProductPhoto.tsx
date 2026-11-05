import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, ImagePlus, Star, Trash2, X } from "lucide-react";
import { ApiError } from "../../../lib/api-client";
import { addProductPhoto, deleteProductPhoto, listProductPhotos, productPhotoUrl, setMainProductPhoto } from "../api/product.api";

const MAX_PHOTOS = 5;

const PHOTO_MAX_SIDE = 400;
const PHOTO_MAX_DATA_URL_LENGTH = 400_000;

/** Achica la foto a 400 px en el navegador (JPG, fondo blanco): ~30-40 KB, lo que se guarda (R2 o la base). */
export async function shrinkProductPhoto(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("El archivo no es una imagen valida"));
    img.src = original;
  });
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  let dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) dataUrl = canvas.toDataURL("image/jpeg", 0.6);
  if (dataUrl.length > PHOTO_MAX_DATA_URL_LENGTH) throw new Error("La foto es muy pesada; use una mas sencilla");
  return dataUrl;
}

/** Miniatura de la foto del producto (o un recuadro vacio). */
export function ProductThumb({ photoPath, name, size = 40 }: { photoPath: string | null; name: string; size?: number }) {
  return photoPath ? (
    <img src={productPhotoUrl(photoPath)} alt={name} loading="lazy" className="shrink-0 rounded-md border border-slate-200 bg-white object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 text-slate-300" style={{ width: size, height: size }}>
      <ImageIcon size={Math.round(size / 2.5)} />
    </span>
  );
}

/** En la lista de productos: la foto principal; al tocarla se abren todas (hasta 5) para verlas y, con permiso, cambiarlas. */
export function ProductPhotoCell({ productId, name, photoPath, canEdit }: { productId: string; name: string; photoPath: string | null; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  if (!canEdit && !photoPath) return <ProductThumb photoPath={null} name={name} />;
  return (
    <>
      <button type="button" title={canEdit ? "Fotos del producto" : "Ver fotos"} onClick={() => setOpen(true)}>
        <ProductThumb photoPath={photoPath} name={name} />
      </button>
      {open && <ProductPhotosDialog productId={productId} name={name} canEdit={canEdit} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * En el formulario de "Nuevo producto": el producto todavia no existe, asi que las fotos se escogen y se achican
 * aqui (data URLs) y quien crea el producto las sube despues con addProductPhoto. La primera queda de principal.
 */
export function NewProductPhotosPicker({ value, onChange }: { value: string[]; onChange: (photos: string[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(files: File[]) {
    setBusy(true);
    setError(null);
    const added: string[] = [];
    try {
      for (const file of files.slice(0, MAX_PHOTOS - value.length)) added.push(await shrinkProductPhoto(file));
      if (files.length > MAX_PHOTOS - value.length) setError(`Maximo ${MAX_PHOTOS} fotos por producto`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo leer la foto");
    } finally {
      setBusy(false);
      if (added.length) onChange([...value, ...added]);
    }
  }

  return (
    <div className="col-span-2 sm:col-span-4">
      <div className="flex flex-wrap items-center gap-2">
        {value.map((photo, i) => (
          <div key={i} className={`relative h-16 w-16 overflow-hidden rounded-md border ${i === 0 ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"}`}>
            <img src={photo} alt={`Foto ${i + 1}`} className="h-full w-full bg-white object-cover" />
            {i === 0 && <Star size={12} className="absolute left-1 top-1 fill-brand-500 text-brand-500" aria-label="Principal" />}
            <button
              type="button"
              className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-500 hover:text-danger-600"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
              title="Quitar foto"
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {value.length < MAX_PHOTOS && (
          <button
            type="button"
            className="flex h-16 items-center gap-2 rounded-md border-2 border-dashed border-slate-300 px-3 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <ImagePlus size={20} />
            {busy ? "Preparando…" : value.length ? "Agregar otra foto" : `Agregar fotos (hasta ${MAX_PHOTOS})`}
          </button>
        )}
      </div>
      {value.length > 1 && <p className="mt-1 text-xs text-slate-500">La primera es la principal (la que sale en el punto de venta).</p>}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void pick(files);
        }}
      />
      {error && <p className="mt-1 text-sm text-danger-600">{error}</p>}
    </div>
  );
}

function ProductPhotosDialog({ productId, name, canEdit, onClose }: { productId: string; name: string; canEdit: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ["product-photos", productId], queryFn: () => listProductPhotos(productId) });
  const photos = data?.data ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["product-photos", productId] });
    // La principal sale en la lista, el POS y la cotizacion
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };
  const onError = (err: unknown) => setError(err instanceof ApiError || err instanceof Error ? err.message : "No se pudo guardar");
  const upload = useMutation({
    mutationFn: async (file: File) => addProductPhoto(productId, await shrinkProductPhoto(file)),
    onSuccess: () => {
      setError(null);
      refresh();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: (photoId: string) => deleteProductPhoto(productId, photoId), onSuccess: refresh, onError });
  const makeMain = useMutation({ mutationFn: (photoId: string) => setMainProductPhoto(productId, photoId), onSuccess: refresh, onError });
  const busy = upload.isPending || remove.isPending || makeMain.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-start justify-between gap-3">
          <h2 className="text-base font-semibold text-slate-900">Fotos de {name}</h2>
          <button type="button" className="text-slate-400 hover:text-slate-700" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          Hasta {MAX_PHOTOS} fotos. La <strong>principal</strong> es la que sale en el punto de venta, la lista y las cotizaciones.
        </p>

        {isLoading ? (
          <p className="text-sm text-slate-500">Cargando…</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo) => (
              <div key={photo.id} className={`overflow-hidden rounded-lg border ${photo.isMain ? "border-brand-500 ring-2 ring-brand-200" : "border-slate-200"}`}>
                <img src={productPhotoUrl(photo.path)} alt={name} className="aspect-square w-full bg-white object-contain" />
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-2 py-1.5 text-xs">
                  {photo.isMain ? (
                    <span className="flex items-center gap-1 font-medium text-brand-700">
                      <Star size={12} className="fill-current" /> Principal
                    </span>
                  ) : canEdit ? (
                    <button type="button" className="text-slate-600 hover:text-brand-700" disabled={busy} onClick={() => makeMain.mutate(photo.id)}>
                      Hacer principal
                    </button>
                  ) : (
                    <span />
                  )}
                  {canEdit && (
                    <button type="button" className="text-slate-400 hover:text-danger-600" disabled={busy} onClick={() => remove.mutate(photo.id)} title="Quitar foto">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {canEdit && photos.length < MAX_PHOTOS && (
              <button
                type="button"
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <ImagePlus size={24} />
                {upload.isPending ? "Subiendo…" : "Agregar foto"}
              </button>
            )}
            {!canEdit && photos.length === 0 && <p className="text-sm text-slate-500">Este producto no tiene fotos.</p>}
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) upload.mutate(file);
          }}
        />
        {error && <p className="mt-3 text-sm text-danger-600">{error}</p>}
      </div>
    </div>
  );
}
