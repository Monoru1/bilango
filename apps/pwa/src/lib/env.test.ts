import { describe, expect, it } from 'vitest';
import { detectEnv, detectInAppBrowser } from './env';

const none = { displayModeStandalone: false, navigatorStandalone: false };
const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.0.0 Mobile/15E148 Safari/604.1',
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.0',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A135F; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0;]',
  tiktokAndroid: 'Mozilla/5.0 (Linux; Android 13; SM-A135F) AppleWebKit/537.36 Chrome/124.0 Mobile Safari/537.36 musical_ly_2023 BytedanceWebview/d8a21c6',
};

describe('détection de l\'environnement (CDC §3)', () => {
  it('Android Chrome : installation en un clic possible', () => {
    expect(detectEnv(UA.chromeAndroid, none)).toEqual({ standalone: false, platform: 'android', iosSafari: false, inAppBrowser: null });
  });
  it('iPhone + Safari : guide manuel', () => {
    expect(detectEnv(UA.safariIphone, none)).toMatchObject({ platform: 'ios', iosSafari: true });
  });
  it("iPhone + Chrome iOS : pas le guide Safari (on invite à ouvrir dans Safari)", () => {
    expect(detectEnv(UA.chromeIphone, none)).toMatchObject({ platform: 'ios', iosSafari: false });
  });
  it('navigateurs intégrés : Instagram, Facebook, TikTok, WhatsApp', () => {
    expect(detectEnv(UA.instagramIphone, none).inAppBrowser).toBe('instagram');
    expect(detectEnv(UA.facebookAndroid, none).inAppBrowser).toBe('facebook');
    expect(detectEnv(UA.tiktokAndroid, none).inAppBrowser).toBe('tiktok');
    expect(detectInAppBrowser('Mozilla/5.0 WhatsApp/2.24')).toBe('whatsapp');
  });
  it('un navigateur intégré iOS n\'est jamais traité comme Safari', () => {
    expect(detectEnv(UA.instagramIphone, none).iosSafari).toBe(false);
  });
  it('mode standalone détecté via display-mode ou navigator.standalone (iOS)', () => {
    expect(detectEnv(UA.chromeAndroid, { displayModeStandalone: true, navigatorStandalone: false }).standalone).toBe(true);
    expect(detectEnv(UA.safariIphone, { displayModeStandalone: false, navigatorStandalone: true }).standalone).toBe(true);
  });
  it('iPadOS se présentant comme Mac est reconnu grâce au tactile', () => {
    const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15';
    expect(detectEnv(mac, none, 5).platform).toBe('ios');
    expect(detectEnv(mac, none, 0).platform).toBe('other');
  });
});
