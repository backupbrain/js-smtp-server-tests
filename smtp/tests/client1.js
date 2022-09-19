/* a simple SMTP client with no dependencies in NodeJS  that connects to directly  to email servers and sends an email from "john@example.com" with the subject "Hello world" and the email body "This is a test"  */
const net = require("net");
const port = 2524;
// let socket = undefined;
let socket = net.connect({ host: "127.0.0.1", port }, (sock) => {
  // socket = sock;
  console.log(sock);
});

socket.on("data", (data) => {
  const response = data.toString();
  console.log(response);
});

socket.on("close", () => {
  console.log("Connection closed");
});

let base64encode = (str) => {
  const buf = Buffer.from(str, "utf8");
  const b64String = buf.toString("base64");
  return b64String;
};

socket.write("HELO localhost\n");
socket.write("AUTH LOGIN\n");
socket.write(`${base64encode("tonyg")}\n`);
socket.write(`${base64encode("password")}\n`);
socket.write("MAIL FROM: alice@example.com\n");
socket.write("RCPT TO: bob@example.com\n");
socket.write("subject: subject\n");
socket.write("\n");
socket.write("Hello my friend\n");
socket.write("This is a test\n");
socket.write(".\n");
socket.write("QUIT\n");
// socket.destroy();
