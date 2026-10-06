const fs = require('fs');
let content = fs.readFileSync('src/modulAjarModule.js', 'utf8');

content = content.replace(
    /<div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900\/60 backdrop-blur-sm p-4 sm:p-6" onclick="if\(event.target === this\) closeModal\(\);">/g,
    `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onclick="if(event.target === this) closeModal();">`
);

content = content.replace(
    /<div class="bg-white w-full max-w-2xl mx-auto rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 my-4 sm:my-8 flex flex-col text-left relative">/g,
    `<div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col text-left relative max-h-[90vh] overflow-hidden">`
);

// We need to move the header out of the <form> if it's there. Oh wait, it is inside <form id="import-modul-modal-form" class="space-y-4">
// Let's rewrite the entire modal HTML from line 1637 to 1792 to be absolutely perfect.
