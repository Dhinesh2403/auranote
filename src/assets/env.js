const fs = require('fs');
const path = require('path');

const dir = './src/environments';
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

// This template defines exactly what your environment file will look like
const envConfigFile = `export const environment = {
  production: true,
  AURA_API_KEY: '${process.env.AURA_API_KEY || ''}',
  AURA_ENDPOINT: '${process.env.AURA_ENDPOINT || ''}'
};
`;

fs.writeFileSync(path.join(dir, 'environment.ts'), envConfigFile);
console.log('environment.ts generated successfully.', envConfigFile);
