const fs = require('fs');
const path = require('path');

function processDir(dir) {
    const dirPath = path.resolve(dir);

    if (!fs.existsSync(dirPath)) return;

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && entry.name !== '.next') {
                processDir(fullPath);
            }
        } else if (entry.isFile() && (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');

            lines.forEach((line, index) => {
                if (line.includes('$')) {
                    let testLine = line.replace(/\$\{.*?\}/g, '');
                    if (testLine.includes('$') &&
                        !testLine.includes('$in') &&
                        !testLine.includes('$set') &&
                        !testLine.includes('$push') &&
                        !testLine.includes('$pull') &&
                        !testLine.includes('$inc') &&
                        !testLine.match(/\$[a-zA-Z]/) &&
                        !testLine.includes('typeof')) {
                        console.log(`[${fullPath}:${index + 1}] ${line.trim()}`);
                    }
                }
            });
        }
    }
}

processDir('web/src');
processDir('web/app');
