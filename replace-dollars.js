const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const dirPath = path.resolve(dir);
    let count = 0;

    if (!fs.existsSync(dirPath)) {
        console.log(`Directory doesn't exist: ${dirPath}`);
        return 0;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.next') {
                count += processDir(fullPath);
            }
        } else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;

            content = content.replace(/DollarSign/g, 'PhilippinePeso');
            content = content.replace(/\$0/g, '₱0');

            if (content !== original) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated: ${fullPath}`);
                count++;
            }
        }
    }
    return count;
}

const numUpdated = processDir('web/src');
const numUpdatedApp = processDir('web/app');
console.log(`Total files updated: ${numUpdated + numUpdatedApp}`);
