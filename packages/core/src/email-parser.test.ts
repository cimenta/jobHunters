import { describe, expect, it } from 'vitest';
import { extractHints, extractMeetingTime, parseEmail } from './email-parser';

// Every text below is invented. They copy the structure of the mails of job portals, applicant systems and recruiters,
// never the real names, addresses or sentences of a mailbox.

const mail = (over: Partial<Parameters<typeof parseEmail>[0]> & { subject: string; body: string }) => ({
  direction: 'incoming',
  from_email: 'hr@example.com',
  from_name: 'Example HR',
  is_bulk: false,
  ...over,
});

describe('confirmations of an application', () => {
  it('reads the delivery notice of a job portal and the company and job it names', () => {
    const body = 'Hlásíme doručení vaší odpovědi na nabídku Business Analyst.\n<https://track.example.com/x> \nVaši odpověď na nabídku *Business Analyst* jsme úspěšně doručili společnosti Acme s.r.o.. Vaše zpráva už čeká u personalisty.\n\nDoporučujeme \nREACT Developer \nOdpověď do 2 týdnů';
    const result = parseEmail(mail({ subject: 'Hlásíme doručení vaší odpovědi', body, from_email: 'pomuzeme@jobs.example', from_name: 'Jobs Portal', is_bulk: true }));
    expect(result).toMatchObject({ type: 'confirmation', kind: 'confirmation', direction: 'incoming', confidence: 'high', signals: ['portal-confirmation'] });
    expect(result.titleHints).toContain('Business Analyst');
    expect(result.companyHints).toContain('Acme s.r.o.');
  });

  it('reads the "interest sent" mail of a startup portal and ignores the cover letter it quotes', () => {
    const body = '[![Portal](https://x.example/a.png)](https://www.startupjobs.cz)\n\n Odeslaný zájem \n================\n\n####  Podařilo se nám úspěšně poslat váš zájem o nabídku **Data Engineer** do **Globex s.r.o.**. \n\n Shrnutí zájmu \n===============\n\nProč já\n\nDobrý den, rád bych se s vámi sešel na pohovor a probral zadání úkolu. Pošlete mi pozvánku.\n';
    const result = parseEmail(mail({ subject: '[StartupJobs] A je to tam! Globex s.r.o. už o vás ví!', body, from_email: 'bot@portal.example', from_name: 'StartupJobs', is_bulk: true }));
    expect(result).toMatchObject({ type: 'confirmation', kind: 'confirmation', confidence: 'high' });
    expect(result.titleHints).toContain('Data Engineer');
    expect(result.companyHints).toContain('Globex s.r.o.');
  });

  it.each([
    ['Czech, applicant system', 'Zařadili jsme Vás do výběrového řízení na pozici Analytik', 'Dobrý den,\n\nmáme radost, že máte zájem. Vámi zaslané materiály k nám doputovaly v pořádku a zařadili jsme Vás do výběrového řízení.\n'],
    ['Czech, received CV', 'EY - potvrzení přijetí CV', 'Vážený pane,\n\nVaši přihlášku jsme v pořádku obdrželi. V nejbližších dnech se vám ozveme.'],
    ['English, received', 'Your Application has been received', 'Dear Alex,\n\nThank you for your interest. We can confirm that we have successfully received your documents and you are now part of the selection process.'],
    ['English, safe hands', 'Update on Your Application', 'Dear Alex,\n\nThank you for your interest in the Business Systems Specialist role at Initech. Your application is in safe hands. Our team is reviewing applications.'],
    ['English, thanks for applying', 'Thanks for applying to Initech', 'Hi Alex,\n\nThanks for applying for the role of Consultant. Our team will review your application and keep you updated.'],
  ])('recognizes %s', (_name, subject, body) => {
    const result = parseEmail(mail({ subject, body }));
    expect(result).toMatchObject({ type: 'confirmation', kind: 'confirmation', direction: 'incoming' });
  });

  it('reads the automatic reply of a support desk to the form of an ad', () => {
    const result = parseEmail(mail({ subject: '[ORG #123] Odpověď na nabídku práce', body: 'Requestor: alex@example.invalid\n\npozice: Analytik\n\njméno: Alex\n', from_email: 'hr@org.example' }));
    expect(result).toMatchObject({ type: 'confirmation', kind: 'confirmation' });
  });
});

describe('rejections', () => {
  it('reads the rejection a startup portal relays, with the company and the job', () => {
    const body = ' Tentokrát to nevyšlo :\\[ \n==========\n\n####  Firma **Globex s.r.o.** zamítla váš zájem o nabídku **Product Manager (Full-time)**. \n\nHi Alex, we won\'t move forward with your application.\n';
    const result = parseEmail(mail({ subject: '[StartupJobs] Globex s.r.o. - děkujeme za váš zájem', body, from_email: 'bot@portal.example', from_name: 'StartupJobs', is_bulk: true }));
    expect(result).toMatchObject({ type: 'rejection', kind: 'message', confidence: 'high', statusHint: 'rejected' });
    expect(result.companyHints).toContain('Globex s.r.o.');
    expect(result.titleHints).toContain('Product Manager (Full-time)');
  });

  it('reads the rejection inside a message a portal relays', () => {
    const body = '#### **Jana Nováková** z firmy **Smart Co** vám poslal(a) novou zprávu. \n\nDobrý deň,\n\nďakujeme vám za záujem o pozíciu CC Specialist. V medzičase sa nám však podarilo pozíciu obsadiť iným kandidátom, a z tohto dôvodu sme výberové konanie ukončili.\n\n [ Odpovědět na zprávu ](x)';
    const result = parseEmail(mail({ subject: '[StartupJobs] Nová zpráva od Smart Co', body, from_email: 'bot@portal.example', is_bulk: true }));
    expect(result).toMatchObject({ type: 'rejection', kind: 'message', statusHint: 'rejected' });
    expect(result.companyHints).toContain('Smart Co');
  });

  it('reads a relayed message that is no rejection as a message', () => {
    const body = '#### **Jana** z firmy **Smart Co** vám poslal(a) novou zprávu. \n\nDobrý den, můžete mi prosím poslat ještě své požadavky na mzdu?\n\n [ Odpovědět na zprávu ](x)';
    const result = parseEmail(mail({ subject: '[StartupJobs] Nová zpráva od Smart Co', body, from_email: 'bot@portal.example', is_bulk: true }));
    expect(result).toMatchObject({ kind: 'message', confidence: 'low' });
    expect(result.statusHint).toBeUndefined();
  });

  it.each([
    ['Czech', 'Výběrové řízení na pozici Analytik', 'Dobrý den,\n\nděkujeme Vám za zájem o pozici. Rozhodli jsme se pokračovat s kandidáty, jejichž zkušenosti více odpovídají tomu, co hledáme.\n'],
    ['Czech, next round', 'Výběrové řízení', 'Dobrý den,\n\nna základě vyhodnocení jsme se rozhodli pokračovat do dalšího kola s jinými uchazeči.\n'],
    ['Czech, not continuing', 'Výběrové řízení', 'Po zvážení aktuálních potřeb týmu jsme se rozhodli v tuto chvíli nepokračovat ve Vaší kandidatuře.'],
    ['Czech, preferring others', 'Děkujeme', 'Po zvážení zaslaných materiálů jsme se rozhodli pro další kola výběrového řízení upřednostnit jiné zájemce.'],
    ['Slovak', 'Výberový proces', 'Po zvážení všetkých okolností sme sa rozhodli pokračovať vo výberovom procese s inými kandidátmi.'],
    ['English, other candidates', 'Application Update', 'After careful review, we have decided to move forward with other candidates whose backgrounds match more closely.'],
    ['English, not moving forward', 'Application Update', 'After careful review, we’ve decided not to move forward with your application at this time.'],
    ['English, regret', 'Your application', 'We regret to inform you that the position has been filled.'],
  ])('recognizes a %s rejection and suggests the status Rejected', (_name, subject, body) => {
    const result = parseEmail(mail({ subject, body }));
    expect(result).toMatchObject({ type: 'rejection', kind: 'message', confidence: 'high', statusHint: 'rejected' });
  });

  it('recognizes a rejection that gives preference to local candidates', () => {
    const result = parseEmail(mail({ subject: 'Nová zpráva', body: 'Dobrý den, děkujeme za Váš zájem. Vzhledem k dojezdové vzdálenosti jsme se rozhodli dát přednost kandidátům z lokality.' }));
    expect(result).toMatchObject({ type: 'rejection', statusHint: 'rejected' });
  });

  it('prefers a rejection over the thanks it contains for the interview or the application', () => {
    const result = parseEmail(mail({ subject: 'Thank you for applying', body: 'Thank you for taking the time to speak with us about the interview. We have decided to move forward with other candidates.' }));
    expect(result.type).toBe('rejection');
  });
});

describe('meetings', () => {
  const calendar = 'Technical interview\nTuesday 20 Oct 2026 ⋅ 16:00 – 16:30\nCentral European Time - Prague\n\nJoin with Google Meet\nhttps://meet.google.com/aaa-bbbb-ccc\n\nOrganiser\nJana Nováková\n\nInvitation from Google Calendar: https://calendar.google.com/calendar/';

  it('reads a calendar invitation with the time, and suggests the status Interview', () => {
    const result = parseEmail(mail({ subject: 'Invitation: Technical interview @ Tue 20 Oct 2026 16:00 - 16:30 (CEST) (alex@example.invalid)', body: calendar }));
    expect(result).toMatchObject({ type: 'interview_invite', kind: 'meeting', direction: 'incoming', confidence: 'high', statusHint: 'interview', meetingAt: '2026-10-20T16:00' });
  });

  it('reads a booked appointment and a Teams invitation', () => {
    expect(parseEmail(mail({ subject: 'Appointment booked: Consultant (Alex) @ Fri 23 Oct 2026 15:00 - 15:30 (CEST)', body: 'Friday 23 Oct 2026 ⋅ 15:00 – 15:30\n\nJoin with Google Meet\nhttps://meet.google.com/x\n\nBooked by\nAlex' })))
      .toMatchObject({ kind: 'meeting', meetingAt: '2026-10-23T15:00', confidence: 'high' });
    const teams = parseEmail(mail({ subject: 'FW: pohovor on-line p. Novák', body: 'Předmět: pohovor on-line p. Novák\nKdy: pátek 23. října 2026 10:00-11:00.\nKde: Schůzka v Microsoft Teams\n\nDobrý den, zasílám pozvánku k našemu setkání on-line.\n\nSchůzka v Microsoft Teams\nPřipojit se: https://teams.microsoft.com/meet/123' }));
    expect(teams).toMatchObject({ kind: 'meeting', meetingAt: '2026-10-23T10:00' });
  });

  it('reads a recruiter who proposes a call, with the date in the text', () => {
    const body = 'Dobrý den, ráda bych Vás pozvala na krátký úvodní online call k pozici Integration Specialist,\nDatum: 13.10.26\nČas: 13:00 CET\nDélka: cca 30 min\nPlatforma: Microsoft Teams\n';
    const result = parseEmail(mail({ subject: 'precall - Integration Specialist - Alex Novák', body }));
    expect(result).toMatchObject({ type: 'interview_invite', kind: 'meeting', meetingAt: '2026-10-13T13:00', statusHint: 'interview' });
  });

  it('reads an invitation to choose a time slot', () => {
    const result = parseEmail(mail({ subject: 'Interview Availability', body: 'Dear Alex,\n\nwe would like to invite you to an interview to discuss your candidacy further. Please let us know when you\'re available using the link below.\n' }));
    expect(result).toMatchObject({ kind: 'meeting', confidence: 'low', statusHint: 'interview' });
    expect(result.meetingAt).toBe('');
  });

  it('does not read your own reply about an invitation as a meeting, unless it names a date and time', () => {
    const reply = parseEmail(mail({ direction: 'outgoing', from_email: 'alex@example.invalid', subject: 'Re: Pozvánka', body: 'Dobrý den, prosím o termín ve čtvrtek. Pošlete mi pozvánku? Děkuji.' }));
    expect(reply).toMatchObject({ kind: 'message', direction: 'outgoing' });
    const timed = parseEmail(mail({ direction: 'outgoing', from_email: 'alex@example.invalid', subject: 'Re: Pohovor', body: 'Dobrý den, termín 15. 10. 2026 14:30 mi vyhovuje, těším se na pohovor.' }));
    expect(timed).toMatchObject({ kind: 'meeting', direction: 'outgoing', meetingAt: '2026-10-15T14:30' });
  });
});

describe('meeting notes, homework and the rest', () => {
  it('reads the summary of a notetaker as the note after a meeting', () => {
    const result = parseEmail(mail({ subject: 'Full summary & 1 action items for Jana — Alex x Acme', body: '*Recording:* \nView the meeting recording\n\n*Meeting Summary:* \n\n1. Experience\n• Alex has worked on ...\n\n*Action Items:* — Alex x Acme', from_email: 'no-reply@usebubbles.example', from_name: 'Bubbles Notetaker', is_bulk: true }));
    expect(result).toMatchObject({ type: 'other', kind: 'after_meeting', direction: 'note', confidence: 'high' });
  });

  it('suggests Homework, only with low confidence', () => {
    const result = parseEmail(mail({ subject: 'Next step', body: 'Hi Alex, as the next step please complete the attached take-home assignment within 5 days.' }));
    expect(result).toMatchObject({ type: 'homework', kind: 'homework', confidence: 'low', statusHint: 'homework' });
  });

  it('suggests an offer as a message with the status Offer, with low confidence', () => {
    const result = parseEmail(mail({ subject: 'Next steps', body: 'We are pleased to offer you the position. The offer letter is attached.' }));
    expect(result).toMatchObject({ type: 'offer', kind: 'message', confidence: 'low', statusHint: 'offer' });
  });

  it('reads a request for a form as an information request, a message', () => {
    const result = parseEmail(mail({ subject: 'GDPR formulář', body: 'Dobrý den, děkuji za čas na telefonátu. Dle dohody zasílám náš GDPR formulář a prosím o jeho vyplnění: https://forms.example.com/x' }));
    expect(result).toMatchObject({ type: 'info_request', kind: 'message', confidence: 'low' });
  });

  it('leaves job alerts and newsletters out', () => {
    const alert = parseEmail(mail({ subject: '12 new jobs for you', body: 'Doporučujeme\nSenior Developer\nOdpověď do 2 týdnů\nunsubscribe', from_email: 'alerts@jobs.example', is_bulk: true }));
    expect(alert).toMatchObject({ type: 'noise', kind: undefined });
  });

  it('reads any other mail from a person as a message with low confidence, and your own as outgoing', () => {
    expect(parseEmail(mail({ subject: 'Salary', body: 'Hello Alex, what are your salary expectations?' }))).toMatchObject({ type: 'other', kind: 'message', direction: 'incoming', confidence: 'low' });
    expect(parseEmail(mail({ direction: 'outgoing', subject: 'Re: Salary', body: 'About 5000 EUR.' }))).toMatchObject({ kind: 'message', direction: 'outgoing', summary: 'Salary' });
  });
});

describe('meeting time', () => {
  it.each([
    ['Invitation: x @ Tue 20 Oct 2026 16:00 - 16:30 (CEST)', '', '2026-10-20T16:00'],
    ['x', 'Friday 23 Oct 2026 ⋅ 15:00 – 15:30', '2026-10-23T15:00'],
    ['x', 'Kdy: pátek 23. října 2026 10:00-11:00', '2026-10-23T10:00'],
    ['x', 'Datum: 13.10.26\nČas: 13:00 CET', '2026-10-13T13:00'],
    ['x', 'Termín 15. 10. 2026 v 14:30', '2026-10-15T14:30'],
    ['x', 'No date here, only 14:30', ''],
    ['x', 'Datum: 45.13.26 Čas: 13:00', ''],
  ])('reads %s / %s', (subject, body, expected) => {
    expect(extractMeetingTime(subject, body)).toBe(expected);
  });
});

describe('hints about the job and the company', () => {
  it('reads titles and companies from the usual sentences', () => {
    expect(extractHints('Zařadili jsme Vás do výběrového řízení na pozici AI Analytik', 'Dobrý den').titleHints).toContain('AI Analytik');
    const english = extractHints('Thank you for your application', 'Thank you for your interest in the Business Process Analyst position at Initech s.r.o. We are pleased');
    expect(english.titleHints.some((hint) => hint.startsWith('Business Process Analyst'))).toBe(true);
    expect(english.companyHints).toContain('Initech s.r.o.');
    expect(extractHints('[StartupJobs] Nová zpráva od Acme', '').companyHints).toContain('Acme');
    expect(extractHints('[StartupJobs] A je to tam! Pixel Co už o vás ví!', '').companyHints).toContain('Pixel Co');
  });

  it('cuts a company at the lowercase words of the sentence and a title where the sentence goes on', () => {
    expect(extractHints('x', 'Váš zájem o pozici Analytik ve společnosti ACME nás velmi potěšil.').companyHints).toContain('ACME');
    expect(extractHints('x', 'děkujeme za Váš zájem o pozici Vibecoder / AI Developer a za zaslané podklady.\n').titleHints).toContain('Vibecoder / AI Developer');
  });

  it('reads the company from "applying to COMPANY" in the subject or the text, and not a role or a lowercase continuation', () => {
    expect(extractHints('Thanks for applying to RevoData', '').companyHints).toContain('RevoData');
    expect(extractHints('Your application to Acme Corp', '').companyHints).toContain('Acme Corp');
    expect(extractHints('x', 'Thank you for applying to Globex! We will be in touch.').companyHints).toContain('Globex');
    expect(extractHints('x', 'Thanks for applying to Initech s.r.o. and for your time.').companyHints).toContain('Initech s.r.o.');
    expect(extractHints('Thanks for applying to the Data Analyst role', '').companyHints).not.toContain('the');
    expect(extractHints('Thanks for applying', '').companyHints).toEqual([]);
  });

  it('reads the company from a signature of a recruiting team', () => {
    expect(extractHints('Thank you', 'Thank you for applying.\n\nThe HERE Talent Acquisition Team').companyHints).toContain('HERE');
    expect(extractHints('x', 'Best regards,\nWhalebone Recruitment Team\n').companyHints).toContain('Whalebone');
    expect(extractHints('x', 'Kind regards, The Acme Corp Hiring Team').companyHints).toContain('Acme Corp');
  });

  it('keeps the list free of duplicates and of empty values', () => {
    const hints = extractHints('Role Analyst', 'position Analyst at Acme');
    expect(new Set(hints.titleHints.map((hint) => hint.toLowerCase())).size).toBe(hints.titleHints.length);
    expect(hints.titleHints.every((hint) => hint !== '')).toBe(true);
  });
});
