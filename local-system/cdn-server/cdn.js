const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());

// MIDDLEWARE: Simulate "Signed URL" Security
// Only allow downloads if ?token=secure-signature is present
const secureGuard = (req, res, next) => {
    const token = req.query.token;
    if (token !== 'secure-signature') {
        console.log(`🛑 Blocked access to ${req.path} (Missing/Invalid Token)`);
        return res.status(403).send('Forbidden: Invalid Signature');
    }
    console.log(`✅ Serving ${req.path}`);
    next();
};

// Serve static files from 'storage' folder, PROTECTED by guard
app.use('/files', secureGuard, express.static(path.join(__dirname, 'storage')));

app.listen(4000, () => {
    console.log('☁️  Fake CloudFront running on http://localhost:4000');
    console.log('📂 Serving files from ./storage');
});
