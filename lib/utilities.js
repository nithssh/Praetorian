function isValidCodeCommand(message) {
  if (message.content.split(" ").length !== 2) {
    return false;
  }
  if (message.content.split(" ")[0].toLowerCase() != "!code") {
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
  if (message.content.split(" ")[0].toLowerCase() != "!verify") {
    return false;
  }
  if (!isValidEmail(message.content.split(" ")[1])) {
    return false;
  }
  return true;
}

function isValidEmail(email) {
  const format = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return format.test(email)
}

function isRightDomain(email) {
  return (email.split("@")[1].toLowerCase() === "ssn.edu.in")
}

module.exports = {
  isValidCodeCommand,
  isValidVerifyCommand,
  isRightDomain
}