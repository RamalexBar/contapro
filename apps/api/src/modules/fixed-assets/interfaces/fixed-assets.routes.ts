import { Router } from "express";
import { tenantContextMiddleware } from "../../../shared/middlewares/tenant-context.middleware";
import { requirePermission } from "../../../shared/middlewares/require-permission.middleware";
import { fixedAssetsController } from "../fixed-assets.container";

export const fixedAssetsRouter = Router();
fixedAssetsRouter.use(tenantContextMiddleware);

fixedAssetsRouter.get("/fixed-assets", requirePermission("fixed-asset.read"), fixedAssetsController.listAssets);
fixedAssetsRouter.post("/fixed-assets", requirePermission("fixed-asset.manage"), fixedAssetsController.createAsset);
fixedAssetsRouter.patch("/fixed-assets/:id", requirePermission("fixed-asset.manage"), fixedAssetsController.updateAsset);
fixedAssetsRouter.post(
  "/fixed-assets/:id/deactivate",
  requirePermission("fixed-asset.manage"),
  fixedAssetsController.deactivateAsset
);

fixedAssetsRouter.post("/depreciation/calculate", requirePermission("fixed-asset.manage"), fixedAssetsController.calculate);
fixedAssetsRouter.get("/depreciation/entries", requirePermission("fixed-asset.read"), fixedAssetsController.listEntries);
fixedAssetsRouter.post(
  "/depreciation/entries/:id/post",
  requirePermission("fixed-asset.manage"),
  fixedAssetsController.postEntry
);
