const fs = require('fs');
let content = fs.readFileSync('src/modulAjarModule.js', 'utf8');

// Replace flex-1 overflow-y-auto with flex-1 min-h-0 overflow-y-auto
content = content.replace(/class="([^"]*)flex-1 overflow-y-auto([^"]*)"/g, 'class="$1flex-1 min-h-0 overflow-y-auto$2"');

// Fix the main import modul modal's container to have overflow-hidden and tighter max height
// Currently: class="bg-white w-full max-w-2xl mx-auto rounded-3xl shadow-2xl flex flex-col text-left relative max-h-[95vh] sm:max-h-[90vh]"
content = content.replace(
    /class="bg-white w-full max-w-2xl mx-auto rounded-3xl shadow-2xl flex flex-col text-left relative max-h-\[95vh\] sm:max-h-\[90vh\]"/g,
    'class="bg-white w-full max-w-2xl mx-auto rounded-3xl shadow-2xl flex flex-col text-left relative max-h-[85vh] sm:max-h-[90vh] overflow-hidden"'
);

// Do the same for ANY max-h-[95vh] sm:max-h-[90vh]
content = content.replace(
    /max-h-\[95vh\] sm:max-h-\[90vh\]/g,
    'max-h-[85vh] sm:max-h-[90vh] overflow-hidden'
);

// We also need to fix other modals just in case.
content = content.replace(
    /max-h-\[90vh\]/g,
    'max-h-[90vh] overflow-hidden'
);
content = content.replace(/overflow-hidden overflow-hidden/g, 'overflow-hidden');

fs.writeFileSync('src/modulAjarModule.js', content, 'utf8');
