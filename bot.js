const fs = require('fs');
const axios = require('axios');

// === KONFIGURASI LANGSUNG DI SINI ===
const CAPTCHA_PROVIDER = 'anticaptcha'; // Pilihan: '2captcha', 'anticaptcha', 'capmonster'
const CAPTCHA_API_KEY = 'apikeymu'; // Ganti dengan API Key milikmu

const SITE_KEY = '6LeuQAorAAAAAF3vZY-BS4WSnl_5lIXFFhw9AUtV';
const PAGE_URL = 'https://airdrop.firachain.com/';

const getCaptchaToken = async () => {
  let createTaskUrl, getResultUrl, taskPayload;

  if (CAPTCHA_PROVIDER === '2captcha') {
    const formData = new URLSearchParams();
    formData.append('key', CAPTCHA_API_KEY);
    formData.append('method', 'userrecaptcha');
    formData.append('googlekey', SITE_KEY);
    formData.append('pageurl', PAGE_URL);
    formData.append('json', 1);

    const { data: createResp } = await axios.post('http://2captcha.com/in.php', formData);
    if (createResp.status !== 1) throw new Error('Failed to submit captcha to 2captcha');

    const taskId = createResp.request;
    for (let i = 0; i < 30; i++) {
      const res = await axios.get(`http://2captcha.com/res.php?key=${CAPTCHA_API_KEY}&action=get&id=${taskId}&json=1`);
      if (res.data.status === 1) return res.data.request;
      await new Promise(r => setTimeout(r, 5000));
    }
    throw new Error('2captcha timeout');
  }

  if (CAPTCHA_PROVIDER === 'anticaptcha') {
    createTaskUrl = 'https://api.anti-captcha.com/createTask';
    getResultUrl = 'https://api.anti-captcha.com/getTaskResult';
    taskPayload = {
      clientKey: CAPTCHA_API_KEY,
      task: {
        type: "RecaptchaV2TaskProxyless",
        websiteURL: PAGE_URL,
        websiteKey: SITE_KEY
      }
    };
  } else if (CAPTCHA_PROVIDER === 'capmonster') {
    createTaskUrl = 'https://api.capmonster.cloud/createTask';
    getResultUrl = 'https://api.capmonster.cloud/getTaskResult';
    taskPayload = {
      clientKey: CAPTCHA_API_KEY,
      task: {
        type: "NoCaptchaTaskProxyless",
        websiteURL: PAGE_URL,
        websiteKey: SITE_KEY
      }
    };
  }

  const { data: create } = await axios.post(createTaskUrl, taskPayload);
  const taskId = create.taskId;
  if (!taskId) throw new Error('Gagal membuat task captcha');

  for (let i = 0; i < 30; i++) {
    const { data: result } = await axios.post(getResultUrl, {
      clientKey: CAPTCHA_API_KEY,
      taskId
    });
    if (result.status === 'ready') return result.solution.gRecaptchaResponse;
    await new Promise(r => setTimeout(r, 5000));
  }

  throw new Error('Captcha solving timeout');
};

const register = async (email, wallet) => {
  try {
    console.log(`[INFO] Solving CAPTCHA for ${email}`);
    const recaptcha = await getCaptchaToken();

    const res = await axios.post(
      'https://airdrop.firachain.com/register.php',
      {
        email,
        wallet,
        recaptcha
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Origin': 'https://airdrop.firachain.com',
          'Referer': 'https://airdrop.firachain.com/',
        }
      }
    );

    console.log(`[SUCCESS] ${email} => ${res.data.message}`);
  } catch (err) {
    console.error(`[ERROR] ${email} => ${err.message}`);
  }
};

const emails = fs.readFileSync('emails.txt', 'utf-8').split('\n').map(x => x.trim()).filter(Boolean);
const wallets = fs.readFileSync('wallets.txt', 'utf-8').split('\n').map(x => x.trim()).filter(Boolean);

(async () => {
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    const wallet = wallets[i];
    if (!email || !wallet) continue;
    await register(email, wallet);
  }
})();
