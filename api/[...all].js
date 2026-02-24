// api/[...all].js
"use strict";

const app = require("../app.js");

module.exports = (req, res) => {
  return app(req, res);
};