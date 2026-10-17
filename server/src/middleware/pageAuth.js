// Guards for Pug PAGES. They redirect, while the API guards answer with JSON.

function homeFor(user) {
    return user.role === "lecturer" ? "/lecturer" : "/play";
}

function requirePageLogin(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }

    next();
}

function requirePageRole(role) {
    return (req, res, next) => {
        if (req.session.user.role !== role) {
            return res.redirect("/");
        }

        next();
    };
}

// For /login and /register: a logged-in user goes to their own home page
function redirectIfLoggedIn(req, res, next) {
    if (req.session && req.session.user) {
        return res.redirect(homeFor(req.session.user));
    }

    next();
}

module.exports = { homeFor, requirePageLogin, requirePageRole, redirectIfLoggedIn };
