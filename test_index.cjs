const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');

// Also make sure modal-container itself isn't completely hidden or something.
// And that we have "w-screen h-screen" on the backdrop just to be absolutely sure.
let modulAjar = fs.readFileSync('src/modulAjarModule.js', 'utf8');
modulAjar = modulAjar.replace(
    /<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900\/60 backdrop-blur-sm p-4 overflow-hidden"/g,
    '<div class="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden"'
);
fs.writeFileSync('src/modulAjarModule.js', modulAjar, 'utf8');

