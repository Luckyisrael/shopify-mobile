import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), 'app/routes/api.mobile');
const mapping = {
  'api.mobile.products.tsx': 'products.tsx',
  'api.mobile.collections.tsx': 'collections.tsx',
  'api.mobile.cart.tsx': 'cart.tsx',
  'api.mobile.config.tsx': 'config.tsx',
};

console.log(`Renaming files in ${dir}...`);

for (const [oldName, newName] of Object.entries(mapping)) {
    const oldPath = path.join(dir, oldName);
    const newPath = path.join(dir, newName);
    
    if (fs.existsSync(oldPath)) {
        try {
            fs.renameSync(oldPath, newPath);
            console.log(`✅ Renamed ${oldName} -> ${newName}`);
        } catch (e) {
            console.error(`❌ Failed to rename ${oldName}:`, e.message);
        }
    } else {
        if (fs.existsSync(newPath)) {
            console.log(`ℹ️  ${newName} already exists (skipping)`);
        } else {
            console.log(`⚠️  Source file ${oldName} not found`);
        }
    }
}
