const fs = require('fs');
let content = fs.readFileSync('src/modulAjarModule.js', 'utf8');

content = content.replace(
    /const activeSubTab = appState\.activeModulAjarSubTab \|\| 'buat';/g,
    `const activeSubTab = appState.activeModulAjarSubTab;`
);

content = content.replace(
    /if \(activeSubTab === 'simpan'\) \{\s*contentHtml \+= renderModulAjarSimpanView\(selectedSubjectId\) \+ \`<\/div>\`;\s*\} else \{/g,
    `if (activeSubTab === 'simpan') {
            contentHtml += renderModulAjarSimpanView(selectedSubjectId) + \`</div>\`;
        } else if (activeSubTab === 'buat') {`
);

fs.writeFileSync('src/modulAjarModule.js', content, 'utf8');
