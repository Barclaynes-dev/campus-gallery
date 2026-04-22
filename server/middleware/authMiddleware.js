// ============================================================
//  server/middleware/authMiddleware.js
//  Protects routes so only logged-in users can access them
// ============================================================

// Use on any route that requires a logged-in user (any role)
function requireLogin(req, res, next) {
  if (req.session && req.session.user) {
    return next(); // User is logged in, continue
  }
  res.status(401).json({ error: "Unauthorized. Please log in." });
}

// Use on routes that only the admin (designer) can access
function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next();
  }
  res.status(403).json({ error: "Forbidden. Admin access only." });
}

// Use on routes that any authenticated friend (or admin) can access
function requireFriend(req, res, next) {
  if (
    req.session &&
    req.session.user &&
    (req.session.user.role === "friend" || req.session.user.role === "admin")
  ) {
    return next();
  }
  res.status(403).json({ error: "Forbidden. Friend access required." });
}

module.exports = { requireLogin, requireAdmin, requireFriend };
