const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// The login-container currently has overflow-hidden, which might restrict page body scrolling.
indexHtml = indexHtml.replace(/<body class="([^"]*)">/, '<body class="$1">'); // No changes to body

fs.writeFileSync('index.html', indexHtml, 'utf8');

// Specifically fixing the main import modal's container again.
// The issue is likely that the "flex-1 overflow-y-auto" is still scrolling the background
// because `document.body.style.overflow = 'hidden'` might not be applying correctly when called.
// Let's add an explicit inline style to the modal wrapper to block background scrolling:
// `fixed inset-0 ... overflow-hidden`
let modulAjar = fs.readFileSync('src/modulAjarModule.js', 'utf8');
modulAjar = modulAjar.replace(
    /<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900\/60 backdrop-blur-sm p-4"/g,
    '<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden"'
);
fs.writeFileSync('src/modulAjarModule.js', modulAjar, 'utf8');
