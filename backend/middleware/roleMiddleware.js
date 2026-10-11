// middleware/roleMiddleware.js
// ─────────────────────────────────────────────────────────────────────────────
// Role-based access control (RBAC) middleware — `requireRole`
//
// This is a FACTORY FUNCTION: you call it with an array of allowed roles and
// it returns an Express middleware function. This pattern lets you reuse one
// piece of code for every role combination across the application.
//
// IMPORTANT: This middleware must be placed AFTER `protect` in the route chain
// because it reads `req.user` which is set by `protect`.
//
// Usage example:
//   const { requireRole } = require('../middleware/roleMiddleware');
//   router.delete('/users/:id', protect, requireRole(['Admin']), deleteUser);
//   router.post('/relief', protect, requireRole(['Admin','NGO']), createRelief);
// ─────────────────────────────────────────────────────────────────────────────

/**
 * requireRole
 * @param {string[]} allowedRoles - Array of role strings permitted to access the route.
 * @returns {Function} Express middleware (req, res, next)
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    // `protect` should have already run and attached req.user
    // This guard handles the unlikely case where requireRole is used without protect
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in.',
      });
    }

    // Normalize both sides to lowercase for a case-insensitive comparison.
    // e.g. allowedRoles = ['Admin','NGO'] → ['admin','ngo']
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const userRole = req.user.role.toLowerCase();

    // Check whether the user's role is in the allowed list
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    // Role is allowed — pass control to the next middleware or controller
    next();
  };
};

module.exports = { requireRole };
