let net = require("net");
let port = 2524;
let serverName = "test server";

class EmailServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

let maxConnections = 2;

let b64Decode = (b64string) => {
  let bufferObj = Buffer.from(b64string, "base64");
  let str = bufferObj.toString("utf8");
  return str;
};

const accounts = {
  tonyg: { password: "password" },
};

let getUser = async (username) => {
  const user = accounts[username];
  return user;
};

let isUserLocal = async (email) => {
  const domain = "example.com";
  const emailParts = email.split("@");
  const emailUser = emailParts[0];
  const emailDomain = emailParts[1];
  if (emailDomain !== domain) {
    return false;
  }
  return emailUser in accounts;
};

let doesPasswordMatch = async (userPassword, password) => {
  return password === userPassword;
};

let isEmailValid = (email) => {
  const regex = new RegExp(
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
  return regex.test(email);
};

let invalidCommandError = (socket, code, message) => {
  console.log("Invalid command");
  socket.write(`${code} ${message}\n`);
};

let tooManyConnectionsError = (socket, message) => {
  const code = 421;
  console.log("Too many connections");
  socket.write(`${code} ${message}\n`);
};

let respond = (socket, code, message) => {
  console.log(code, message);
  socket.write(`${code} ${message}\n`);
};

let sendMessage = (socket, from, to, subject, message) => {
  // TODO: connect to foreign server if necessary to forward
  // may involve DKIM, SPF, MX lookup, etc
  // TODO: use DKIM, SPF, etc to verify sender if necessary
  console.log("Sending message:");
  console.log(`From: ${from}`);
  console.log(`To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`${message}`);
  const id = Math.round(Math.random() * 1000);
  socket.write(`250 2.6.0 OK – Message queued - id ${id}\n`);
};

let connections = {};

class StateMachine {
  // state = "open";
  // stream = "";
  constructor(stream) {
    this.state = "connected";
    this.stream = stream;
    this.fromEmail = undefined;
    this.toEmail = [];
    this.subject = undefined;
    this.message = [];
    this.auth = {
      user: undefined,
    };
  }
  processCommand = async (rawData) => {
    // TODO: HELP + 214 help response
    try {
      const data = rawData.trim();
      const inputs = data.split(" ");
      if (inputs.length === 0) {
        throw new EmailServiceError(
          500,
          `Syntax error, command unrecognized - (none)`
        );
      }
      const command = inputs[0];
      const parameters = inputs.slice(1);
      if (command === "QUIT") {
        this.stream.write("221 2.0.0 Goodbye\n");
        this.stream.destroy();
        return;
      }
      switch (this.state) {
        case "connected":
          if (command === "HELO") {
            this.state = "waiting";
            console.log("hello there!");
          } else {
            throw new EmailServiceError(
              500,
              `Syntax error, command unrecognized - found "${command}", expected "HELO"`
            );
          }
          this.state = "require_auth";
          this.stream.write(`220 ${serverName} - nice to meet you`);
          break;
        case "require_auth":
          if (command === "AUTH") {
            if (parameters[0] !== "LOGIN") {
              throw new EmailServiceError(
                504,
                `5.5.4 Unrecognized authentication type - expected "LOGIN"`
              );
            } else {
              this.state = "waiting_username";
            }
          } else {
            throw new EmailServiceError(530, "Authentication required");
          }
          break;
        case "waiting_username":
          if (data === "" && data.indexOf(" ") >= 0) {
            throw new EmailServiceError(
              501,
              "5.5.2 Cannot Base64-decode Client responses"
            );
          }
          const username = b64Decode(data);
          console.log(`username: ${username}`);
          const user = await getUser(username);
          console.log({ user });
          this.auth.user = user;
          this.state = "awaiting_password";
          break;
        case "awaiting_password":
          if (data === "" && data.indexOf(" ") >= 0) {
            throw new EmailServiceError(
              501,
              "5.5.2 Cannot Base64-decode Client responses"
            );
          }
          const password = b64Decode(data);
          console.log(`password: ${password}`);
          const doPasswordsMatch = await doesPasswordMatch(
            this.auth.user.password,
            password
          );
          console.log({ doPasswordsMatch });
          if (doPasswordsMatch) {
            this.stream.write("235 2.7.0 Authentication Succeeded\n");
            this.state = "waiting_from";
          } else {
            this.state = "require_auth";
            throw new EmailServiceError(
              535,
              "5.7.8 Authentication credentials invalid"
            );
          }
          break;
        case "waiting_from":
          if (command === "MAIL") {
            if (parameters.length !== 2) {
              throw new EmailServiceError(
                501,
                `Syntax error in parameters or arguments - found "FROM:"`
              );
            }
            if (parameters[0] !== "FROM:") {
              throw new EmailServiceError(
                501,
                `Syntax error in parameters or arguments - found "${parameters[0]}", expected "FROM:"`
              );
            }
            const fromEmail = parameters[1];
            if (!isEmailValid(fromEmail)) {
              throw new EmailServiceError(
                501,
                `Invalid email address ${fromEmail}`
              );
            }
            // const isLocal = isUserLocal(fromEmail);
            // if (!isLocal) {
            //   throw new EmailServiceError(
            //     551,
            //     "User not local; please try <forward-path>"
            //   );
            // }
            // TODO: verify email address, including "" <> format
            this.fromEmail = fromEmail;
            this.state = "waiting_to";
            this.stream.write(`250 2.1.0 Originator ${fromEmail} Ok\n`);
          } else {
            throw new EmailServiceError(
              503,
              `Syntax error in parameters or arguments - found "${parameters[0]}", expected "FROM:"`
            );
          }
          break;
        case "waiting_to":
          if (data === "DATA") {
            this.state = "waiting_headers";
            this.stream.write(
              "354 Write message, end data with <CR><LF>.<CR><LF>\n"
            );
            break;
          }
          // can have multiple recipients
          if (command === "RCPT") {
            if (parameters.length !== 2) {
              throw new EmailServiceError(
                503,
                `Syntax error in parameters or arguments - expected "TO:"`
              );
            }
            if (parameters[0] !== "TO:") {
              throw new EmailServiceError(
                503,
                `Syntax error in parameters or arguments - found "${parameters[0]}", expected "TO:"`
              );
            }
            const toEmail = parameters[1];
            if (!isEmailValid(toEmail)) {
              throw new EmailServiceError(
                503,
                `Invalid email address ${toEmail}`
              );
            }
            // TODO // TODO: verify email address, including "" <> format
            const isLocal = isUserLocal(toEmail);
            if (isLocal) {
              // if the user doesn't exist, we should issue a 252
              this.stream.write(`250 2.1.5 Recipient ${toEmail} Ok\n`);
            } else {
              this.stream.write("251 Requested user not local; will forward\n");
            }
            // TODO: connect to another SMTP and try to send, maybe issue this?
            // 252 Cannot verify the user, but it will try to deliver the message anyway

            this.toEmail.push(toEmail);
            this.stream.write("250 Ok\n");
          } else {
            console.log({ parameters });
            throw new EmailServiceError(
              503,
              `Syntax error, command unrecognized - found "${command}", expected "RCPT:"`
            );
          }
          break;
        case "waiting_headers":
          if (data === "") {
            // this.stream.write("354 Start mail input\n");
            console.log("receiving_message");
            this.state = "receiving_message";
            break;
          }
          const headerData = data.split(":");
          if (headerData.length !== 2) {
            throw new EmailServiceError(
              501,
              "Syntax error in parameters or arguments"
            );
          }
          const key = headerData[0];
          const value = headerData[1];
          if (key === "subject") {
            this.subject = value;
          } else {
            this.headers[key] = value;
          }
          break;
        case "receiving_message":
          if (data === ".") {
            console.log("message complete");
            sendMessage(
              this.stream,
              this.fromEmail,
              this.toEmail,
              this.subject,
              this.message.join("\n")
            );
            this.fromEmail = undefined;
            this.toEmail = [];
            this.subject = undefined;
            this.message = [];
          } else {
            console.log(`adding to message: ${data}`);
            this.message.push(data);
            this.state = "receiving_message";
          }
          break;
        default:
          throw new EmailServiceError(
            500,
            `Syntax error, command unrecognized - "${command}"`
          );
      }
    } catch (error) {
      console.log(`Error: ${error.message}`);
      this.stream.write(`${error.code} ${error.message}\n`);
    }
  };
}

let server = net.createServer((socket) => {
  server.on("connection", (stream) => {
    console.log("hello");
    console.log({ stream });
    remoteAddress = stream.remoteAddress;
    let sm = new StateMachine(stream);
    socket.write(`220 ${serverName} SMTP Service ready\n`);
    stream.on("data", (rawData) => {
      const data = rawData.toString("utf-8");
      console.log(data);
      try {
        sm.processCommand(data);
      } catch (error) {
        console.log({ error: error.message });
        invalidCommandError(stream, 500, error.message);
      }
    });
  });
  server.on("close", (stream) => {
    stream.write(`221 ${serverName} Service closing transmission channel`);
  });
  socket.on("error", (err) => {
    console.log(err);
  });

  //   socket.on("data", (rawData) => {
  //     const data = rawData.toString("utf-8");
  //     console.log(data);
  //     if (data.length < 4) {
  //       invalidCommandError(socket, 500, "Unrecognized command");
  //     }
  //     const command = data.substring(0, 4);
  //     console.log(command);
  //     switch (command) {
  //       case "HELO":

  //         respond(socket, 250, "Hello");
  //         break;
  //       case "MAIL":
  //         respond(socket, 250, "New mail");
  //         break;
  //       case "RCPT":
  //         break;
  //       case "DATA":
  //         break;
  //     }
  //   });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// server.close();

// console.log(util.inspect(server.listeners('connection')));
