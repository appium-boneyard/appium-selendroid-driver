import { commands as commonCommands } from 'appium-android-driver';
let commands = {};

// bring in some common commands that are actually implemented in the general
// appium driver
const sharedCommands = ['pushUnlock', 'unlock', 'installApp', 'isAppInstalled',
                        'removeApp', 'setLocation', 'removeApp', 'unpackApp'];

export default commands;
