export interface PlatformAdminRecord {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isActive: boolean;
}

/** Lo que se le muestra al panel: nunca el passwordHash. */
export interface PlatformAdminSummary {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  createdAt: Date;
}

export interface IPlatformAdminRepository {
  findByEmail(email: string): Promise<PlatformAdminRecord | null>;
  findByIdOrThrow(id: string): Promise<PlatformAdminRecord>;
  list(): Promise<PlatformAdminSummary[]>;
  create(input: { email: string; passwordHash: string; fullName: string }): Promise<PlatformAdminSummary>;
  setActive(id: string, isActive: boolean): Promise<PlatformAdminSummary>;
}
