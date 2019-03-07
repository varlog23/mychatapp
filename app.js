const express = require("express");

const app = express();

const PORT = process.env.PORT || 4000;

const expressServer = app.listen(PORT, console.log(`Server started on port ${PORT}`));