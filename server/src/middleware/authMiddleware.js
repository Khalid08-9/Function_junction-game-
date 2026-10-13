// Runs before a route. Stops the request if the user is not logged in.
function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ message: "You must be logged in." });
    }

    next();
}

// Use AFTER requireLogin. Example: requireRole("lecturer")
function requireRole(role) {
    return (req, res, next) => {
        if (req.session.user.role !== role) {
            return res.status(403).json({
                message: "You do not have permission to do this."
            });
        }

        next();
    };
}

module.exports = { requireLogin, requireRole };