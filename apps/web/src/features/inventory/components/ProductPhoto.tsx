import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageIcon } from "lucide-react";
import { ApiError } from "../../../lib/api-client";
import { productPhotoUrl, removeProductPhoto, setProductPhoto } from "../api/product.api";

const PHOTO_MAX_SIDE = 400;
const PHOTO_MAX_DATA_URL_LENGTH = 400_000;

/** Achica la foto a 400 px en el navegador (JPG, fondo blanco): ~30-40 KB, lo que se guarda en la base. */
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

/** En la lista de productos: ver la foto y, con permiso, ponerla, cambiarla o quitarla. */
export function ProductPhotoCell({ productId, name, photoPath, canEdit }: { productId: string; name: string; photoPath: string | null; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = () => queryClient.invalidateQueries({ queryKey: ["products"] });
  const upload = useMutation({
    mutationFn: async (file: File) => setProductPhoto(productId, await shrinkProductPhoto(file)),
    onSuccess: () => {
      setError(null);
      done();
    },
    onError: (err) => setError(err instanceof ApiError || err instanceof Error ? err.message : "No se pudo subir la foto"),
  });
  const remove = useMutation({ mutationFn: () => removeProductPhoto(productId), onSuccess: done });

  if (!canEdit) return <ProductThumb photoPath={photoPath} name={name} />;
  return (
    <div className="flex items-center gap-2">
      <button type="button" title={photoPath ? "Cambiar la foto" : "Poner foto"} onClick={() => input.current?.click()} disabled={upload.isPending}>
        <ProductThumb photoPath={photoPath} name={name} />
      </button>
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
      {upload.isPending && <span className="text-xs text-slate-500">Subiendo…</span>}
      {photoPath && !upload.isPending && (
        <button type="button" className="text-xs text-slate-400 hover:text-danger-600" onClick={() => remove.mutate()} disabled={remove.isPending}>
          Quitar
        </button>
      )}
      {error && <span className="text-xs text-danger-600">{error}</span>}
    </div>
  );
}
