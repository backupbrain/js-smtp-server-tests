let net = require("net");
let port = 2524;

let server = net.createServer((socket) => {
  socket.on("error", (err) => {
    console.log(err);
  });

  socket.on("data", (rawData) => {
    const data = rawData.toString("utf-8");
    console.log(data);
  });
});

server.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
