let packetTypes;

(function (packetTypes) {
  packetTypes[packetTypes["HARTBEAT"] = 0] = "HARTBEAT";
  packetTypes[packetTypes["UPDATE_SCRIPT"] = 1] = "UPDATE_SCRIPT";
  packetTypes[packetTypes["HANDSHAKE"] = 2] = "HANDSHAKE";
})(packetTypes || (packetTypes = {}));

function createDevPluginEnviroment({
  port
}) {
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

  let _oldPlugin = Plugins.registered[getPluginMeta().id.replace(/_dev$/, '')];
  console.log({
    _oldPlugin
  });

  function updatePluginCode() {
    if (_oldPlugin) _oldPlugin.uninstall(); // @ts-ignore

    _oldPlugin = new Plugin();

    _oldPlugin.loadFromURL(`http://localhost:${port}/${getPluginMeta().id.replace(/_dev$/, '')}.js`);
  }

  function getPluginMeta() {
    // @ts-ignore
    // eslint-disable-next-line no-undef
    return __PLUGIN;
  }

  let devPlugin;

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

  let hbInterval;
  let dieTimeout = setTimeout(die, 3000);

  WS.onmessage = event => {
    const packed = JSON.parse(event.data);

    if (packed.type === packetTypes.HARTBEAT) {
      clearTimeout(dieTimeout);
      dieTimeout = setTimeout(die, 3000);
    } else if (packed.type === packetTypes.UPDATE_SCRIPT) {
      updatePluginCode();
    }
  };

  WS.onopen = () => {
    hbInterval = setInterval(() => {
      WS.send(JSON.stringify({
        type: packetTypes.HARTBEAT,
        time: Date.now()
      }));
    }, 1000);
    WS.send(JSON.stringify({
      type: packetTypes.HANDSHAKE
    }));
  };

  WS.onclose = () => {
    clearInterval(hbInterval);
    maybeClean();
  };

  WS.onerror = error => {
    if (WS.readyState === WebSocket.CLOSED) {
      maybeClean();
    }
  };

  function maybeClean() {
    Blockbench.showMessageBox({
      title: 'Dev Server Connection Closed',
      message: '<p>Would you like to remove the dev plugin and reload blockbench?</p>',
      buttons: ['confirm', 'cancel']
    }, result => {
      if (!result) {
        devPlugin.uninstall();
        if (_oldPlugin) _oldPlugin.uninstall();
        https.get = _oldGet;
        Blockbench.reload();
      }
    });
  } // @ts-ignore


  Plugin.register(getPluginMeta().id, { // @ts-ignore
    // eslint-disable-next-line no-undef
    ...getPluginMeta(),

    onunload() {
      die();
    }

  });
}

export { createDevPluginEnviroment };
