const fs = require('fs');
let content = fs.readFileSync('src/modulAjarModule.js', 'utf8');

// The `buat` block ends around line 1222.
content = content.replace(
    /                            <\/div>\s*<\/div>\s*`;\s*\}\s*\} else \{/g,
    `                            </div>
                        </div>
            \`;
        } else {
            contentHtml += \`</div>\`;
        }
    } else {`
);

fs.writeFileSync('src/modulAjarModule.js', content, 'utf8');
