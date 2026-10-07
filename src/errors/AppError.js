class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'AppError';
    this.status = status;
  }
}

const badRequest = (message) => new AppError(400, message);
const notFound = (message) => new AppError(404, message);
const conflict = (message) => new AppError(409, message);

module.exports = { AppError, badRequest, notFound, conflict };
