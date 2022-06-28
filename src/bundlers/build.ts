import esbuild from 'esbuild';
import { taskRunner } from '../taskRunner';
import { resolve, dirname } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
// @ts-ignore
import firstOpenPort from 'first-open-port';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { getPluginMeta } from '../getPluginMeta';
import { packetTypes } from '../packetTypes';
// declare const firstOpenPort: (min: number, max?: number) => Promise<number>;
export async function prodBundler() {
  // let _port!: number;
  // let _devPluginCode: string;
  // let _devPluginClientFilePath = resolve(process.cwd(), '.plugin-scripts', 'backend', 'plugin.js');
  let _devPluginOutputFilePath = resolve(process.cwd(), 'plugins', getPluginMeta().id);
  // let pluginBundle: string;
  const meta = getPluginMeta();
  // let update = () => {};
  function bundlePlugin() {
    console.log('Buildig Plugin...');
    return esbuild.build({
      entryPoints: [resolve(process.cwd(), 'src', getPluginMeta().id + '.ts')],
      // write: false,
      bundle: true,
      outfile: resolve(process.cwd(), 'plugins', meta.id + '.js'),
      format: 'iife',
      watch: false,
      minify: true,
      // sourcemap: 'inline',
      // plugins: [
      //   {
      //     name: 'build watcher',
      //     setup(build) {
      //       build.onStart(() => {
      //         console.log('starting build...');
      //       });
      //       build.onEnd((res) => {
      //         console.log('done build');
      //         const file = res.outputFiles?.find((file) => {
      //           return file.path.endsWith(meta.id + '.js');
      //         });
      //         if (!file) {
      //           throw new Error('Failed to find plugin build');
      //         }
      //         pluginBundle = Buffer.from(file?.contents).toString('utf-8');
      //         update();
      //       });
      //     },
      //   },
      // ],
    });
  }
  // mkdirSync(dirname(_devPluginClientFilePath), { recursive: true });
  mkdirSync(dirname(_devPluginOutputFilePath), { recursive: true });
  bundlePlugin();
}
