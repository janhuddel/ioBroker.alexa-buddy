"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_mqtt = __toESM(require("mqtt"));
var import_mqtt_pattern = __toESM(require("mqtt-pattern"));
class AlexaBuddy extends utils.Adapter {
  static requestPattern = "request/user/+user_id/+datapoint/+op";
  mqttClient;
  constructor(options = {}) {
    super({
      ...options,
      name: "alexa-buddy"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    const url = this.config.mqttServer;
    this.log.info(`Connecting to mqtt-server: ${url}...`);
    this.mqttClient = import_mqtt.default.connect(url, {
      protocolVersion: 5
    });
    this.mqttClient.on("error", (err) => {
      this.log.error(err.message);
    });
    this.mqttClient.on("connect", this.mqttReady.bind(this));
    this.mqttClient.on("message", this.mqttMessageReceived.bind(this));
  }
  mqttReady() {
    var _a;
    const userId = this.config.userId;
    const requestTopic = `request/user/${userId}/#`;
    this.log.info(`Subcribing to ${requestTopic}...`);
    (_a = this.mqttClient) == null ? void 0 : _a.subscribe("request/#", {
      qos: 1
    });
  }
  async mqttMessageReceived(topic, payload, packet) {
    var _a;
    if (!packet.properties) {
      this.log.warn("No packet properties - ignoring message");
      return;
    }
    this.log.debug(`Message received. Topic: ${topic}, Payload: ${payload}`);
    const params = import_mqtt_pattern.default.exec(AlexaBuddy.requestPattern, topic);
    const responseTopic = packet.properties.responseTopic;
    const corrData = (_a = packet.properties.correlationData) == null ? void 0 : _a.toString();
    const publishOptions = {
      properties: {
        correlationData: Buffer.from(corrData, "utf-8")
      }
    };
    if (params.op === "get-state") {
      this.getForeignState(params.datapoint, (err, state) => {
        var _a2;
        const response = { code: "OK" };
        if (err) {
          response.code = "ERROR";
          response.message = err.message;
        } else {
          response.state = state;
        }
        (_a2 = this.mqttClient) == null ? void 0 : _a2.publish(responseTopic, JSON.stringify(response), publishOptions);
      });
    } else if (params.op === "set-state") {
      const desiredState = JSON.parse(payload);
      this.setForeignStateChanged(
        params.datapoint,
        { val: desiredState.val, ack: false },
        (err, _id, notChanged) => {
          var _a2;
          const response = { code: "OK" };
          if (err) {
            response.code = "ERROR";
            response.message = err.message;
          } else if (notChanged) {
            response.code = "IGNORED";
          }
          (_a2 = this.mqttClient) == null ? void 0 : _a2.publish(responseTopic, JSON.stringify(response), publishOptions);
        }
      );
    }
  }
  onUnload(callback) {
    var _a;
    (_a = this.mqttClient) == null ? void 0 : _a.endAsync().then(() => callback()).catch(() => callback());
  }
}
if (require.main !== module) {
  module.exports = (options) => new AlexaBuddy(options);
} else {
  (() => new AlexaBuddy())();
}
//# sourceMappingURL=main.js.map
