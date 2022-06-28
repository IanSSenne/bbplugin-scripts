import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import chalk from 'chalk';

interface PluginMeta {
  name: string;
  version: `${number}.${number}.${number}`;
  description: string;
  tags: [] | [string] | [string, string] | [string, string, string];
  icon: string;
  min_version: `${number}.${number}.${number}`;
  variant?: 'both' | 'desktop' | 'web';
  id: string;
}
const metaPath = resolve(process.cwd(), 'plugin.json');
let _pluginData: PluginMeta;
export function getPluginMeta(): PluginMeta {
  if (_pluginData) return _pluginData;
  let has_failed = false;
  function _assert(condition: boolean, message: string) {
    if (!condition) {
      console.log(message);
      has_failed = true;
    }
  }
  if (existsSync(metaPath)) {
    let pluginData: PluginMeta;
    try {
      pluginData = JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch (e) {
      console.log(chalk.red(`Failed to parse 'plugin.json' at '${metaPath}'`));
      process.exit(0);
    }
    _assert(typeof pluginData.name === 'string', "Expected field 'name' in 'plugin.json' to be a string");
    _assert(typeof pluginData.version === 'string', "Expected field 'version' in 'plugin.json' to be a string");
    _assert(typeof pluginData.min_version === 'string', "Expected field 'min_version' in 'plugin.json' to be a string");
    _assert(typeof pluginData.description === 'string', "Expected field 'description' in 'plugin.json' to be a string");
    _assert(
      Array.isArray(pluginData.tags) && pluginData.tags.length < 4,
      "Expected field 'tags' in 'plugin.json' to be a tuple of 0-3 strings",
    );
    _assert(typeof pluginData.icon === 'string', "Expected field 'icon' in 'plugin.json' to be a string");
    _assert(
      ['both', 'web', 'desktop', undefined].includes(pluginData.variant),
      "Expected field 'variant' in 'plugin.json' to be any of 'desktop','web','both' or absent",
    );
    _assert(
      typeof pluginData.id === 'string' && !/[^a-z_]/.test(pluginData.id),
      "Expected field 'id' in 'plugin.json' to be a string containing only '_' and 'a' through 'z'",
    );
    if (has_failed) process.exit(1);
    _pluginData = pluginData;
    return pluginData;
  } else {
    console.log(chalk.red(`Expected 'plugin.json' at '${metaPath}'`));
    process.exit(0);
  }
}
// {
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
