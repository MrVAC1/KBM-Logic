export const sendSuccess = (res, data, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
  });
};

export const sendError = (res, message, statusCode = 500, details = {}) => {
  res.status(statusCode).json({
    success: false,
    message,
    ...details,
  });
};


