const fs = require('fs');
const files = ['package.json', 'tsconfig.json', '../package.json', '../tsconfig.json', 'prisma/schema.prisma'];

files.forEach(file => {
    if (fs.existsSync(file)) {
        let content = fs.readFileSync(file);
        if (content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
            console.log(`Stripping BOM from ${file}`);
            content = content.slice(3);
            fs.writeFileSync(file, content);
        } else {
            console.log(`No BOM in ${file}`);
        }
    } else {
        console.log(`${file} not found`);
    }
});
