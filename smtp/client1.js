/* a simple SMTP client with no dependencies in NodeJS  that connects to directly  to email servers and sends an email from "john@example.com" with the subject "Hello world" and the email body "This is a test"  */
const net = require("net");
const socket = net.connect({ host: "127.0.0.1", port: 2525 });

socket.on("data", (data) => {
  const response = data.toString();

  if (response.includes("220")) {
    socket.write("HELO localhost\r\n");
  } else if (response.includes("250")) {
    socket.write("MAIL FROM: <john@example.com>\r\n");
  } else if (response.includes("250")) {
    socket.write("RCPT TO: <test@test.com>\r\n");
  } else if (response.includes("250")) {
    socket.write("DATA\r\n");
  } else if (response.includes("354")) {
    socket.write("Subject: Hello world\r\n\r\n");
    socket.write("This is a test\r\n.\r\n");
  } else if (response.includes("250")) {
    socket.write("QUIT\r\n");
  }
});

socket.on("close", () => {
  console.log("Connection closed");
});
