import { Resend } from 'resend';

const resend = new Resend('re_iH9DRyW1_KtAZXT84VLqLAK2Fcy3r7gSg');

async function test() {
  const result = await resend.emails.send({
    from: 'onboarding@resend.dev',
    to: 'leviturjeman@gmail.com',
    subject: 'Hello World',
    html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
  });
  console.log("RESULT:", result);
}
test();
