exports.success = (res, data, message = 'Success') =>
  res.json({ success: true, message, data });
