#!/usr/bin/env node
'use strict';

var commander = require('commander');
var esbuild = require('esbuild');
var chalk = require('chalk');
var path = require('path');
var fs = require('fs');
var firstOpenPort = require('first-open-port');
var ws = require('ws');
var http = require('http');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var commander__default = /*#__PURE__*/_interopDefaultLegacy(commander);
var esbuild__default = /*#__PURE__*/_interopDefaultLegacy(esbuild);
var chalk__default = /*#__PURE__*/_interopDefaultLegacy(chalk);
var firstOpenPort__default = /*#__PURE__*/_interopDefaultLegacy(firstOpenPort);

var name = "bbplugin-scripts";
var version = "0.0.0";

const segments = [{
  duration: 60 * 60 * 1000,
  suffix: 'h'
}, {
  duration: 60000,
  suffix: 'm'
}, {
  duration: 1000,
  suffix: 's',
  manditory: true
} // {
//   duration: 1,
//   suffix: 'ms',
//   optional: true,
// },
];

function formatTime(millis) {
  let ms = millis;
  let time = '';
  let foundSegment = false;

  for (const segment of segments) {
    if (segment.duration <= ms) {
      foundSegment = true;
      let count = Math.floor(ms / segment.duration);
      ms -= segment.duration * count;
      time += count + segment.suffix;
    } else if (foundSegment || segment.manditory) {
      time += '0' + segment.suffix;
    }
  }

  return time;
}

async function taskRunner(...tasks) {
  let taskIndex = 0;
  let fancy = ('cursorTo' in process.stdout);
  const completionStatus = [];
  const updateMessages = [];
  const taskTimes = [];

  function updateTerm(start, message = '') {
    if (message === '') delete updateMessages[taskIndex];else updateMessages[taskIndex] = message;

    if (fancy) {
      process.stdout.cursorTo(0, 0);
      process.stdout.clearScreenDown();
      const lines = ['Running Tasks:'];

      for (let i = 0; i < tasks.length; i++) {
        let task = tasks[i];

        if (i === taskIndex) {
          lines.push(`${chalk__default["default"].yellow(formatTime(Date.now() - start).padStart(7, ' '))} - ${task.name}`);
          if (updateMessages[i]) lines.push('MESSAGE - ' + updateMessages[i]);
        } else if (completionStatus[i] === 'success') {
          lines.push(`${chalk__default["default"].green('COMPLETE')} - ${task.name} - Done in ${formatTime(taskTimes[i])}`);
        } else if (completionStatus[i] === 'error') {
          lines.push(`${chalk__default["default"].red('FAILURE')} - ${task.name} - Error: ${updateMessages[i]}`);
        } else {
          lines.push(`${chalk__default["default"].gray('WAITING')} - ${task.name} - pending...`);
        }
      }

      process.stdout.write(lines.join('\n'));
      process.stdout.cursorTo(process.stdout.columns - 1, 0);
    }
  }

  for (let task of tasks) {
    const start = Date.now();
    updateTerm(start);

    let _interval = setInterval(() => {
      updateTerm(start);
    }, 1000);

    try {
      await task.execute(updateTerm.bind(updateTerm, start));
      completionStatus[taskIndex] = 'success';
    } catch (e) {
      completionStatus[taskIndex] = 'error';

      if (e instanceof Error) {
        updateMessages[taskIndex] = e.message;
      } else {
        updateMessages[taskIndex] = 'unknown error';
      }

      if (task.critical) {
        clearInterval(_interval);
        throw e;
      }
    }

    clearInterval(_interval);
    taskIndex++;
  }

  process.stdout.cursorTo(0, 0);
  process.stdout.clearScreenDown();
}

const metaPath = path.resolve(process.cwd(), 'plugin.json');

let _pluginData;

function getPluginMeta() {
  if (_pluginData) return _pluginData;
  let has_failed = false;

  function _assert(condition, message) {
    if (!condition) {
      console.log(message);
      has_failed = true;
    }
  }

  if (fs.existsSync(metaPath)) {
    let pluginData;

    try {
      pluginData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (e) {
      console.log(chalk__default["default"].red(`Failed to parse 'plugin.json' at '${metaPath}'`));
      process.exit(0);
    }

    _assert(typeof pluginData.name === 'string', "Expected field 'name' in 'plugin.json' to be a string");

    _assert(typeof pluginData.version === 'string', "Expected field 'version' in 'plugin.json' to be a string");

    _assert(typeof pluginData.min_version === 'string', "Expected field 'min_version' in 'plugin.json' to be a string");

    _assert(typeof pluginData.description === 'string', "Expected field 'description' in 'plugin.json' to be a string");

    _assert(Array.isArray(pluginData.tags) && pluginData.tags.length < 4, "Expected field 'tags' in 'plugin.json' to be a tuple of 0-3 strings");

    _assert(typeof pluginData.icon === 'string', "Expected field 'icon' in 'plugin.json' to be a string");

    _assert(['both', 'web', 'desktop', undefined].includes(pluginData.variant), "Expected field 'variant' in 'plugin.json' to be any of 'desktop','web','both' or absent");

    _assert(typeof pluginData.id === 'string' && !/[^a-z_]/.test(pluginData.id), "Expected field 'id' in 'plugin.json' to be a string containing only '_' and 'a' through 'z'");

    if (has_failed) process.exit(1);
    _pluginData = pluginData;
    return pluginData;
  } else {
    console.log(chalk__default["default"].red(`Expected 'plugin.json' at '${metaPath}'`));
    process.exit(0);
  }
} // {
//   "title": "Block Splitter",
//   "author": "FetchBot",
//   "description": "desc",
//   "about": "we are fucked",
//   "tags": [],
//   "icon": "fa-forward",
//   "version": "0.0.1",
//   "min_version": "4.0.0",
//   "variant": "desktop",
//   "id": "block_splitter"
// }

let packetTypes;

(function (packetTypes) {
  packetTypes[packetTypes["HARTBEAT"] = 0] = "HARTBEAT";
  packetTypes[packetTypes["UPDATE_SCRIPT"] = 1] = "UPDATE_SCRIPT";
  packetTypes[packetTypes["HANDSHAKE"] = 2] = "HANDSHAKE";
})(packetTypes || (packetTypes = {}));

async function devBundler() {
  let _port;

  let _devPluginClientFilePath = path.resolve(process.cwd(), '.plugin-scripts', 'backend', 'plugin.js');

  let _devPluginOutputFilePath = path.resolve(process.cwd(), 'plugins', getPluginMeta().id + '_dev.js');

  let pluginBundle;
  const meta = getPluginMeta();

  let update = () => {};

  function bundlePlugin() {
    console.log('Buildig Plugin...');
    return esbuild__default["default"].build({
      entryPoints: [path.resolve(process.cwd(), 'src', getPluginMeta().id + '.ts')],
      write: false,
      bundle: true,
      outfile: meta.id + '.js',
      format: 'iife',
      watch: true,
      sourcemap: 'inline',
      plugins: [{
        name: 'build watcher',

        setup(build) {
          build.onStart(() => {
            console.log('starting build...');
          });
          build.onEnd(res => {
            console.log('done build');
            const file = res.outputFiles?.find(file => {
              return file.path.endsWith(meta.id + '.js');
            });

            if (!file) {
              throw new Error('Failed to find plugin build');
            }

            pluginBundle = Buffer.from(file?.contents).toString('utf-8');
            update();
          });
        }

      }]
    });
  }

  fs.mkdirSync(path.dirname(_devPluginClientFilePath), {
    recursive: true
  });
  fs.mkdirSync(path.dirname(_devPluginOutputFilePath), {
    recursive: true
  });
  await taskRunner({
    name: 'Find Port',

    async execute(updateProgress) {
      _port = await firstOpenPort__default["default"](3000);
    },

    critical: true
  }, {
    name: 'Generate Dev Client',

    async execute() {
      const client = `const backend = require(${JSON.stringify(path.resolve(__dirname, 'internal', 'dev-plugin.js'))});
        backend.createDevPluginEnviroment(__CONFIG)`;
      fs.writeFileSync(_devPluginClientFilePath, client);
    }

  }, {
    name: 'Build Dev Plugin Backend',

    async execute(updateProgress) {
      await esbuild__default["default"].build({
        entryPoints: [_devPluginClientFilePath],
        define: {
          __CONFIG: JSON.stringify({
            port: _port
          }),
          __PLUGIN: JSON.stringify({ ...meta,
            id: meta.id + '_dev'
          })
        },
        format: 'iife',
        bundle: true,
        outfile: _devPluginOutputFilePath
      }).then(res => {});
    },

    critical: true
  });
  const httpserver = http.createServer();
  const wsserver = new ws.WebSocketServer({
    server: httpserver
  });
  wsserver.on('connection', socket => {
    let lastSeen = Date.now();
    let hb = setInterval(() => {
      socket.send(JSON.stringify({
        type: packetTypes.HARTBEAT,
        time: Date.now()
      }));

      if (Date.now() - lastSeen > 3000) {
        clearInterval(hb);
        socket.close();
      }
    }, 1000);
    socket.on('message', data => {
      lastSeen = Date.now();
      console.log('<', data.toString('utf-8'));
    });
    socket.on('close', () => {
      clearInterval(hb);
      console.log('lost WS connection');
    }); // socket.on('open', () => {

    console.log('got WS connection');
    socket.send(JSON.stringify({
      type: packetTypes.UPDATE_SCRIPT
    })); // });
  });

  update = () => {
    const packet = JSON.stringify({
      type: packetTypes.UPDATE_SCRIPT
    });
    wsserver.clients.forEach(client => {
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

const program = new commander__default["default"].Command();
program.name(name);
program.version(version);
program.command('dev').description('start the development bundler for this project').action(() => {
  devBundler();
});
program.parse();
