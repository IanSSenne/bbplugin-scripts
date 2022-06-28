import { packetTypes } from './packetTypes';

export interface DevPluginEnv {
  port: number;
}
type Packet =
  | {
      type: packetTypes.HARTBEAT;
      time: number;
    }
  | {
      type: packetTypes.UPDATE_SCRIPT;
      script: string;
    };
export function createDevPluginEnviroment({ port }: DevPluginEnv) {
  // @ts-ignore
  let _oldGet = https.get;
  let httpGet = eval("require('http')").get;
  https.get = (url, ...args) => {
    if (url.includes('localhost')) {
      return httpGet(url, ...args);
    } else {
      return _oldGet(url, ...args);
    }
  };
  let _oldPlugin: Plugin = Plugins.registered[getPluginMeta().id.replace(/_dev$/, '')];
  console.log({ _oldPlugin });
  let _oldUrl: string;
  function updatePluginCode() {
    if (_oldPlugin) _oldPlugin.uninstall();
    // @ts-ignore
    _oldPlugin = new Plugin();
    _oldPlugin.loadFromURL(`http://localhost:${port}/${getPluginMeta().id.replace(/_dev$/, '')}.js`);
  }
  function getPluginMeta() {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    return __PLUGIN;
  }
  let devPlugin: any;
  function fixup() {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    devPlugin = Plugins.registered[getPluginMeta().id];
  }
  setTimeout(fixup, 1000);
  const WS = new WebSocket(`ws://localhost:${port}`);
  function die() {
    console.log('DIE');
    WS.close();
    https.get = _oldGet;
  }
  let hbInterval: number;
  let dieTimeout: number = setTimeout(die, 3000) as unknown as number;
  WS.onmessage = (event) => {
    const packed: Packet = JSON.parse(event.data);
    if (packed.type === packetTypes.HARTBEAT) {
      clearTimeout(dieTimeout);
      dieTimeout = setTimeout(die, 3000) as unknown as number;
    } else if (packed.type === packetTypes.UPDATE_SCRIPT) {
      updatePluginCode();
    }
  };
  WS.onopen = () => {
    hbInterval = setInterval(() => {
      WS.send(JSON.stringify({ type: packetTypes.HARTBEAT, time: Date.now() }));
    }, 1000) as unknown as number;
    WS.send(JSON.stringify({ type: packetTypes.HANDSHAKE }));
  };
  WS.onclose = () => {
    clearInterval(hbInterval);
    maybeClean();
  };
  WS.onerror = (error) => {
    if (WS.readyState === WebSocket.CLOSED) {
      maybeClean();
    }
  };

  function maybeClean() {
    Blockbench.showMessageBox(
      {
        title: 'Dev Server Connection Closed',
        message: '<p>Would you like to remove the dev plugin and reload blockbench?</p>',
        buttons: ['confirm', 'cancel'],
      },
      (result: number) => {
        if (!result) {
          devPlugin.uninstall();
          if (_oldPlugin) _oldPlugin.uninstall();
          if (_oldUrl) URL.revokeObjectURL(_oldPlugin);
          https.get = _oldGet;
          Blockbench.reload();
        }
      },
    );
  }
  // @ts-ignore
  Plugin.register(getPluginMeta().id, {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    ...getPluginMeta(),
    onunload() {
      die();
    },
  });
}
