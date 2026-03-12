const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Replace "/api/ with process.env.NEXT_PUBLIC_API_URL + "/
    if (content.includes('"/api/')) {
        content = content.replace(/"\/api\//g, 'process.env.NEXT_PUBLIC_API_URL + "/');
        changed = true;
    }

    // Replace '/api/ with process.env.NEXT_PUBLIC_API_URL + '/
    if (content.includes("'/api/")) {
        content = content.replace(/'\/api\//g, "process.env.NEXT_PUBLIC_API_URL + '/");
        changed = true;
    }

    // Handle backticks `/api/ -> `${process.env.NEXT_PUBLIC_API_URL}/
    if (content.includes('`/api/')) {
        content = content.replace(/`\/api\//g, '`${process.env.NEXT_PUBLIC_API_URL}/');
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated: ${file}`);
    }
});
