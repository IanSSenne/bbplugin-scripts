import commander from 'commander';
import { name, version } from './package.json';
import { devBundler } from './src/bundlers/dev';

const program = new commander.Command();

program.name(name);
program.version(version);

program
  .command('dev')
  .description('start the development bundler for this project')
  .action(() => {
    devBundler();
  });

program.parse();
