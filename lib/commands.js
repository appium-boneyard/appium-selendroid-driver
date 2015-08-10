let commands = {};

commands.performMultiAction = async function (elId, actions) {
  if (elId) {
    throw new Error("Selendroid actions do not support element id");
  }
  return this.selendroid.jwproxy.command('/action', 'POST', {payload: actions});
};

export default commands;
