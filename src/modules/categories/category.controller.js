
import {
  createCategorySchema,
  updateCategorySchema,
} from "./category.validation.js";

import * as categoryService from "./category.service.js";

export const createCategoryController = async (req, res) => {
  const validation = createCategorySchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const category = await categoryService.createCategory(
    validation.data,
    req.user.id
  );

  return res.status(201).json({
    success: true,
    message: "Category created successfully",
    data: category,
  });
};

export const getActiveCategoriesController = async (req, res) => {
  const categories = await categoryService.getActiveCategories();

  return res.status(200).json({
    success: true,
    data: categories,
  });
};

export const updateCategoryController = async (req, res) => {
  const validation = updateCategorySchema.safeParse(req.body);

  if (!validation.success) {
    return res.status(400).json({
      success: false,
      errors: validation.error.flatten().fieldErrors,
    });
  }

  const category = await categoryService.updateCategory(
    req.params.id,
    validation.data
  );

  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Category updated successfully",
    data: category,
  });
};

export const deactivateCategoryController = async (req, res) => {
  const category = await categoryService.deactivateCategory(req.params.id);

  if (!category) {
    return res.status(404).json({
      success: false,
      message: "Category not found",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Category deactivated successfully",
  });
};
