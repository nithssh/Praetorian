function isValidCodeCommand(message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (!message.content.split(" ")[0].toLowerCase().endsWith("code")) {
    return false;
  }
  if (message.content.split(" ")[1] < 100000 || message.content.split(" ")[1] > 1000000) {
    return false;
  }
  return true;
}

function isValidVerifyCommand(message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (!message.content.split(" ")[0].toLowerCase().endsWith("verify")) {
    return false;
  }
  if (!isValidEmail(message.content.split(" ")[1])) {
    return false;
  }
  return true;
}

function isValidConfigureCommand(message) {
  let cmdParts = message.content.split(" ");
  if (cmdParts.length < 2) {
    return false;
  }
  if (!cmdParts[0].toLowerCase().endsWith("configure")) {
    return false;
  }
  if (
    cmdParts[1].toLowerCase() != "domain" &&
    cmdParts[1].toLowerCase() != "prefix" &&
    cmdParts[1].toLowerCase() != "setcmdchannel"
  ) {
    return false;
  }
  if (cmdParts[1].toLowerCase() == "prefix") {
    if (cmdParts[2].length !== 1) {
      return false;
    }
  }
  return true;
}

function isSetChannelCommand(message) {
  let cmdPart = message.content.split(" ");
  if (!isValidConfigureCommand(message)) {
    return false;
  }
  if (cmdPart[1].toLowerCase() !== "setcmdchannel") {
    return false;
  }
  return true;
}

function isValidEmail(email) {
  const format = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return format.test(email)
}

module.exports = {
  isValidCodeCommand,
  isValidVerifyCommand,
  isValidConfigureCommand,
  isSetChannelCommand
}
