import { default as express, Express } from 'express';
import { Server } from 'http';
import { default as request, Response } from 'supertest';
import * as t from 'io-ts';

import { create, close, delay } from '../src';
import { validateBody, handlerAsync } from '../src/utils';

describe('express', () => {
  const port = 4000;
  let app: express.Express;
  let server: Server;
  const stub = async (): Promise<void> => {
    await delay(100);
  };

  describe('basic', () => {
    beforeAll(async () => {
      app = express();
      server = await create({
        app,
        port,
        initialize: stub,
        readiness: stub,
        onSignal: stub
      });
    }, 10000);

    afterAll(async () => {
      await close(server);
    }, 10000);

    test('/robots*.txt', async () => {
      const response: Response = await request(server).get('/robots*.txt');
      expect(response.status).toEqual(200);
      expect(response.type).toEqual('text/plain');
      expect(response.text).toEqual('User-agent: *\nDisallow: /');
    });

    test('/liveness', async () => {
      const response: Response = await request(server).get('/liveness');
      expect(response.status).toEqual(200);
      expect(response.type).toEqual('text/plain');
      expect(response.text).toEqual('OK');
    });

    test('/readiness', async () => {
      const response: Response = await request(server).get('/readiness');
      expect(response.status).toEqual(200);
      expect(response.type).toEqual('application/json');
      expect(response.body).toHaveProperty('status', 'ok');
    });
  });

  describe('advanced', () => {
    beforeEach(() => {
      app = express();
    }, 10000);

    afterEach(async () => {
      await close(server);
    });

    test('/initialize - toHaveBeenCalledTimes(1)', async () => {
      const initialize = jest.fn(() => Promise.resolve());
      server = await create({
        app,
        port,
        initialize,
        readiness: stub,
        onSignal: stub
      });
      expect(initialize).toHaveBeenCalledTimes(1);
    });

    test('/initialize - toThrow(Error)', async () => {
      const initialize = jest.fn(() => {
        throw Error('initialize');
      });
      await expect(
        create({
          app,
          port,
          initialize,
          readiness: stub,
          onSignal: stub
        })
      ).rejects.toThrow(Error);
    });

    test('/readiness - toHaveBeenCalledTimes(1)', async () => {
      const readiness = jest.fn(() => Promise.resolve());
      server = await create({
        app,
        port,
        readiness,
        initialize: stub,
        onSignal: stub
      });
      await request(server).get('/readiness');
      expect(readiness).toHaveBeenCalledTimes(1);
    });

    test('/readiness - toThrow(Error)', async () => {
      const readiness = jest.fn(() => {
        throw Error('readiness');
      });
      server = await create({
        app,
        port,
        readiness,
        initialize: stub,
        onSignal: stub
      });
      const response: Response = await request(server).get('/readiness');
      expect(response.status).toEqual(503);
      expect(response.type).toEqual('application/json');
      expect(response.body).toHaveProperty('status', 'error');
    });
  });

  describe('handlerAsync', () => {
    const Echo = t.strict({
      message: t.string
    });

    const echo = async (
      input: t.TypeOf<typeof Echo>
    ): Promise<t.TypeOf<typeof Echo>> => {
      if (input.message === '') {
        throw Error();
      }
      return input;
    };

    const initialize = (app: Express): void => {
      app.use(express.json());
      app.post('/echo', validateBody(Echo), handlerAsync(echo));
    };

    beforeAll(async () => {
      app = express();
      server = await create({
        app,
        port,
        initialize,
        readiness: stub,
        onSignal: stub
      });
    });

    afterAll(async () => {
      await close(server);
    });

    test('handlerAsync - 200', async () => {
      const input = {
        message: 'Hello World!'
      };
      const response: Response = await request(server)
        .post('/echo')
        .send(input);

      const { status, type, body } = response;
      expect(status).toEqual(200);
      expect(type).toEqual('application/json');
      expect(body).toEqual(input);
    });

    test('handlerAsync - 400', async () => {
      const response: Response = await request(server).post('/echo');

      const { status, type } = response;
      expect(status).toEqual(400);
      expect(type).toEqual('text/plain');
    });

    test('handlerAsync - 500', async () => {
      const response: Response = await request(server).post('/echo').send({
        message: ''
      });

      const { status, type, text } = response;
      expect(status).toEqual(500);
      expect(type).toEqual('text/plain');
      expect(text).toEqual('Internal Server Error');
    });
  });
});
