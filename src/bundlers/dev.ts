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
export async function devBundler() {
  let _port!: number;
  let _devPluginCode: string;
  let _devPluginClientFilePath = resolve(process.cwd(), '.plugin-scripts', 'backend', 'plugin.js');
  let _devPluginOutputFilePath = resolve(process.cwd(), 'plugins', getPluginMeta().id + '_dev.js');
  let pluginBundle: string;
  const meta = getPluginMeta();
  let update = () => {};
  function bundlePlugin() {
    console.log('Buildig Plugin...');
    return esbuild.build({
      entryPoints: [resolve(process.cwd(), 'src', getPluginMeta().id + '.ts')],
      write: false,
      bundle: true,
      outfile: meta.id + '.js',
      format: 'iife',
      watch: true,
      sourcemap: 'inline',
      plugins: [
        {
          name: 'build watcher',
          setup(build) {
            build.onStart(() => {
              console.log('starting build...');
            });
            build.onEnd((res) => {
              console.log('done build');
              const file = res.outputFiles?.find((file) => {
                return file.path.endsWith(meta.id + '.js');
              });
              if (!file) {
                throw new Error('Failed to find plugin build');
              }
              pluginBundle = Buffer.from(file?.contents).toString('utf-8');
              update();
            });
          },
        },
      ],
    });
  }
  mkdirSync(dirname(_devPluginClientFilePath), { recursive: true });
  mkdirSync(dirname(_devPluginOutputFilePath), { recursive: true });
  await taskRunner(
    {
      name: 'Find Port',
      async execute(updateProgress) {
        _port = await firstOpenPort(3000);
      },
      critical: true,
    },
    {
      name: 'Generate Dev Client',
      async execute() {
        const client = `const backend = require(${JSON.stringify(resolve(__dirname, 'internal', 'dev-plugin.js'))});
        backend.createDevPluginEnviroment(__CONFIG)`;

        writeFileSync(_devPluginClientFilePath, client);
      },
    },
    {
      name: 'Build Dev Plugin Backend',
      async execute(updateProgress) {
        await esbuild
          .build({
            entryPoints: [_devPluginClientFilePath],
            define: {
              __CONFIG: JSON.stringify({ port: _port }),
              __PLUGIN: JSON.stringify({
                ...meta,
                id: meta.id + '_dev',
              }),
            },
            format: 'iife',
            bundle: true,
            outfile: _devPluginOutputFilePath,
          })
          .then((res) => {});
      },
      critical: true,
    },
  );
  const httpserver = createServer();
  const wsserver = new WebSocketServer({ server: httpserver });
  wsserver.on('connection', (socket) => {
    let lastSeen = Date.now();
    let hb = setInterval(() => {
      socket.send(JSON.stringify({ type: packetTypes.HARTBEAT, time: Date.now() }));
      if (Date.now() - lastSeen > 3000) {
        clearInterval(hb);
        socket.close();
      }
    }, 1000);
    socket.on('message', (data) => {
      lastSeen = Date.now();
      console.log('<', data.toString('utf-8'));
    });
    socket.on('close', () => {
      clearInterval(hb);
      console.log('lost WS connection');
    });
    // socket.on('open', () => {
    console.log('got WS connection');
    socket.send(JSON.stringify({ type: packetTypes.UPDATE_SCRIPT }));
    // });
  });
  update = () => {
    const packet = JSON.stringify({ type: packetTypes.UPDATE_SCRIPT });
    wsserver.clients.forEach((client) => {
      client.send(packet);
    });
  };
  httpserver.on('request', (request, response) => {
    console.log(`Handling request for '${request.url}'`);
    if (request.url?.replace(/\?[^]+$/, '') === '/' + meta.id + '.js') {
      if (pluginBundle) {
        response.write(pluginBundle);
        response.end();
      } else {
        bundlePlugin().then(() => {
          response.write(pluginBundle);
          response.end();
        });
      }
    }
  });

  httpserver.listen(_port);
  console.log(`dev server running on ${_port}`);
}
