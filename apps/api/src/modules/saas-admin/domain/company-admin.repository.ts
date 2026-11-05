/** Archivar y borrar empresas desde el panel de plataforma. */
export interface CompanyAdminRecord {
  id: string;
  name: string;
  isActive: boolean;
  /** Viene del combo de Cajapro: si Cajapro la renueva, se vuelve a crear */
  partner: string | null;
}

export class CompanyDeleteError extends Error {}

export interface ICompanyAdminRepository {
  findById(id: string): Promise<CompanyAdminRecord | null>;
  setActive(id: string, isActive: boolean): Promise<void>;
  /** Borra la empresa y todo lo que cuelga de ella (lanza CompanyDeleteError si algo es de otra empresa). */
  deleteCompletely(id: string): Promise<{ deleted: number }>;
  /** Llaves de los archivos de la empresa guardados fuera de la base (fotos en Cloudflare R2). */
  listStoredFileKeys(id: string): Promise<string[]>;
}
