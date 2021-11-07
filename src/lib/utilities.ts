import { Message } from 'discord.js';

export function isValidCodeCommand(message: Message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (message.content.split(" ")[0].toLowerCase().slice(1) != "code") {
    return false;
  }
  if (+message.content.split(" ")[1] < 100000 || +message.content.split(" ")[1] > 1000000) {
    return false;
  }
  return true;
}

export function isValidVerifyCommand(message: Message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (message.content.split(" ")[0].toLowerCase().slice(1) != "verify") {
    return false;
  }
  if (!isValidEmail(message.content.split(" ")[1])) {
    return false;
  }
  return true;
}

// Valid Commands
// configure setcmdchannel
// configure prefix !
// configure domain add example.com
// configure domain remove example.com
// configure domain get
export function isValidConfigureCommand(message: Message) {
  let cmdParts = message.content.split(" ");
  if (cmdParts.length < 2 || cmdParts.length > 4) {
    return false;
  }
  if (!cmdParts[0].toLowerCase().endsWith("configure")) {
    return false;
  }
  if (
    cmdParts[1].toLowerCase() != "domain" &&
    cmdParts[1].toLowerCase() != "prefix" &&
    cmdParts[1].toLowerCase() != "setcmdchannel" &&
    cmdParts[1].toLowerCase() != "autoverifyall"
  ) {
    return false;
  }
  if (cmdParts[1].toLowerCase() == "domain") {
    if (cmdParts[2] === undefined) {
      return false;
    }

    if (cmdParts[2].toLowerCase() == "add" || cmdParts[2].toLowerCase() == "remove") {
      const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/
      if (!domainPattern.test(cmdParts[3])) {
        return false;
      }
    } else if (cmdParts[2].toLowerCase() == "get") {
      // do nothing
    } else {
      return false;
    }
  }

  if (cmdParts[1].toLowerCase() == "prefix") {
    if (cmdParts[2].length !== 1) {
      return false;
    }
  }
  return true;
}

export function isSetChannelCommand(message: Message) {
  let cmdPart = message.content.split(" ");
  if (!isValidConfigureCommand(message)) {
    return false;
  }
  if (cmdPart[1].toLowerCase() !== "setcmdchannel") {
    return false;
  }
  return true;
}

function isValidEmail(email: string) {
  const format = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return format.test(email)
}
