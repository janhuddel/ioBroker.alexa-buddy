"use strict";

/*
 * Created with @iobroker/create-adapter v1.34.1
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");

const io = require("socket.io-client");

/**
 * The adapter instance
 * @type {ioBroker.Adapter}
 */
let adapter;

/**
 * Websocket-Client
 */
let socket = null;

/**
 * Starts the adapter instance
 * @param {Partial<utils.AdapterOptions>} [options]
 */
function startAdapter(options) {
  return (adapter = utils.adapter(
    Object.assign({}, options, {
      name: "alexa-buddy",

      // The ready callback is called when databases are connected and adapter received configuration.
      ready: main, // Main method defined below for readability

      // is called when adapter shuts down - callback has to be called under any circumstances!
      unload: (callback) => {
        if (socket) {
          socket.disconnect();
          socket = null;
        }
        callback();
      },
    })
  ));
}

async function main() {
  // Reset the connection indicator during startup
  await adapter.setStateAsync("info.connection", false, true);

  const apikey = adapter.config.apikey;
  const server = adapter.config.server;

  if (!socket) {
    socket = io(server, {
      transports: ["websocket"],
      query: `apikey=${apikey}`,
    });
  } else {
    console.log("websocket already connected");
  }

  socket.on("connect", async () => {
    adapter.log.info(`websocket connected with ${server}`);
    await adapter.setStateAsync("info.connection", true, true);
  });

  socket.on("disconnect", async (reason) => {
    adapter.log.info("websocket disconnected", reason);
    await adapter.setStateAsync("info.connection", false, true);
  });

  socket.on("connect_error", async (error) => {
    let errorMessage;
    if (error.description && error.description.message) {
      errorMessage = error.description.message;
    } else {
      errorMessage = error.message;
    }
    adapter.log.error(`websocket-error: ${errorMessage}`);
    await adapter.setStateAsync("info.connection", false, true);
  });

  socket.on("setState", async (states, callback) => {
    for (const [datapoint, value] of Object.entries(states)) {
      console.log(`setting state of ${datapoint} to ${value}...`);
      await adapter.setForeignStateAsync(datapoint, value);
    }
    callback();
  });

  socket.on("getState", async (datapoint, callback) => {
    //console.log(`reading state of ${datapoint}...`);
    if (typeof datapoint !== "object") {
      const result = await adapter.getForeignStateAsync(datapoint);
      callback(result);
    } else {
      const result = {};
      for (const [key, value] of Object.entries(datapoint)) {
        result[key] = await adapter.getForeignStateAsync(value);
      }
      callback(result);
    }
  });
}

if (require.main !== module) {
  // Export startAdapter in compact mode
  module.exports = startAdapter;
} else {
  // otherwise start the instance directly
  startAdapter();
}
