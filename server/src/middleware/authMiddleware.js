function requireLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.status(401).json({
            message: "You must be logged in."
        });
    }

    next();
}

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