import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOutput } from '../validate-output.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(root, 'dist');

export function onPreBuild({ constants, netlifyConfig }) {
  if (netlifyConfig.build.command?.trim() !== 'npm run build') {
    throw new Error('Netlify must run npm run build; publishing unbuilt source is not supported.');
  }
  if (!constants.PUBLISH_DIR || path.resolve(constants.PUBLISH_DIR) !== output) {
    throw new Error('Netlify publish directory must be the repository dist directory, not source.');
  }
}

export async function onPostBuild(options) {
  // Check Netlify's effective directory, not just the output our build generated.
  onPreBuild(options);
  await validateOutput(options.constants.PUBLISH_DIR);
}
