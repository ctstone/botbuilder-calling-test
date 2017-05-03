import { CallSession, IEvent, IMiddlewareMap } from 'botbuilder-calling';
import crypto = require('crypto');
import fs = require('fs');
import async = require('async');
import path = require('path');
import { setImmediate } from './util';

export interface BotCallRecorderOptions {
  rootDir: string;
  hash?: string;
  hashDigest?: crypto.HexBase64Latin1Encoding;
}

export type ErrorCallback = (err: Error) => void;
export type ReadBufferCallback = (filename: string, done: RewriteCallback) => void;
export type RewriteCallback = (err: Error, data: any) => void;
type WriteBufferCallback = (buf: Buffer, done: RewriteCallback) => void;

export class BotCallRecorder {
  middleware: IMiddlewareMap = {
    botbuilder: (session: CallSession, callback: ErrorCallback) => {
      this.write(session, 'session', callback);
    },
    receive: (event: IEvent, callback: ErrorCallback) => {
      this.write(event, event.type, callback);
    },
    send: (event: IEvent, callback: ErrorCallback) => {
      this.write(event, event.type, callback);
    },
  };

  constructor(private options: BotCallRecorderOptions) {
    Object.assign(options, {hash: 'md5', hashDigest: 'hex'});
  }

  read(file: string, callback: RewriteCallback): void {
    const filename = path.resolve(this.options.rootDir, file);
    async.waterfall([
      (next: ErrorCallback) => fs.readFile(filename, 'utf8', next),
      async.asyncify(JSON.parse),
      (data: any, next: RewriteCallback) => this.reconstruct(data, (bufId, done) => this.readBuffer(bufId, done), next),
    ], callback);
  }

  reconstruct(obj: any, onBuffer: ReadBufferCallback, callback: RewriteCallback): void {
    // empty value
    if (!obj) {
      setImmediate(callback, null, obj);

    // buffer
    } else if (obj.$buffer) {
      onBuffer(obj.$buffer, callback);

    // non-standard object
    } else if (obj.$type) {
      setImmediate(callback, null, null);

    // array
    } else if (Array.isArray(obj)) {
      async.mapSeries(obj, (item, next) => this.reconstruct(item, onBuffer, next), callback);

    // object
    } else if (obj.constructor.name === 'Object') {
      async.mapValuesSeries(obj, (item, key, next) => this.reconstruct(item, onBuffer, next), callback);

    // primatives
    } else {
      setImmediate(callback, null, obj);
    }
  }

  private write(data: any, type: string, callback: ErrorCallback): void {
    const time = new Date().getTime();
    const filename = path.resolve(this.options.rootDir, `${time}-${type}.json`);
    async.waterfall([
      (next: RewriteCallback) => this.deconstruct(data, (buf, done) => this.writeBuffer(buf, done), next),
      (obj: any, next: ErrorCallback) => fs.writeFile(filename, JSON.stringify(obj, null, 2), next),
    ], callback);
  }

  private writeBuffer(buf: Buffer, callback: RewriteCallback): void {
    const id = this.hash(buf);
    const name = `${id}.wav`;
    const filename = path.resolve(this.options.rootDir, name);
    async.waterfall([
      (next: ErrorCallback) => fs.writeFile(filename, buf, next),
      (next: RewriteCallback) => setImmediate(next, null, name),
    ], callback);
  }

  private readBuffer(name: string, callback: RewriteCallback): void {
    const filename = path.resolve(this.options.rootDir, name);
    fs.readFile(filename, callback);
  }

  private deconstruct(obj: any, onBuffer: WriteBufferCallback, callback: RewriteCallback): void {
    // function
    if (typeof obj === 'function') {
      setImmediate(callback, null, {$type: obj.constructor.name});

    // error
    } else if (obj instanceof Error) {
      setImmediate(callback, null, { name: obj.name, message: obj.message, stack: obj.stack });

    // buffer
    } else if (Buffer.isBuffer(obj)) {
      async.waterfall([
        (next: RewriteCallback) => onBuffer(obj, next),
        (id: string, next: RewriteCallback) => setImmediate(next, null, {$buffer: id}),
      ], callback);

    // array
    } else if (Array.isArray(obj)) {
      async.mapSeries(obj, (item, next) => this.deconstruct(item, onBuffer, next), callback);

    // objects
    } else if (obj && typeof obj === 'object') {

      // standard objects
      if (obj.constructor.name === 'Object') {
        async.mapValuesSeries(obj, (item, key, next) => this.deconstruct(item, onBuffer, next), callback);

      // other objects
      } else {
        setImmediate(callback, null, {$type: obj.constructor.name});
      }

    // primatives
    } else {
      setImmediate(callback, null, obj);
    }
    return null;
  }

  private hash(buf: Buffer): string {
    return crypto.createHash(this.options.hash).update(buf).digest(this.options.hashDigest);
  }
}
