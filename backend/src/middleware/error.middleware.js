module.exports = (err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: "Email already registered"
    });
  }

  res.status(500).json({
    success: false,
    message: err.message || "Server Error"
  });
};
