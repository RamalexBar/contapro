-- Decision del administrador sobre vacaciones, permisos e incapacidades: nota (motivo del
-- rechazo), fechas aprobadas distintas a las pedidas, y aviso al empleado (decisionSeenAt).
ALTER TABLE "vacations" ADD COLUMN "requestedStartDate" TIMESTAMP(3),
ADD COLUMN "requestedEndDate" TIMESTAMP(3),
ADD COLUMN "decisionNote" TEXT,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decisionSeenAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "leave_permissions" ADD COLUMN "requestedStartDate" TIMESTAMP(3),
ADD COLUMN "requestedEndDate" TIMESTAMP(3),
ADD COLUMN "decisionNote" TEXT,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decisionSeenAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "sick_leaves" ADD COLUMN "requestedStartDate" TIMESTAMP(3),
ADD COLUMN "requestedEndDate" TIMESTAMP(3),
ADD COLUMN "decisionNote" TEXT,
ADD COLUMN "decidedAt" TIMESTAMP(3),
ADD COLUMN "decisionSeenAt" TIMESTAMP(3),
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

