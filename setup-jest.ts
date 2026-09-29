import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';
import { MessageChannel, MessagePort } from 'node:worker_threads';
import { TextEncoder, TextDecoder } from 'util';
import failOnConsole from 'jest-fail-on-console'

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as typeof global.TextDecoder;

// jsdom does not expose the WHATWG Streams globals; provide Node's implementation so
// code paths that reference ReadableStream (e.g. fetch/stream helpers) run under jest.
global.ReadableStream = global.ReadableStream ?? (ReadableStream as typeof global.ReadableStream);
global.WritableStream = global.WritableStream ?? (WritableStream as typeof global.WritableStream);
global.TransformStream = global.TransformStream ?? (TransformStream as typeof global.TransformStream);
global.MessageChannel = global.MessageChannel ?? (MessageChannel as unknown as typeof global.MessageChannel);
global.MessagePort = global.MessagePort ?? (MessagePort as unknown as typeof global.MessagePort);

failOnConsole()
