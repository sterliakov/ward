import Ward from './ward';

function defineUnwritablePropertyIfPossible(o, p, value) {
  const descriptor = Object.getOwnPropertyDescriptor(o, p);
  if (!descriptor || descriptor.writable) {
    if (!descriptor || descriptor.configurable) {
      Object.defineProperty(
        o,
        p,
        {
          value,
          writable: false,
        },
      );
    }
    else {
      o[p] = value;
    }
  }
  else {
    console.warn(
      `Failed to inject ${p} from ward. Probably, other wallet is trying to intercept Ward`,
    );
  }
}

export function injectWardToWindow(ward) {
  defineUnwritablePropertyIfPossible(window, 'ward', ward);
}

if (typeof window.browser === 'undefined') window.browser = window.chrome;
injectWardToWindow(new Ward());
