const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated. Please log in.',
      });
    }

    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const userRole = req.user.role.toLowerCase();

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.',
      });
    }

    next();
  };
};

module.exports = { requireRole };
