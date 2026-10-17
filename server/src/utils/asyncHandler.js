// Express 4 does not catch errors from async functions by itself.
// This wrapper sends them to the error handler in server.js.
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

module.exports = { asyncHandler };
