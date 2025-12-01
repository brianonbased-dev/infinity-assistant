// Empty module stub for client-side resolution of Node.js modules
// Used by Turbopack to prevent bundling fs, path, os on client
export default {};
export const existsSync = () => false;
export const readFileSync = () => '';
export const writeFileSync = () => {};
export const mkdirSync = () => {};
export const join = (...args) => args.join('/');
export const dirname = (p) => p.split('/').slice(0, -1).join('/');
export const homedir = () => '';
