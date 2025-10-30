import request from 'supertest';
import app from '../src/server';
import * as worldModule from '../src/routes/world';

describe('World routes', () => {
  it('GET /world/:id/web fetches and parses JSON from first script tag', async () => {
    const html = `<!doctype html><html><head><script>window.__DATA__ = {\n  "answer": 42, "nested": { "x": 1 }\n}// trailing stuff</script><script>ignored()</script></head><body></body></html>`;
  const spy = jest.spyOn(worldModule.internal, 'fetchRemote').mockResolvedValue(html as any);

    const res = await request(app).get('/world/abc123/web');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ answer: 42, nested: { x: 1 } });
    spy.mockRestore();
  });

  it('POST /world/:id/config echoes id and config', async () => {
    const payload = { foo: 'bar', nested: { x: 42 } };
    const res = await request(app).post('/world/xyz789/config').send(payload);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: 'xyz789', config: payload });
  });

  it('GET /world/:id/web returns 502 when no script tag', async () => {
  const spy = jest.spyOn(worldModule.internal, 'fetchRemote').mockResolvedValue('<html>No script here</html>' as any);
    const res = await request(app).get('/world/any/web');
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
    spy.mockRestore();
  });

  it('GET /world/:id/web returns 502 when JSON parse fails', async () => {
    const badHtml = '<script>not json at all</script>';
  const spy = jest.spyOn(worldModule.internal, 'fetchRemote').mockResolvedValue(badHtml as any);
    const res = await request(app).get('/world/any/web');
    expect(res.status).toBe(502);
    expect(res.body).toHaveProperty('error');
    spy.mockRestore();
  });
});
