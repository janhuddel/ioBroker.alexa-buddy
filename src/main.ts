import * as utils from '@iobroker/adapter-core';
import mqtt, { MqttClient } from 'mqtt';
import MqttPattern from 'mqtt-pattern';

class AlexaBuddy extends utils.Adapter {
    static requestPattern = 'request/user/+user_id/+datapoint/+op';

    private mqttClient?: MqttClient;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'alexa-buddy',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        const url = this.config.mqttServer;
        this.log.info(`Connecting to mqtt-server: ${url}...`);

        this.mqttClient = mqtt.connect(url, {
            protocolVersion: 5,
        });

        this.mqttClient.on('error', (err) => {
            this.log.error(err.message);
        });

        this.mqttClient.on('connect', this.mqttReady.bind(this));
        this.mqttClient.on('message', this.mqttMessageReceived.bind(this));
    }

    private mqttReady(): void {
        const userId = this.config.userId;
        const requestTopic = `request/user/${userId}/#`;
        this.log.info(`Subcribing to ${requestTopic}...`);

        this.mqttClient?.subscribe('request/#', {
            qos: 1,
        });
    }

    private async mqttMessageReceived(topic: string, payload: any, packet: any): Promise<void> {
        if (!packet.properties) {
            this.log.warn('No packet properties - ignoring message');
            return;
        }

        this.log.debug(`Message received. Topic: ${topic}, Payload: ${payload}`);

        const params: any = MqttPattern.exec(AlexaBuddy.requestPattern, topic);

        const responseTopic = packet.properties.responseTopic;
        const corrData = packet.properties.correlationData?.toString();
        const publishOptions = {
            properties: {
                correlationData: Buffer.from(corrData, 'utf-8'),
            },
        };

        if (params.op === 'get-state') {
            this.getForeignState(params.datapoint, (err?: Error | null, state?: ioBroker.State | null) => {
                const response: any = { code: 'OK' };
                if (err) {
                    response.code = 'ERROR';
                    response.message = err.message;
                } else {
                    response.state = state;
                }
                this.mqttClient?.publish(responseTopic, JSON.stringify(response), publishOptions);
            });
        } else if (params.op === 'set-state') {
            const desiredState = JSON.parse(payload);
            this.setForeignStateChanged(
                params.datapoint,
                { val: desiredState.val, ack: false },
                (err: Error | null, _id: string, notChanged: boolean) => {
                    const response: any = { code: 'OK' };
                    if (err) {
                        response.code = 'ERROR';
                        response.message = err.message;
                    } else if (notChanged) {
                        response.code = 'IGNORED';
                    }
                    this.mqttClient?.publish(responseTopic, JSON.stringify(response), publishOptions);
                },
            );
        }
    }

    private onUnload(callback: () => void): void {
        this.mqttClient
            ?.endAsync()
            .then(() => callback())
            .catch(() => callback());
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AlexaBuddy(options);
} else {
    // otherwise start the instance directly
    (() => new AlexaBuddy())();
}
