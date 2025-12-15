import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 20,
  duration: '30s'
};

const target = __ENV.TARGET_URL ?? 'http://localhost:3000/health';
const authHeader = __ENV.AUTH_HEADER;

export default function () {
  const params = authHeader ? { headers: { Authorization: authHeader } } : {};
  const res = http.get(target, params);
  check(res, {
    'status is 200': (r) => r.status === 200
  });
  sleep(1);
}
