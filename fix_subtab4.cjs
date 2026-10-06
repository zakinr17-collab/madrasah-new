const fs = require('fs');
let content = fs.readFileSync('src/modulAjarModule.js', 'utf8');

content = content.replace(
    /        \`;\n        \}\n    \} else \{/g,
    `        \`;
        } else if (!activeSubTab) {
            contentHtml += '</div>';
        }
    } else {`
);

fs.writeFileSync('src/modulAjarModule.js', content, 'utf8');
