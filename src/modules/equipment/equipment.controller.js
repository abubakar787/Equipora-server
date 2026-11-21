
import {
  createEquipmentSchema,
  updateEquipmentSchema,
  equipmentQuerySchema,
  myEquipmentQuerySchema,
  equipmentReviewSchema,
} from "./equipment.validation.js";

import * as equipmentService from "./equipment.service.js";

// ============================================
// 1. CREATE EQUIPMENT
// ============================================

export const createEquipmentController = async (req, res) => {
  const validation = createEquipmentSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const equipment = await equipmentService.createEquipment(
    validation.data,
    req.user
  );

  return res.status(201).json({
    success: true,
    message: "Equipment submitted successfully for approval",
    data: equipment,
  });
};

// ============================================
// 2. GET ALL APPROVED EQUIPMENT
// ============================================

export const getAllEquipmentController = async (req, res) => {
  const validation = equipmentQuerySchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const result = await equipmentService.getAllEquipment(
    validation.data
  );

  return res.status(200).json({
    success: true,
    message: "Equipment retrieved successfully",
    data: result.equipment,
    pagination: result.pagination,
  });
};

// ============================================
// 3. GET EQUIPMENT DETAILS BY ID
// ============================================

export const getEquipmentByIdController = async (req, res) => {
  const equipment = await equipmentService.getEquipmentById(
    req.params.id
  );

  if (!equipment) {
    return res.status(404).json({
      success: false,
      message: "Equipment not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Equipment details retrieved successfully",
    data: equipment,
  });
};

// ============================================
// 4. UPDATE EQUIPMENT
// ============================================

export const updateEquipmentController = async (req, res) => {
  const validation = updateEquipmentSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const equipment = await equipmentService.updateEquipment(
    req.params.id,
    req.user.id,
    validation.data
  );

  if (!equipment) {
    return res.status(404).json({
      success: false,
      message: "Equipment not found or you are not the owner",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Equipment updated and submitted for approval",
    data: equipment,
  });
};

// ============================================
// 5. DELETE EQUIPMENT
// ============================================

export const deleteEquipmentController = async (req, res) => {
  const equipment = await equipmentService.deleteEquipment(
    req.params.id,
    req.user.id
  );

  if (!equipment) {
    return res.status(404).json({
      success: false,
      message: "Equipment not found or you are not the owner",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Equipment deleted successfully",
  });
};

// ============================================
// 6. OWNER: GET MY EQUIPMENT
// ============================================

export const getMyEquipmentController = async (req, res) => {
  const validation = myEquipmentQuerySchema.safeParse(req.query);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid query parameters",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const result = await equipmentService.getMyEquipment(
    req.user.id,
    validation.data
  );

  return res.status(200).json({
    success: true,
    message: "Your equipment retrieved successfully",
    data: result.equipment,
    pagination: result.pagination,
  });
};

// ============================================
// 7. ADMIN: APPROVE OR REJECT EQUIPMENT
// ============================================

export const reviewEquipmentController = async (req, res) => {
  const validation = equipmentReviewSchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid review information",
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const equipment = await equipmentService.reviewEquipment(
    req.params.id,
    req.user.id,
    validation.data
  );

  if (!equipment) {
    return res.status(404).json({
      success: false,
      message: "Pending equipment not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: `Equipment ${validation.data.status} successfully`,
    data: equipment,
  });
};

// ============================================
// 8. ADMIN: GET PENDING EQUIPMENT
// ============================================

export const getPendingEquipmentController = async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 10;

  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid pagination parameters",
    });
  }

  const safeLimit = Math.min(limit, 24);

  const result = await equipmentService.getPendingEquipment(
    page,
    safeLimit
  );

  return res.status(200).json({
    success: true,
    message: "Pending equipment retrieved successfully",
    data: result.equipment,
    pagination: result.pagination,
  });
};
