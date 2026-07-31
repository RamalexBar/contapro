export interface PlatformAdminRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isActive: boolean;
}

export interface IPlatformAdminRepository {
  findByEmail(email: string): Promise<PlatformAdminRecord | null>;
  findByIdOrThrow(id: string): Promise<PlatformAdminRecord>;
}
