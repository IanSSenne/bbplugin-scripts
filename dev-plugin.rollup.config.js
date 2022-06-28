import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json'));
const external = Object.keys(pkg.dependencies || {}).concat(['fs/promises']);

const extensions = ['.js', '.ts'];

export default {
  input: './src/dev-plugin.ts',
  output: {
    file: './bin/internal/dev-plugin.js',
    format: 'esm',
  },
  external,
  plugins: [
    nodeResolve({
      extensions,
      modulesOnly: true,
    }),
    json(),
    babel({
      exclude: ['node_modules/**', './history/**'],
      // babelHelpers: 'bundled',
      extensions,
    }),
  ],
};
