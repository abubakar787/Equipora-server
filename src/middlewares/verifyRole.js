
const ALLOWED_ROLES = ["customer", "owner", "admin"];

// Role-based authorization middleware
export const verifyRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // Check authentication first
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized: Please login first",
        });
      }

      // Validate configured roles
      const invalidRoles = allowedRoles.filter(
        (role) => !ALLOWED_ROLES.includes(role)
      );

      if (invalidRoles.length > 0) {
        return res.status(500).json({
          success: false,
          message: "Server configuration error: Invalid role",
        });
      }

      // Check user's permission
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You do not have permission",
        });
      }

      // Permission granted
      next();
    } catch (error) {
      next(error);
    }
  };
};
