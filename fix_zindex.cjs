const fs = require('fs');

let indexHtml = fs.readFileSync('index.html', 'utf8');
indexHtml = indexHtml.replace(/<div id="modal-container"><\/div>/, '<div id="modal-container" class="relative z-[100]"></div>');
fs.writeFileSync('index.html', indexHtml, 'utf8');

