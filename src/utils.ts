import type { Server } from 'http';
import type { Request, Response, NextFunction } from 'express';
import * as t from 'io-ts';
import { PathReporter } from 'io-ts/PathReporter';
import { either } from 'fp-ts';

export const delay = async (delay: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
};

export const listen = async (server: Server, port: number): Promise<void> => {
  await new Promise((resolve) => {
    server.listen(port).once('listening', resolve);
  });
};

export const close = async (server: Server): Promise<void> => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
};

export const decode = <I, O>(input: I, decoder: t.Decoder<I, O>): O => {
  const result = decoder.decode(input);
  if (either.isLeft(result)) {
    throw new Error(PathReporter.report(result).join('\n'));
  }
  return result.right;
};

export const validateBody = <I, O>(
  decoder: t.Decoder<I, O>
): ((req: Request, res: Response, next: NextFunction) => void) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.locals = decode(req.body, decoder);
      next();
    } catch ({ message }) {
      res.type('text/plain');
      res.status(400).send({ message });
    }
  };
};

export const handlerAsync = <T1, T2>(func: (body: T2) => Promise<T1>) => async (
  _: Request,
  res: Response
) => {
  try {
    const body: T2 = res.locals as T2;
    const result = await func(body);
    res.type('application/json');
    res.status(200).send(result);
  } catch (error) {
    res.type('text/plain');
    res.status(500).send('Internal Server Error');
  }
};
