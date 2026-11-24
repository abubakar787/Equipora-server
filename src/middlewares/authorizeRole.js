
const ALLOWED_ROLES = ["customer", "owner", "admin"];

// Role-based authorization middleware
export const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    try {
      // 1. Authentication check
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // 2. Normalize user role
      const userRole = String(req.user.role || "")
        .trim()
        .toLowerCase();

      // 3. Normalize configured roles
      const normalizedAllowedRoles = allowedRoles.map((role) =>
        String(role).trim().toLowerCase()
      );

      // 4. Validate configured roles
      const invalidRoles = normalizedAllowedRoles.filter(
        (role) => !ALLOWED_ROLES.includes(role)
      );

      if (invalidRoles.length > 0) {
        console.error("Invalid authorization configuration:", {
          invalidRoles,
          allowedRoles,
        });

        return res.status(500).json({
          success: false,
          message: "Server configuration error: Invalid role",
        });
      }

      // 5. Debug authorization
      console.log("AUTHORIZATION CHECK:", {
        userId: req.user.id,
        userRole,
        allowedRoles: normalizedAllowedRoles,
      });

      // 6. Check permission
      if (!normalizedAllowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action",
        });
      }

      // 7. Permission granted
      return next();
    } catch (error) {
      return next(error);
    }
  };
};
