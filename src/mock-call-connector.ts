import async = require('async');
import {
  IBotStorage, IBotStorageContext, IBotStorageData,
  ICallConnector, IEvent } from 'botbuilder-calling';
import { BotCallRecorder, BotCallRecorderOptions, RewriteCallback } from './bot-call-recorder';

export class MockCallConnector implements ICallConnector, IBotStorage {

  private handler: (event: IEvent, cb?: (err: Error) => void) => void;
  private responses: { [id: string]: (err: Error, repsonse?: any) => void; } = {};
  private recorder: BotCallRecorder;

  constructor(options?: BotCallRecorderOptions) {
    if (options) {
      this.recorder = new BotCallRecorder(options);
    }
  }

  onEvent(handler: (event: IEvent, callback?: (err: Error) => void) => void): void {
    this.handler = handler;
  }

  send(event: IEvent, errorCallback: (err: Error) => void): void {
    if (event.type !== 'workflow' || !event.address || !event.address.conversation) {
      return errorCallback(new Error('Invalid message sent to MockCallConnector.send()'));
    }

    const conversation = event.address.conversation;
    if (!this.responses.hasOwnProperty(conversation.id)) {
      return errorCallback(new Error('Invalid message sent to MockCallConnector.send()'));
    }

    const callback = this.responses[conversation.id];
    callback(null, event);
  }

  getData(context: IBotStorageContext, callback: (err: Error, data: IBotStorageData) => void): void {
    throw new Error('Method not implemented.');
  }
  saveData(context: IBotStorageContext, data: IBotStorageData, callback?: (err: Error) => void): void {
    throw new Error('Method not implemented.');
  }

  request(event: any, response: (err: Error, response?: any) => void) {
    const id = event.sourceEvent.id;
    this.responses[id] = response;
    this.handler(event, (err) => {
      if (err) {
        response(err);
      }
    });
  }

  requestEvents(events: any[], response: (err: Error, response?: any) => void): void {
    async.mapSeries(events, (event, next) => this.request(event, next), response);
  }

  requestFromFile(file: string, response: (err: Error, response?: any) => void) {
    if (!this.recorder) {
      throw new Error('Must supply BotCallRecorderOptions to use requestFromFile');
    }

    async.waterfall([
      (next: ErrorCallback<any>) => this.recorder.read(file, next),
      (event: any, next: ErrorCallback<any>) => this.request(event, next),
    ], response);
  }

  requestFromFiles(files: string[], response: (err: Error, response?: any[]) => void): void {
    async.mapSeries(files, (filepath, next) => this.requestFromFile(filepath, next), response);
  }
}
