import chalk from 'chalk';

interface Task {
  name: string;
  execute: (updateProgress: (message: string) => void) => Promise<void>;
  critical?: boolean;
}
const segments = [
  {
    duration: 60 * 60 * 1000,
    suffix: 'h',
  },
  {
    duration: 60000,
    suffix: 'm',
  },
  {
    duration: 1000,
    suffix: 's',
    manditory: true,
  },
  // {
  //   duration: 1,
  //   suffix: 'ms',
  //   optional: true,
  // },
];
function formatTime(millis: number) {
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
export async function taskRunner(...tasks: Task[]): Promise<void> {
  let taskIndex = 0;
  let fancy = 'cursorTo' in process.stdout;
  const completionStatus: string[] = [];
  const updateMessages: string[] = [];
  const taskTimes: number[] = [];
  function updateTerm(start: number, message = '') {
    if (message === '') delete updateMessages[taskIndex];
    else updateMessages[taskIndex] = message;
    if (fancy) {
      process.stdout.cursorTo(0, 0);
      process.stdout.clearScreenDown();
      const lines = ['Running Tasks:'];
      for (let i = 0; i < tasks.length; i++) {
        let task = tasks[i];
        if (i === taskIndex) {
          lines.push(`${chalk.yellow(formatTime(Date.now() - start).padStart(7, ' '))} - ${task.name}`);
          if (updateMessages[i]) lines.push('MESSAGE - ' + updateMessages[i]);
        } else if (completionStatus[i] === 'success') {
          lines.push(`${chalk.green('COMPLETE')} - ${task.name} - Done in ${formatTime(taskTimes[i])}`);
        } else if (completionStatus[i] === 'error') {
          lines.push(`${chalk.red('FAILURE')} - ${task.name} - Error: ${updateMessages[i]}`);
        } else {
          lines.push(`${chalk.gray('WAITING')} - ${task.name} - pending...`);
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
