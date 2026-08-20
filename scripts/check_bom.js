const fs = require('fs');
const files = ['package.json', 'tsconfig.json', '../package.json'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        const content = fs.readFileSync(file);
        if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
            console.log(`${file}: BOM detected!`);
        } else {
            console.log(`${file}: No BOM.`);
        }
    } else {
        console.log(`${file}: Not found.`);
    }
});
