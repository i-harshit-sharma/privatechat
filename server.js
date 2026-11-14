// Local development entry point. On Vercel, api/index.js is the function
// and public/ is served by the CDN, so this file is not used there.
const path = require('path');
const express = require('express');
const app = require('./api/index');

app.use(express.static(path.join(__dirname, 'public')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`PrivateChat running at http://localhost:${port}`));
