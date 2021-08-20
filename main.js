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

  socket.on("setState", async (state, callback) => {
    for (const [key, value] of Object.entries(state)) {
      let nativeValue = value;

      // check min/max when type is number
      const object = await adapter.getForeignObjectAsync(key);
      if (object.common.type === "number") {
        const min = object.common.min;
        const max = object.common.max;

        if (min && value < min) {
          console.log(
            `value is smaller than defined min-value (${value} < ${min})`
          );
          nativeValue = min;
        } else if (max && value > max) {
          console.log(
            `value is greater than defined max-value (${value} > ${max})`
          );
          nativeValue = max;
        }
      }

      console.log(`set value of ${key} to ${nativeValue}...`);
      await adapter.setForeignStateAsync(key, nativeValue);
    }

    callback();
  });

  socket.on("getState", async (datapoint, callback) => {
    //console.log(`reading state of ${datapoint}...`);
    const result = await adapter.getForeignStateAsync(datapoint);

    console.log(`state of ${datapoint} is ${result.val}`);

    callback(result);
  });
}

if (require.main !== module) {
  // Export startAdapter in compact mode
  module.exports = startAdapter;
} else {
  // otherwise start the instance directly
  startAdapter();
}
