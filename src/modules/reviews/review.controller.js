
import {
  createReview,
  updateReview,
  getEquipmentReviews,
} from "./review.service.js";

import {
  createReviewSchema,
  updateReviewSchema,
  reviewQuerySchema,
} from "./review.validation.js";

// Create a review for a completed rental
export const createReviewController = async (req, res) => {
  try {
    const validation = createReviewSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid review information",
        errors: validation.error.flatten(),
      });
    }

    const review = await createReview(
      validation.data,
      req.user
    );

    return res.status(201).json({
      success: true,
      message: "Review submitted successfully. Awaiting admin approval.",
      data: review,
    });
  } catch (error) {
    console.error("Create review error:", error);

    const statusCode =
      error.message === "You have already reviewed this booking" ? 409 :
      error.message === "You can review only your completed and paid rentals" ? 403 :
      400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to submit review",
    });
  }
};

// Update the customer's own review
export const updateReviewController = async (req, res) => {
  try {
    const validation = updateReviewSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid review information",
        errors: validation.error.flatten(),
      });
    }

    const review = await updateReview(
      req.params.id,
      validation.data,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Review updated successfully. Awaiting admin approval.",
      data: review,
    });
  } catch (error) {
    console.error("Update review error:", error);

    const statusCode =
      error.message === "Review not found" ? 404 : 400;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update review",
    });
  }
};

// Get approved reviews for public equipment details
export const getEquipmentReviewsController = async (req, res) => {
  try {
    const validation = reviewQuerySchema.safeParse(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid review pagination parameters",
        errors: validation.error.flatten(),
      });
    }

    const result = await getEquipmentReviews(
      req.params.equipmentId,
      validation.data
    );

    return res.status(200).json({
      success: true,
      message: "Equipment reviews retrieved successfully",
      data: result,
    });
  } catch (error) {
    console.error("Get equipment reviews error:", error);

    const statusCode =
      error.message === "Invalid equipment ID" ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve equipment reviews",
    });
  }
};
