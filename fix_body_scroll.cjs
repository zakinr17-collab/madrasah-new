const fs = require('fs');

// Patch closeModal
let modulesScript = fs.readFileSync('src/modulesScript.js', 'utf8');
modulesScript = modulesScript.replace(
    /function closeModal\(\) \{/g,
    `function closeModal() {\n    document.body.style.overflow = '';`
);
fs.writeFileSync('src/modulesScript.js', modulesScript, 'utf8');

// Patch everywhere modal-container is filled
let modulAjar = fs.readFileSync('src/modulAjarModule.js', 'utf8');
modulAjar = modulAjar.replace(
    /modal\.innerHTML = `/g,
    `document.body.style.overflow = 'hidden';\n    modal.innerHTML = \``
);
fs.writeFileSync('src/modulAjarModule.js', modulAjar, 'utf8');

modulesScript = fs.readFileSync('src/modulesScript.js', 'utf8');
modulesScript = modulesScript.replace(
    /modal\.innerHTML = `/g,
    `document.body.style.overflow = 'hidden';\n    modal.innerHTML = \``
);
// Make sure it doesn't duplicate if I already ran it.
fs.writeFileSync('src/modulesScript.js', modulesScript, 'utf8');
