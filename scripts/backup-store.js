const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = process.env.STORE_PATH || path.join(root, 'data', 'store.json');
const backupDir = process.env.BACKUP_DIR || path.join(root, 'backups');

function timestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

async function main() {
  await fs.mkdir(backupDir, { recursive: true });
  const target = path.join(backupDir, `store-${timestamp()}.json`);
  await fs.copyFile(source, target);
  console.log(`Backup written to ${target}`);
}

main().catch((error) => {
  console.error(`Backup failed: ${error.message}`);
  process.exitCode = 1;
});
